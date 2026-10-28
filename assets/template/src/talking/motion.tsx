import React from 'react';
import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Circle, Highlight} from '@remotion/rough-notation';

// Chuyển động chung cho overlay (references/motion-design.md của skill): vào bằng 2-3 thuộc tính, lệch nhịp, ra nhanh hơn vào,
// đứng lâu thì "thở" nhẹ, số đếm bằng lò xo. Mọi mốc tính theo khung tuyệt đối của video (frame của Sequence cha nếu có).
export const SPRING = {
  smooth: {damping: 200, stiffness: 120, mass: 1},
  snappy: {damping: 18, stiffness: 220, mass: 0.8},
  pop: {damping: 12, stiffness: 260, mass: 0.7},
} as const;
export const EASE = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  in: Easing.bezier(0.7, 0, 0.84, 0),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
};
export const STAGGER = {word: 3, row: 4, chip: 3, block: 6} as const;
export const EXIT_FRAMES = 8;
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// Lệch nhịp: mốc vào của phần tử thứ i
export const stagger = (at: number, i: number, step: number = STAGGER.row) => at + i * step;

// Tiến độ vào 0→1 (lò xo) tại mốc `at`
export const useEnter = (at: number, preset: keyof typeof SPRING = 'snappy') => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: frame - at, fps, config: SPRING[preset]});
};

// Vào bằng mờ→rõ + trồi lên + phóng nhẹ; `from` đổi hướng trồi (px âm: rơi từ trên xuống)
export const enterStyle = (p: number, rise = 36, scaleFrom = 0.94): React.CSSProperties => ({
  opacity: interpolate(p, [0, 0.35], [0, 1], clamp),
  transform: `translateY(${interpolate(p, [0, 1], [rise, 0])}px) scale(${interpolate(p, [0, 1], [scaleFrom, 1])})`,
});

export const useEntrance = (at: number, opts: {rise?: number; scaleFrom?: number; preset?: keyof typeof SPRING} = {}) =>
  enterStyle(useEnter(at, opts.preset), opts.rise, opts.scaleFrom);

// Ra trong EXIT_FRAMES khung cuối trước `to`: mờ + trượt lên, nhanh hơn lúc vào
export const exitStyle = (frame: number, to: number, frames = EXIT_FRAMES): React.CSSProperties => {
  const q = interpolate(frame, [to - frames, to], [0, 1], {...clamp, easing: EASE.in});
  return {opacity: 1 - q, transform: `translateY(${-28 * q}px) scale(${1 - 0.03 * q})`};
};

// "Thở" khi đứng yên > 2 s: nổi 3 px và phóng 1,2 %, mỗi phần tử một pha (seed) để không đồng loạt
export const breathe = (frame: number, seed = 0, amp = 1): React.CSSProperties => ({
  transform: `translateY(${Math.sin(frame / 30 + seed * 1.7) * 3 * amp}px) scale(${1 + Math.sin(frame / 24 + seed) * 0.012 * amp})`,
});

// Đếm số bằng lò xo (không tuyến tính), dùng với fontVariantNumeric: 'tabular-nums'
export const useCounter = (at: number, from: number, to: number) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: frame - at, fps, config: {damping: 30, stiffness: 60}});
  return interpolate(p, [0, 1], [from, to]);
};

// Nét bút dạ quang / khoanh tròn vẽ tay (rough-notation) chạy trong `frames` khung từ `at`; nét nằm dưới chữ
const draw = (frame: number, at: number, frames: number) => interpolate(frame, [at, at + frames], [0, 1], {...clamp, easing: EASE.inOut});
export const MarkerHighlight: React.FC<{at: number; color: string; frames?: number; seed?: number; children: React.ReactNode}> = ({at, color, frames = 12, seed = 3, children}) => {
  const frame = useCurrentFrame();
  return (
    <Highlight progress={draw(frame, at, frames)} color={color} seed={seed} iterations={1} padding={{left: 6, right: 6, top: 0, bottom: 0}}>
      {children}
    </Highlight>
  );
};
export const MarkerCircle: React.FC<{at: number; color: string; frames?: number; seed?: number; strokeWidth?: number; children: React.ReactNode}> = ({at, color, frames = 14, seed = 5, strokeWidth = 5, children}) => {
  const frame = useCurrentFrame();
  return (
    <Circle progress={draw(frame, at, frames)} color={color} seed={seed} strokeWidth={strokeWidth} iterations={2} padding={{left: 12, right: 12, top: 2, bottom: 6}}>
      {children}
    </Circle>
  );
};
