import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Media storage adapter. Local disk for development; an S3-compatible adapter
 * (R2, S3, GCS) can implement the same interface for production.
 * Keys look like "reels/<id>/video.mp4" and are served by /media/[...key].
 */
export interface MediaStorage {
  put(key: string, data: Buffer): Promise<void>;
  putFile(key: string, sourcePath: string): Promise<void>;
  localPath(key: string): string;
  stat(key: string): Promise<{ size: number } | null>;
  stream(key: string, range?: { start: number; end: number }): NodeJS.ReadableStream;
  remove(prefix: string): Promise<void>;
}

const ROOT = path.resolve(process.env.MEDIA_ROOT ?? "./storage");

export function safeKey(key: string) {
  const norm = path.posix.normalize(key).replace(/^\/+/, "");
  if (norm.startsWith("..") || norm.includes("\0") || !/^[a-zA-Z0-9/_.-]+$/.test(norm)) {
    throw new Error("invalid media key");
  }
  return norm;
}

class LocalStorage implements MediaStorage {
  localPath(key: string) {
    return path.join(ROOT, safeKey(key));
  }
  async put(key: string, data: Buffer) {
    const p = this.localPath(key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, data);
  }
  async putFile(key: string, sourcePath: string) {
    const p = this.localPath(key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.copyFile(sourcePath, p);
  }
  async stat(key: string) {
    try {
      const s = await fs.stat(this.localPath(key));
      return s.isFile() ? { size: s.size } : null;
    } catch {
      return null;
    }
  }
  stream(key: string, range?: { start: number; end: number }) {
    return createReadStream(this.localPath(key), range);
  }
  async remove(prefix: string) {
    await fs.rm(this.localPath(prefix), { recursive: true, force: true });
  }
}

export const storage: MediaStorage = new LocalStorage();

export const newMediaId = () => crypto.randomBytes(10).toString("hex");

export const CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** Detects the real file type from magic bytes — the client-sent MIME type is not trusted. */
export function sniff(buf: Buffer): { kind: "video" | "image"; ext: string } | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { kind: "image", ext: ".jpg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { kind: "image", ext: ".png" };
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP")
    return { kind: "image", ext: ".webp" };
  if (buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12);
    return { kind: "video", ext: brand.startsWith("qt") ? ".mov" : ".mp4" };
  }
  if (buf.readUInt32BE(0) === 0x1a45dfa3) return { kind: "video", ext: ".webm" };
  return null;
}
