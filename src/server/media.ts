import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { prisma } from "@/lib/db";
import { LIMITS } from "@/lib/constants";
import { badRequest } from "@/lib/errors";
import { newMediaId, sniff, storage } from "./storage";

const run = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";

/**
 * Validates and normalizes an uploaded image: real type from magic bytes,
 * size limit, re-encoded through ffmpeg (strips EXIF/GPS metadata, caps size).
 */
export async function saveImage(file: File, prefix: string, maxWidth = 1600) {
  if (file.size > LIMITS.imageBytes) throw badRequest("התמונה גדולה מדי (עד 8MB)");
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniff(buf);
  if (!kind || kind.kind !== "image") throw badRequest("סוג קובץ לא נתמך. העלו JPG, PNG או WEBP");
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "buber-img-"));
  const src = path.join(tmp, "src" + kind.ext);
  const out = path.join(tmp, "out.jpg");
  try {
    await fs.writeFile(src, buf);
    await run(FFMPEG, [
      "-y", "-loglevel", "error", "-i", src,
      "-vf", `scale='min(${maxWidth},iw)':-2`,
      "-map_metadata", "-1", "-q:v", "3", "-frames:v", "1", out,
    ]);
    const key = `${prefix}/${newMediaId()}.jpg`;
    await storage.putFile(key, out);
    return key;
  } catch {
    throw badRequest("לא הצלחנו לקרוא את התמונה. נסו קובץ אחר");
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

/** Validates size and real file type (magic bytes) of an uploaded video. */
export async function validateVideoUpload(file: File) {
  if (file.size > LIMITS.videoBytes) throw badRequest("הסרטון גדול מדי (עד 80MB)");
  if (file.size === 0) throw badRequest("הקובץ ריק");
  const head = Buffer.from(await file.slice(0, 64).arrayBuffer());
  const kind = sniff(head);
  if (!kind || kind.kind !== "video") throw badRequest("סוג קובץ לא נתמך. העלו MP4, MOV או WEBM");
  return kind;
}

/** Stores the original upload (already validated) and returns its key. */
export async function saveReelOriginal(file: File, reelId: string) {
  const kind = await validateVideoUpload(file);
  const key = `reels/${reelId}/original${kind.ext}`;
  await storage.put(key, Buffer.from(await file.arrayBuffer()));
  return key;
}

/**
 * Worker step: probe → transcode to H.264/AAC MP4 (max 720x1280, faststart) → thumbnail.
 * Any failure marks the reel FAILED. A reel only becomes PUBLISHED after this succeeds.
 */
export async function processReel(reelId: string) {
  const reel = await prisma.reel.findUnique({ where: { id: reelId } });
  if (!reel || reel.status !== "PROCESSING" || !reel.originalPath) return;
  const src = storage.localPath(reel.originalPath);
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "buber-reel-"));
  try {
    const { stdout } = await run(FFPROBE, [
      "-v", "error", "-print_format", "json", "-show_streams", "-show_format", src,
    ]);
    const probe = JSON.parse(stdout) as {
      streams: { codec_type: string; width?: number; height?: number }[];
      format: { duration?: string };
    };
    const v = probe.streams.find((s) => s.codec_type === "video");
    if (!v) throw new Error("לא נמצא ערוץ וידאו בקובץ");
    const duration = Number(probe.format.duration ?? 0);
    if (!duration || duration > LIMITS.videoMaxSeconds) {
      throw new Error(`אורך הסרטון חייב להיות עד ${LIMITS.videoMaxSeconds} שניות`);
    }
    const hasAudio = probe.streams.some((s) => s.codec_type === "audio");
    const outVideo = path.join(tmp, "video.mp4");
    const outWebm = path.join(tmp, "video.webm");
    const outThumb = path.join(tmp, "thumb.jpg");
    await run(FFMPEG, [
      "-y", "-loglevel", "error", "-i", src,
      "-vf", "scale='min(720,iw)':'min(1280,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-pix_fmt", "yuv420p",
      ...(hasAudio ? ["-c:a", "aac", "-b:a", "128k"] : ["-an"]),
      "-map_metadata", "-1", "-movflags", "+faststart", outVideo,
    ], { timeout: 5 * 60_000 });
    // VP9 rendition for browsers without H.264 support
    await run(FFMPEG, [
      "-y", "-loglevel", "error", "-i", outVideo,
      "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-row-mt", "1", "-b:v", "1200k",
      ...(hasAudio ? ["-c:a", "libopus", "-b:a", "96k"] : ["-an"]),
      outWebm,
    ], { timeout: 5 * 60_000 });
    await run(FFMPEG, [
      "-y", "-loglevel", "error", "-ss", String(Math.min(1, duration / 2)), "-i", outVideo,
      "-frames:v", "1", "-q:v", "3", outThumb,
    ]);
    const { stdout: dims } = await run(FFPROBE, [
      "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", outVideo,
    ]);
    const [width, height] = dims.trim().split(",").map(Number);
    const videoKey = `reels/${reel.id}/video.mp4`;
    const webmKey = `reels/${reel.id}/video.webm`;
    const thumbKey = `reels/${reel.id}/thumb.jpg`;
    await storage.putFile(videoKey, outVideo);
    await storage.putFile(webmKey, outWebm);
    await storage.putFile(thumbKey, outThumb);
    // Only publish if it is still in PROCESSING (not deleted/hidden meanwhile).
    await prisma.reel.updateMany({
      where: { id: reel.id, status: "PROCESSING" },
      data: {
        videoPath: videoKey,
        webmPath: webmKey,
        thumbPath: thumbKey,
        durationSec: duration,
        width,
        height,
        failureReason: null,
        status: reel.publishWhenReady ? "PUBLISHED" : "DRAFT",
        publishedAt: reel.publishWhenReady ? new Date() : null,
      },
    });
  } catch (e) {
    const msg = e instanceof Error && /[֐-׿]/.test(e.message) ? e.message : "עיבוד הסרטון נכשל. נסו קובץ אחר.";
    await prisma.reel.update({
      where: { id: reel.id },
      data: { status: "FAILED", failureReason: msg, publishedAt: null },
    });
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}
