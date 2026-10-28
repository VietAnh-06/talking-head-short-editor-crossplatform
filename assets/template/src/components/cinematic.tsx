import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, random, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS} from '../theme';

type KenBurnsProps = {
  src: string;
  from?: number;
  to?: number;
  panX?: [number, number];
  panY?: [number, number];
  focusX?: number;
  grade?: 'night' | 'mute' | 'warm' | 'none';
  blur?: number;
};

const GRADES: Record<NonNullable<KenBurnsProps['grade']>, string> = {
  night: 'saturate(0.85) contrast(1.08) brightness(0.72)',
  mute: 'saturate(0.35) contrast(1.05) brightness(0.62)',
  warm: 'saturate(1.08) contrast(1.04) brightness(0.92) sepia(0.08)',
  none: 'none',
};

// Ảnh ngang 3:2 đặt vào khung dọc: phóng to và trượt chậm theo kiểu Ken Burns
export const KenBurns: React.FC<KenBurnsProps> = ({
  src,
  from = 1.08,
  to = 1.2,
  panX = [0, -40],
  panY = [0, 0],
  focusX = 50,
  grade = 'night',
  blur = 0,
}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const p = interpolate(frame, [0, durationInFrames], [0, 1], {
    easing: Easing.bezier(0.33, 0, 0.2, 1),
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(p, [0, 1], [from, to]);
  const x = interpolate(p, [0, 1], panX);
  const y = interpolate(p, [0, 1], panY);
  return (
    <AbsoluteFill style={{overflow: 'hidden', backgroundColor: COLORS.night}}>
      <Img
        src={staticFile(`img/${src}`)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: `${focusX}% 50%`,
          transform: `translate(${x}px, ${y}px) scale(${scale})`,
          filter: `${GRADES[grade]}${blur ? ` blur(${blur}px)` : ''}`,
        }}
      />
    </AbsoluteFill>
  );
};

export const Shade: React.FC<{strength?: number; top?: number}> = ({strength = 0.85, top = 0.35}) => (
  <AbsoluteFill
    style={{
      background: `linear-gradient(180deg, rgba(6,26,46,${top}) 0%, rgba(6,26,46,0.05) 30%, rgba(6,26,46,${strength * 0.7}) 62%, rgba(6,26,46,${strength}) 100%)`,
    }}
  />
);

export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background: 'radial-gradient(ellipse 85% 70% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)',
      pointerEvents: 'none',
    }}
  />
);

// Hạt phim động: đổi seed mỗi 2 khung hình, rất nhẹ để không làm bẩn chữ
export const Grain: React.FC<{opacity?: number}> = ({opacity = 0.07}) => {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 2) % 12;
  return (
    <AbsoluteFill style={{opacity, mixBlendMode: 'overlay', pointerEvents: 'none'}}>
      <svg width="100%" height="100%">
        <filter id={`grain-${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};

// Vệt sáng quét qua khi chuyển cảnh / khi đồ họa chính xuất hiện
export const LightSweep: React.FC<{at: number; duration?: number; color?: string; angle?: number}> = ({
  at,
  duration = 26,
  color = 'rgba(143,208,255,0.55)',
  angle = 115,
}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + duration], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  if (p <= 0 || p >= 1) return null;
  const pos = interpolate(p, [0, 1], [-60, 160], {easing: Easing.inOut(Easing.quad)});
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${angle}deg, transparent ${pos - 18}%, ${color} ${pos}%, transparent ${pos + 18}%)`,
        mixBlendMode: 'screen',
        opacity: Math.sin(p * Math.PI),
        pointerEvents: 'none',
      }}
    />
  );
};

// Đốm sáng trôi chậm (bokeh) cho nền tối, tạo chiều sâu
export const Bokeh: React.FC<{count?: number; seed?: string; color?: string}> = ({
  count = 14,
  seed = 'bokeh',
  color = '143,208,255',
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {Array.from({length: count}).map((_, i) => {
        const x = random(`${seed}-x-${i}`) * 1080;
        const y0 = random(`${seed}-y-${i}`) * 1920;
        const size = 40 + random(`${seed}-s-${i}`) * 160;
        const speed = 0.25 + random(`${seed}-v-${i}`) * 0.6;
        const alpha = 0.05 + random(`${seed}-a-${i}`) * 0.12;
        const y = (y0 - frame * speed + 2200) % 2200 - 140;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x - size / 2,
              top: y,
              width: size,
              height: size,
              borderRadius: '50%',
              background: `radial-gradient(circle, rgba(${color},${alpha}) 0%, rgba(${color},0) 70%)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// Lưới kẻ tóc mờ dần + chỉ đỏ mảnh trên cùng: motif hero của website
export const HairlineGrid: React.FC<{dark?: boolean}> = ({dark = false}) => (
  <AbsoluteFill style={{pointerEvents: 'none'}}>
    <AbsoluteFill
      style={{
        backgroundImage: `linear-gradient(${dark ? 'rgba(255,255,255,0.06)' : 'rgba(28,117,188,0.08)'} 1px, transparent 1px), linear-gradient(90deg, ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(28,117,188,0.08)'} 1px, transparent 1px)`,
        backgroundSize: '90px 90px',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, black 20%, transparent 80%)',
        maskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, black 20%, transparent 80%)',
      }}
    />
    <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: COLORS.red}} />
  </AbsoluteFill>
);
