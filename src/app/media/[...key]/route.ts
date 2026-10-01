import path from "node:path";
import { Readable } from "node:stream";
import { CONTENT_TYPES, safeKey, storage } from "@/server/storage";

/** Serves stored media with HTTP Range support so videos can seek and stream. */
export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await params;
  let key: string;
  try {
    key = safeKey(parts.join("/"));
  } catch {
    return new Response("Not found", { status: 404 });
  }
  // Originals are private inputs to processing and are never served.
  if (/\/original\.[a-z0-9]+$/.test(key)) return new Response("Not found", { status: 404 });
  const st = await storage.stat(key);
  if (!st) return new Response("Not found", { status: 404 });
  const type = CONTENT_TYPES[path.extname(key).toLowerCase()] ?? "application/octet-stream";
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=86400",
  };
  const range = req.headers.get("range");
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      let start = m[1] ? Number(m[1]) : 0;
      let end = m[2] ? Number(m[2]) : st.size - 1;
      if (!m[1] && m[2]) {
        start = Math.max(0, st.size - Number(m[2]));
        end = st.size - 1;
      }
      end = Math.min(end, st.size - 1);
      if (start > end || start >= st.size) {
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${st.size}` } });
      }
      const stream = Readable.toWeb(storage.stream(key, { start, end }) as Readable) as ReadableStream;
      return new Response(stream, {
        status: 206,
        headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${st.size}`, "Content-Length": String(end - start + 1) },
      });
    }
  }
  const stream = Readable.toWeb(storage.stream(key) as Readable) as ReadableStream;
  return new Response(stream, { headers: { ...headers, "Content-Length": String(st.size) } });
}
