/**
 * Generates BUBER's sample media (abstract beauty art — clearly marked as sample content).
 * Renders deterministic canvas frames in headless Chromium and encodes them with ffmpeg.
 *
 *   npm run media:generate            # all assets → sample-media/
 *   npm run media:generate -- --preview  # one still per scene → sample-media/preview/
 */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve("sample-media");
const FPS = 24;
const SECONDS = 7;

type Palette = Record<string, unknown>;
type ArtWindow = Window & { render: (scene: string, t: number, palette: Palette, w: number, h: number) => void };

export const PALETTES: Record<string, Palette> = {
  nude: { bg1: "#e9d8c4", bg2: "#b48f6e", skin: "#e8c4a6", skinDark: "#b98a6a", polish: ["#e7c3b3", "#d7a693", "#b98575"] },
  burgundy: { bg1: "#3a2420", bg2: "#140b09", skin: "#c99a7c", skinDark: "#8a5f47", polish: ["#7a1d2c", "#4d0f1a", "#2a060c"], spark: "rgba(255,210,200,0.9)" },
  chrome: { bg1: "#d9cfc6", bg2: "#7d6c60", skin: "#e2b996", skinDark: "#a77b5c", polish: ["#f4efe9", "#b9b1ab", "#efe7dc"] },
  french: { bg1: "#f1e6da", bg2: "#c6a88d", skin: "#e9c7aa", skinDark: "#b78c6c", polish: ["#f2d9d0", "#ebcbc0", "#e2bdb2"], french: true },
  honey: { bg1: "#2a1a12", bg2: "#0f0805", root: "#2b1a12", mid: "#7a4a26", ends: "#e2b278", seed: 3 },
  copper: { bg1: "#2d1810", bg2: "#110805", root: "#3b1d10", mid: "#9a4a22", ends: "#e59a63", seed: 8 },
  ash: { bg1: "#e7ddd2", bg2: "#9d8c7c", root: "#4a3b30", mid: "#9a8573", ends: "#efe3d3", seed: 13 },
  espresso: { bg1: "#1c1210", bg2: "#070403", root: "#120a07", mid: "#3d261a", ends: "#8a6044", seed: 21 },
  barber: { bg1: "#211612", bg2: "#0b0706", dot: "40,28,22", accent: "#b8875a" },
  barberLight: { bg1: "#efe5da", bg2: "#c2a78e", dot: "45,30,22", accent: "#6b4a33" },
  rose: { bg1: "#ead7cf", bg2: "#a77d70", pans: ["#c98e86", "#e6c2a6", "#9c5b5b", "#d9a98a", "#b9786b", "#f0d6c1", "#8e5a4c", "#c7a07a", "#a8686a"] },
  bronze: { bg1: "#2b1d16", bg2: "#0e0806", pans: ["#b9874f", "#e5c08f", "#7d4a2b", "#d29d6a", "#9e6b3f", "#f2d7ae", "#5e3620", "#c8955d", "#8a5a35"] },
  lashSoft: { bg1: "#ecd8c8", bg2: "#b48c74", liner: "#2a1a14", brow: "#5a3d2e" },
  lashDeep: { bg1: "#c49a80", bg2: "#6e4a38", liner: "#170d09", brow: "#3a2519" },
};

/** Every sample asset: name → scene + palette. */
export const VIDEOS: { name: string; scene: string; palette: string }[] = [
  { name: "nails-nude", scene: "nails", palette: "nude" },
  { name: "nails-burgundy", scene: "nails", palette: "burgundy" },
  { name: "nails-chrome", scene: "nails", palette: "chrome" },
  { name: "nails-french", scene: "nails", palette: "french" },
  { name: "hair-honey", scene: "hair", palette: "honey" },
  { name: "hair-copper", scene: "hair", palette: "copper" },
  { name: "hair-ash", scene: "hair", palette: "ash" },
  { name: "blowout-honey", scene: "blowout", palette: "honey" },
  { name: "blowout-espresso", scene: "blowout", palette: "espresso" },
  { name: "braid-honey", scene: "braid", palette: "honey" },
  { name: "braid-ash", scene: "braid", palette: "ash" },
  { name: "fade-dark", scene: "fade", palette: "barber" },
  { name: "fade-light", scene: "fade", palette: "barberLight" },
  { name: "makeup-rose", scene: "palette", palette: "rose" },
  { name: "makeup-bronze", scene: "palette", palette: "bronze" },
  { name: "lashes-soft", scene: "lashes", palette: "lashSoft" },
  { name: "lashes-deep", scene: "lashes", palette: "lashDeep" },
];

