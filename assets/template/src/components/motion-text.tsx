import React from 'react';
import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, FONT} from '../theme';

export const useSpring = (at: number, config: {damping?: number; stiffness?: number; mass?: number} = {}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: frame - at, fps, config: {damping: 18, stiffness: 140, mass: 0.9, ...config}});
};

export const useFade = (at: number, duration = 12) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [at, at + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
};

type RevealProps = {
  text: string;
  at: number;
  size: number;
  weight?: number;
  color?: string;
  stagger?: number;
  highlight?: string[];
  highlightColor?: string;
  align?: 'left' | 'center';
  lineHeight?: number;
  letterSpacing?: number;
  style?: React.CSSProperties;
};

// Từng từ trồi lên khỏi mặt nạ, trễ nhau vài khung hình: kiểu chữ của quảng cáo cao cấp.
// Mặt nạ chừa 0,32 cỡ chữ phía trên cho dấu chồng tiếng Việt (Ắ, Ằ, Ấ… ở font cao như Anton) và 0,24 phía dưới cho dấu nặng (Ẹ, Ạ ở Alfa Slab); 0,12 cũ xén mất dấu
export const MaskReveal: React.FC<RevealProps> = ({
  text,
  at,
  size,
  weight = 800,
  color = COLORS.white,
  stagger = 2.5,
  highlight = [],
  highlightColor = COLORS.sky,
  align = 'left',
  lineHeight = 1.18,
  letterSpacing = -0.02,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const words = text.replace(/\n/g, ' \n ').split(' ').filter(Boolean);
  return (
    <div
      style={{
        fontFamily: FONT,
        fontWeight: weight,
        fontSize: size,
        lineHeight,
        letterSpacing: `${letterSpacing}em`,
        color,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        columnGap: size * 0.26,
        ...style,
      }}
    >
      {words.map((w, i) => {
        if (w === '\n') return <div key={`br-${i}`} style={{flexBasis: '100%', height: 0}} />;
        const s = spring({frame: frame - at - i * stagger, fps, config: {damping: 20, stiffness: 170, mass: 0.8}});
        const clean = w.replace(/[.,:?!]+$/, '');
        const isHi = highlight.some((h) => h.replace(/[.,:?!]+$/, '') === clean);
        return (
          <span
            key={`${w}-${i}`}
            style={{display: 'inline-block', overflow: 'hidden', paddingBottom: size * 0.24, marginBottom: -size * 0.24, paddingTop: size * 0.32, marginTop: -size * 0.32}}
          >
            <span
              style={{
                display: 'inline-block',
                transform: `translateY(${interpolate(s, [0, 1], [110, 0])}%) rotate(${interpolate(s, [0, 1], [4, 0])}deg)`,
                opacity: interpolate(s, [0, 0.3, 1], [0, 1, 1]),
                color: isHi ? highlightColor : undefined,
              }}
            >
              {w}
            </span>
          </span>
        );
      })}
    </div>
  );
};

export const Kicker: React.FC<{text: string; at: number; dark?: boolean}> = ({text, at, dark = true}) => {
  const s = useSpring(at);
  const line = interpolate(s, [0, 1], [0, 56]);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        opacity: s,
        transform: `translateX(${interpolate(s, [0, 1], [-30, 0])}px)`,
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: 30,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: dark ? 'rgba(255,255,255,0.88)' : COLORS.blueDark,
      }}
    >
      <div style={{width: line, height: 4, background: COLORS.red, borderRadius: 2}} />
      {text}
    </div>
  );
};

export const CountUp: React.FC<{to: number; at: number; duration?: number; suffix?: string; style?: React.CSSProperties}> = ({
  to,
  at,
  duration = 28,
  suffix = '',
  style,
}) => {
  const frame = useCurrentFrame();
  const v = interpolate(frame, [at, at + duration], [0, to], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.exp),
  });
  return (
    <span style={{fontVariantNumeric: 'tabular-nums', ...style}}>
      {Math.round(v)}
      {suffix}
    </span>
  );
};
