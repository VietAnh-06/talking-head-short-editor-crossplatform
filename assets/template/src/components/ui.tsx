import React from 'react';
import {Img, interpolate, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {Audio} from '@remotion/media';
import {COLORS, FONT, SAFE} from '../theme';
import {useSpring} from './motion-text';

export type Sfx = 'whoosh' | 'riser' | 'impact' | 'pop' | 'chime';

export const SfxAt: React.FC<{at: number; name: Sfx; volume?: number}> = ({at, name, volume = 0.5}) => (
  <Sequence from={Math.max(0, at)} layout="none">
    <Audio src={staticFile(`audio/sfx-${name}.wav`)} volume={volume} />
  </Sequence>
);

export const Stack: React.FC<{top?: number; bottom?: number; gap?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({
  top = 330,
  bottom,
  gap = 28,
  children,
  style,
}) => (
  <div
    style={{
      position: 'absolute',
      left: SAFE.side,
      right: SAFE.side,
      top,
      bottom,
      display: 'flex',
      flexDirection: 'column',
      gap,
      ...style,
    }}
  >
    {children}
  </div>
);

export const LogoCard: React.FC<{src: string; width: number; at: number; padding?: string}> = ({src, width, at, padding = '26px 40px'}) => {
  const s = useSpring(at, {damping: 14, stiffness: 160});
  return (
    <div
      style={{
        background: COLORS.white,
        borderRadius: 28,
        padding,
        boxShadow: '0 30px 70px rgba(6,26,46,0.22), 0 2px 6px rgba(6,26,46,0.08)',
        transform: `translateY(${interpolate(s, [0, 1], [60, 0])}px) scale(${interpolate(s, [0, 1], [0.85, 1])})`,
        opacity: interpolate(s, [0, 0.3], [0, 1], {extrapolateRight: 'clamp'}),
        display: 'inline-flex',
      }}
    >
      <Img src={staticFile(`img/${src}`)} style={{width, height: 'auto', display: 'block'}} />
    </div>
  );
};

export const CheckIcon: React.FC<{at: number; size?: number}> = ({at, size = 64}) => {
  const frame = useCurrentFrame();
  const s = useSpring(at, {damping: 12, stiffness: 200});
  const draw = interpolate(frame, [at + 4, at + 16], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flex: 'none',
        background: interpolate(s, [0, 1], [0, 1]) > 0.05 ? COLORS.blue : 'transparent',
        border: `3px solid ${s > 0.05 ? COLORS.blue : 'rgba(255,255,255,0.5)'}`,
        transform: `scale(${interpolate(s, [0, 1], [0.6, 1])})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: s > 0.05 ? '0 10px 30px rgba(28,117,188,0.55)' : 'none',
      }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24">
        <path
          d="M4 12.5l5 5L20 6.5"
          fill="none"
          stroke="white"
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={draw}
        />
      </svg>
    </div>
  );
};

export const Glass: React.FC<{children: React.ReactNode; style?: React.CSSProperties; light?: boolean}> = ({children, style, light = false}) => (
  <div
    style={{
      background: light ? 'rgba(255,255,255,0.97)' : 'rgba(10,32,56,0.62)',
      border: light ? 'none' : '1.5px solid rgba(255,255,255,0.16)',
      backdropFilter: light ? undefined : 'blur(18px)',
      borderRadius: 28,
      boxShadow: light ? '0 24px 60px rgba(6,26,46,0.35)' : '0 24px 60px rgba(0,0,0,0.35)',
      fontFamily: FONT,
      ...style,
    }}
  >
    {children}
  </div>
);
