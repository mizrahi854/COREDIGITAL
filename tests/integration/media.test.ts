import { beforeEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { prisma } from "@/lib/db";
import { processReel } from "@/server/media";
import { getFeed } from "@/server/feed";
import { storage } from "@/server/storage";
import { business, resetDb } from "../support/fixtures";

async function reelWithOriginal(businessId: string, source: Buffer | string) {
  const reel = await prisma.reel.create({ data: { businessId, category: "NAILS", status: "PROCESSING", publishWhenReady: true, rightsConfirmed: true } });
  const key = `reels/${reel.id}/original.mp4`;
  if (typeof source === "string") await storage.putFile(key, source);
  else await storage.put(key, source);
  await prisma.reel.update({ where: { id: reel.id }, data: { originalPath: key } });
  return reel;
}

describe("reel processing", () => {
  beforeEach(resetDb);

  it("a broken upload ends FAILED and never appears in the feed", async () => {
    const f = await business();
    // valid MP4 magic bytes, garbage body
    const junk = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(4000, 7)]);
    const reel = await reelWithOriginal(f.business.id, junk);
    await processReel(reel.id);
    const after = await prisma.reel.findUniqueOrThrow({ where: { id: reel.id } });
    expect(after.status).toBe("FAILED");
    expect(after.publishedAt).toBeNull();
    expect(after.failureReason).toBeTruthy();
    const feed = await getFeed({ tab: "local" });
    expect(feed.items.find((i) => i.id === reel.id)).toBeUndefined();
  });

  it("a valid upload is transcoded (MP4 + WebM + thumbnail) and published", async () => {
    const f = await business();
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "buber-t-")), "in.mp4");
    execFileSync("ffmpeg", ["-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=360x640:rate=24:duration=2", "-pix_fmt", "yuv420p", tmp]);
    const reel = await reelWithOriginal(f.business.id, tmp);
    await processReel(reel.id);
    const after = await prisma.reel.findUniqueOrThrow({ where: { id: reel.id } });
    expect(after.status).toBe("PUBLISHED");
    expect(after.videoPath).toMatch(/video\.mp4$/);
    expect(after.webmPath).toMatch(/video\.webm$/);
    expect(await storage.stat(after.thumbPath!)).not.toBeNull();
    const feed = await getFeed({ tab: "local" });
    expect(feed.items.some((i) => i.id === reel.id)).toBe(true);
  }, 60_000);

  it("hidden-by-admin reels are excluded from the feed", async () => {
    const f = await business();
    const r = await prisma.reel.create({ data: { businessId: f.business.id, category: "NAILS", status: "PUBLISHED", videoPath: "x.mp4", publishedAt: new Date(), hiddenByAdmin: true } });
    const feed = await getFeed({ tab: "local" });
    expect(feed.items.find((i) => i.id === r.id)).toBeUndefined();
  });
});
