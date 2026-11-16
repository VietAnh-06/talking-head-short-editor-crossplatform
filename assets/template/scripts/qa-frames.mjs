// Render hàng loạt khung QA nhanh: bundle một lần, giữ một trình duyệt, renderStill từng khung (~0,3–1 s/khung).
// Dùng: node scripts/qa-frames.mjs <Composition> <thư-mục-ra> [--frames=12,40,95 | --every=15] [--variant=full|bare|both] [--scale=0.5]
//   full: video hoàn chỉnh; bare: --props {"qa":"bare"} (chỉ footage người nói + màu; khung B-roll ra đen).
// Ghi <thư-mục-ra>/<variant>-<khung 5 chữ số>.jpg và frames.json (danh sách khung, fps, kích thước) cho cut-strips.py / face-check.py.
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';
import {parseOptions, selectFrames} from './qa-options.mjs';

const [compId, outDir, ...rest] = process.argv.slice(2);
if (!compId || !outDir) {
  console.error('Dùng: node scripts/qa-frames.mjs <Composition> <thư-mục-ra> [--frames=..|--every=N] [--variant=both] [--scale=0.5]');
  process.exit(1);
}
const options = parseOptions(rest);
const {variants, scale} = options;
fs.mkdirSync(outDir, {recursive: true});
// Không để manifest của lần thành công trước làm bằng chứng cho lần đang lỗi.
fs.rmSync(path.join(outDir, 'frames.json'), {force: true});

// public/ (footage + B-roll, hàng GB) được symlink thay vì chép; bundle nằm trong out/qa/, không lấp /tmp (tmpfs trong RAM).
// Windows chỉ tạo symlink khi bật Developer Mode hoặc chạy quyền quản trị, nên ở đó chép public/ (chậm hơn, cần thêm chỗ trống).
const bundleRoot = path.resolve('out/qa');
fs.mkdirSync(bundleRoot, {recursive: true});
const bundleDir = fs.mkdtempSync(path.join(bundleRoot, '.bundle-'));
let browser;
try {
  const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), outDir: bundleDir, symlinkPublicDir: process.platform !== 'win32'});
  browser = await openBrowser('chrome');
  const comps = {};
  for (const v of variants) {
    comps[v] = await selectComposition({serveUrl, id: compId, inputProps: v === 'bare' ? {qa: 'bare'} : {}, puppeteerInstance: browser});
  }
  const {durationInFrames, fps, width, height} = comps[variants[0]];
  const frames = selectFrames(durationInFrames, options);

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
  fs.writeFileSync(path.join(outDir, 'frames.json'), JSON.stringify({composition: compId, fps, width: Math.round(width * scale), height: Math.round(height * scale), frames, variants}, null, 2));
  console.log(`${frames.length} khung × ${variants.length} bản → ${outDir}`);
} finally {
  try {
    await browser?.close({silent: true});
  } finally {
    if (path.dirname(bundleDir) !== bundleRoot) throw new Error('Bundle nằm ngoài thư mục QA');
    fs.rmSync(bundleDir, {recursive: true, force: true});
  }
}
