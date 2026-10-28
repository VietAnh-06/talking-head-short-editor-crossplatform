import React from 'react';
import {interpolate, Sequence, staticFile} from 'remotion';
import {Audio} from '@remotion/media';
import library from './sfx-library.json';
import meta from './sfx-meta.json';
import {useEdit} from './edit-data';

// Thư viện SFX Mixkit (giấy phép Mixkit Free), tải bằng uv run scripts/fetch-mixkit-sfx.py.
// SFX một lần dùng bản chuẩn hóa theo độ to cảm nhận (scripts/normalize-sfx.py → sfx-norm/, RMS 100 ms = −12 dBFS) để cùng
// volume cho cùng độ to; âm nền dùng bản gốc (sfx/).
export type SfxName = keyof typeof library;

const src = (name: SfxName) => staticFile(`sfx/${name}.mp3`);
const oneShot = (name: SfxName) => staticFile(`sfx-norm/${name}.mp3`);

// Mức SFX so với giọng (đỉnh giọng ≈ −19, trung vị ≈ −22 dBFS RMS 100 ms): volume 0,3 × SFX_GAIN ≈ −18 dBFS khi thầy nghỉ (ngang đỉnh giọng), ≈ −23 dBFS khi
// thầy đang nói (ducking theo phụ đề) — rõ như short viral mà không che chữ. Ducking 0,4 cũ làm SFX mất hút (−20 dB dưới giọng).
const SFX_GAIN = 1.6;
const DUCK = 0.6;

// Canh tiếng theo hình (sfx-meta.json do normalize-sfx.py ghi): 'onset' bỏ khoảng lặng đầu file để âm bật đúng khung `at`;
// 'peak' cho đỉnh âm rơi đúng `at` (chuyển cảnh: tiếng "vút" mạnh nhất đúng nhát cắt), phát sớm tối đa 0,6 s.
// Mặc định 'start': đồ họa/hit neo vào chữ (bật 0,12 s trước chữ), bỏ khoảng lặng đầu file thì đỉnh âm rơi đúng phụ âm đầu
// và che nó (clip-12: "LETCO" → "NETCO", "Ký" → "Chỉ"); khoảng lặng đầu file là độ trễ tự nhiên giữ chữ rõ.
export type SfxAlign = 'start' | 'onset' | 'peak';
const MAX_LEAD = 0.6;
const leadFrames = (name: SfxName, align: SfxAlign) => {
  const m = (meta as Record<string, {onset: number; peak: number}>)[name];
  if (!m || align === 'start') return 0;
  return Math.round((align === 'peak' ? Math.min(m.peak, MAX_LEAD) : Math.min(m.onset, MAX_LEAD)) * 30);
};

export const Sfx: React.FC<{at: number; name: SfxName; volume?: number; align?: SfxAlign}> = ({at, name, volume = 0.4, align = 'start'}) => {
  const {voiceAt} = useEdit();
  const start = Math.max(0, at - leadFrames(name, align));
  return (
    <Sequence from={start} layout="none">
      <Audio src={oneShot(name)} volume={(f) => Math.min(1, volume * SFX_GAIN * (voiceAt(start + f) ? DUCK : 1))} />
    </Sequence>
  );
};

// Âm nền theo cảnh (phố, quán ăn, văn phòng...): rất nhỏ dưới giọng thầy, vào/ra mềm
export const Ambience: React.FC<{from: number; to: number; name: SfxName; volume?: number}> = ({from, to, name, volume = 0.1}) => {
  const len = to - from;
  if (len < 3) return null;
  // vào/ra 8 khung, co lại ở cảnh ngắn để dải nội suy luôn tăng dần
  const fade = Math.min(8, Math.floor((len - 1) / 2));
  return (
    <Sequence from={from} durationInFrames={len} layout="none">
      <Audio src={src(name)} volume={(f) => volume * interpolate(f, [0, fade, len - fade, len], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})} />
    </Sequence>
  );
};

// Chuyển cảnh xoay vòng nhiều tiếng khác nhau để không lặp lại
const WHIP: SfxName[] = ['whoosh-cinematic', 'swoosh-fast', 'sweep-air', 'whoosh-fast', 'sweep-small', 'swoosh-flying', 'sweep-fast', 'slide-tech'];
const ZOOM: SfxName[] = ['zoom-impact', 'zoom-vacuum', 'swoosh-vacuum', 'impact-whoosh'];
export const transitionSfx = (kind: 'whip' | 'zoom', index: number): SfxName => (kind === 'whip' ? WHIP : ZOOM)[index % (kind === 'whip' ? WHIP.length : ZOOM.length)];

const POPS: SfxName[] = ['pop-explainer', 'pop-dry', 'pop-bubble', 'pop-long', 'pop-hard', 'click-interface'];
export const popSfx = (index: number): SfxName => POPS[index % POPS.length];
