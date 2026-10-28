// Render hàng loạt khung QA nhanh: bundle một lần, giữ một trình duyệt, renderStill từng khung (~0,3–1 s/khung).
// Dùng: node scripts/qa-frames.mjs <Composition> <thư-mục-ra> [--frames=12,40,95 | --every=15] [--variant=full|bare|both] [--scale=0.5]
//   full: video hoàn chỉnh; bare: --props {"qa":"bare"} (chỉ footage người nói + màu; khung B-roll ra đen).
// Ghi <thư-mục-ra>/<variant>-<khung 5 chữ số>.jpg và frames.json (danh sách khung, fps, kích thước) cho cut-strips.py / face-check.py.
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';

const [compId, outDir, ...rest] = process.argv.slice(2);
if (!compId || !outDir) {
  console.error('Dùng: node scripts/qa-frames.mjs <Composition> <thư-mục-ra> [--frames=..|--every=N] [--variant=both] [--scale=0.5]');
  process.exit(1);
}
const opt = Object.fromEntries(rest.map((a) => a.replace(/^--/, '').split('=')));
const variants = (opt.variant ?? 'both') === 'both' ? ['full', 'bare'] : [opt.variant];
const scale = Number(opt.scale ?? 0.5);
fs.mkdirSync(outDir, {recursive: true});

// public/ (footage + B-roll, hàng GB) được symlink thay vì chép; bundle nằm trong out/qa/, không lấp /tmp (tmpfs trong RAM).
// Windows chỉ tạo symlink khi bật Developer Mode hoặc chạy quyền quản trị, nên ở đó chép public/ (chậm hơn, cần thêm chỗ trống).
const bundleDir = path.resolve('out/qa/.bundle');
fs.rmSync(bundleDir, {recursive: true, force: true});
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), outDir: bundleDir, symlinkPublicDir: process.platform !== 'win32'});
const browser = await openBrowser('chrome');
const comps = {};
for (const v of variants) {
  comps[v] = await selectComposition({serveUrl, id: compId, inputProps: v === 'bare' ? {qa: 'bare'} : {}, puppeteerInstance: browser});
}
const {durationInFrames, fps, width, height} = comps[variants[0]];
const frames = opt.frames
  ? opt.frames.split(',').map(Number).filter((f) => f >= 0 && f < durationInFrames)
  : Array.from({length: Math.floor(durationInFrames / Number(opt.every ?? 15))}, (_, i) => i * Number(opt.every ?? 15));

let done = 0;
for (const frame of frames) {
  for (const v of variants) {
    await renderStill({
      serveUrl,
      composition: comps[v],
      frame,
      output: path.join(outDir, `${v}-${String(frame).padStart(5, '0')}.jpg`),
      imageFormat: 'jpeg',
      jpegQuality: 85,
      scale,
      inputProps: v === 'bare' ? {qa: 'bare'} : {},
      puppeteerInstance: browser,
      timeoutInMilliseconds: 120000,
    });
  }
  if (++done % 20 === 0) console.error(`${done}/${frames.length} khung`);
}
await browser.close({silent: true});
fs.writeFileSync(path.join(outDir, 'frames.json'), JSON.stringify({composition: compId, fps, width: Math.round(width * scale), height: Math.round(height * scale), frames, variants}, null, 2));
console.log(`${frames.length} khung × ${variants.length} bản → ${outDir}`);