export const COVERS: { name: string; scene: string; palette: string }[] = [
  { name: "cover-nails", scene: "nails", palette: "nude" },
  { name: "cover-hair", scene: "hair", palette: "honey" },
  { name: "cover-barber", scene: "fade", palette: "barber" },
  { name: "cover-blowout", scene: "blowout", palette: "copper" },
  { name: "cover-makeup", scene: "palette", palette: "rose" },
  { name: "cover-lashes", scene: "lashes", palette: "lashSoft" },
  { name: "cover-braid", scene: "braid", palette: "ash" },
];

function encode(args: string[]) {
  const p = spawn("ffmpeg", args, { stdio: ["pipe", "ignore", "inherit"] });
  const done = new Promise<void>((res, rej) => p.on("close", (c) => (c === 0 ? res() : rej(new Error("ffmpeg " + c)))));
  return { stdin: p.stdin, done };
}

async function toWebm(mp4: string) {
  const webm = mp4.replace(/\.mp4$/, ".webm");
  if (fs.existsSync(webm)) return;
  const enc = encode(["-y", "-loglevel", "error", "-i", mp4, "-c:v", "libvpx-vp9", "-b:v", "700k", "-deadline", "good", "-cpu-used", "4", "-row-mt", "1", "-an", webm]);
  enc.stdin.end();
  await enc.done;
}

async function main() {
  const preview = process.argv.includes("--preview");
  fs.mkdirSync(path.join(OUT, preview ? "preview" : ""), { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("file://" + path.resolve("scripts/sample-art.html"));

  const still = async (scene: string, palette: string, t: number, w: number, h: number, file: string) => {
    await page.evaluate(([s, p, tt, ww, hh]) => (window as unknown as ArtWindow).render(s, tt, p, ww, hh), [scene, PALETTES[palette], t, w, h] as const);
    const data = await page.evaluate(() => (document.getElementById("c") as HTMLCanvasElement).toDataURL("image/jpeg", 0.9));
    fs.writeFileSync(file, Buffer.from(data.split(",")[1], "base64"));
  };

  if (preview) {
    for (const v of VIDEOS) await still(v.scene, v.palette, 1.3, 540, 960, path.join(OUT, "preview", v.name + ".jpg"));
    await browser.close();
    return;
  }

  for (const v of VIDEOS) {
    const file = path.join(OUT, `${v.name}.mp4`);
    if (fs.existsSync(file)) {
      await toWebm(file);
      continue;
    }
    const enc = encode([
      "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
      "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-pix_fmt", "yuv420p", "-movflags", "+faststart", file,
    ]);
    for (let f = 0; f < FPS * SECONDS; f++) {
      const t = f / FPS;
      await page.evaluate(([s, p, tt]) => (window as unknown as ArtWindow).render(s, tt, p, 540, 960), [v.scene, PALETTES[v.palette], t] as const);
      const data = await page.evaluate(() => (document.getElementById("c") as HTMLCanvasElement).toDataURL("image/jpeg", 0.92));
      if (!enc.stdin.write(Buffer.from(data.split(",")[1], "base64"))) await new Promise((r) => enc.stdin.once("drain", r));
    }
    enc.stdin.end();
    await enc.done;
    await still(v.scene, v.palette, 1.2, 540, 960, path.join(OUT, `${v.name}.jpg`));
    await toWebm(file);
    console.log("video", v.name);
  }
  for (const c of COVERS) {
    await still(c.scene, c.palette, 2.1, 1600, 900, path.join(OUT, `${c.name}.jpg`));
    await still(c.scene, c.palette, 3.4, 1080, 1080, path.join(OUT, `${c.name.replace("cover", "square")}.jpg`));
  }
  console.log("covers done");
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
