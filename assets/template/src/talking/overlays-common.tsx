import React from 'react';
import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useStyle} from './style';
import {FPS, useEdit} from './edit-data';

export const YELLOW = '#FFD84D';
export const STROKE = '0 0 3px #000, 0 4px 0 rgba(0,0,0,0.85), 0 8px 30px rgba(0,0,0,0.6)';

// Khung hiện/ẩn: vào bằng spring, ra bằng trượt + mờ trong 8 khung cuối
export const useWindow = (from: number, to: number) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: frame - from, fps, config: {damping: 15, stiffness: 190, mass: 0.8}});
  const exit = interpolate(frame, [to - 8, to], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic)});
  return {visible: frame >= from && frame < to, enter, exit, frame};
};

// Câu hỏi hiện thành thẻ bình luận, chữ sáng dần theo lời đọc (định dạng "trả lời bình luận")
export const CommentCard: React.FC<{header: [string, string]}> = ({header}) => {
  const {cue, wordsBetween} = useEdit();
  const st = useStyle();
  const from = cue('coldEnd');
  const to = cue('questionEnd') + 4;
  if (cue('questionEnd') <= from) return null;
  const {visible, enter, exit, frame} = useWindow(from - 4, to);
  if (!visible) return null;
  const t = frame / FPS;
  const words = wordsBetween(from / FPS, cue('questionEnd') / FPS - 0.15);
  return (
    <div
      style={{
        position: 'absolute',
        top: 270,
        left: 64,
        right: 64,
        transform: `translateY(${interpolate(enter, [0, 1], [-80, 0])}px) scale(${interpolate(enter, [0, 1], [0.9, 1])})`,
        opacity: Math.min(enter, exit),
      }}
    >
      <div
        style={{
          background: st.palette.surface,
          borderRadius: st.caption === 'box' ? 6 : 30,
          padding: '28px 34px 32px',
          boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
          fontFamily: st.fonts.body,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 18, marginBottom: 14}}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: st.palette.accent,
              color: st.palette.bg,
              fontWeight: 800,
              fontSize: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ?
          </div>
          <div>
            <div style={{fontWeight: 700, fontSize: 30, color: st.palette.textOnSurface, opacity: 0.6}}>{header[0]}</div>
            <div style={{fontWeight: 800, fontSize: 36, color: st.palette.textOnSurface}}>{header[1]}</div>
          </div>
        </div>
        <div style={{fontWeight: 700, fontSize: 46, lineHeight: 1.38, color: st.palette.textOnSurface}}>
          {words.map((w, i) => (
            <span key={i} style={{opacity: t >= w.start - 0.02 ? 1 : 0.14, color: w.emph ? st.palette.accent2 === st.palette.textOnSurface ? st.palette.accent : st.palette.accent2 : undefined}}>
              {w.text}{' '}
            </span>
          ))}
        </div>
      </div>
      <div style={{width: 0, height: 0, marginLeft: 80, borderLeft: '22px solid transparent', borderRight: '22px solid transparent', borderTop: `24px solid ${st.palette.surface}`}} />
    </div>
  );
};

export const ChapterCard: React.FC<{at: number; index: number; title: string; label: string}> = ({at, index, title, label}) => {
  const st = useStyle();
  const {visible, enter, exit} = useWindow(at, at + 80);
  if (!visible) return null;
  return (
    <div
      style={{
        position: 'absolute',
        top: 300,
        left: 0,
        display: 'flex',
        alignItems: 'stretch',
        transform: `translateX(${interpolate(enter, [0, 1], [-700, 0])}px)`,
        opacity: exit,
        filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.45))',
      }}
    >
      <div
        style={{
          background: st.palette.accent,
          color: st.palette.bg,
          fontFamily: st.fonts.display,
          fontWeight: 800,
          fontSize: 92,
          padding: '6px 30px 12px 64px',
          letterSpacing: '-0.03em',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {String(index).padStart(2, '0')}
      </div>
      <div style={{background: st.palette.surface, padding: '18px 40px 22px 32px', borderTopRightRadius: 24, borderBottomRightRadius: 24}}>
        <div style={{fontFamily: st.fonts.body, fontWeight: 700, fontSize: 28, letterSpacing: '0.14em', color: st.palette.accent2 === st.palette.textOnSurface ? st.palette.accent : st.palette.accent2}}>{label}</div>
        <div style={{fontFamily: st.fonts.display, fontWeight: st.fonts.displayWeight, fontSize: 58, lineHeight: 1.2, color: st.palette.textOnSurface}}>{title}</div>
      </div>
    </div>
  );
};

export const Chip: React.FC<{text: string}> = ({text}) => {
  const st = useStyle();
  return (
    <div style={{background: st.palette.chipBg, color: st.palette.chipText, fontFamily: st.fonts.body, fontWeight: 800, fontSize: 32, padding: '8px 18px 10px', borderRadius: 999}}>{text}</div>
  );
};

