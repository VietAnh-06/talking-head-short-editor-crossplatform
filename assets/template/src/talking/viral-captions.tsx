import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {CaptionWord, FPS, useEdit} from './edit-data';
import {PAGE, StyleSpec, useStyle} from './style';

// Gom các từ khóa liền nhau thành một cụm; từ thường đứng riêng
const groupWords = (words: CaptionWord[]) => {
  const groups: CaptionWord[][] = [];
  words.forEach((w, i) => {
    const prev = words[i - 1];
    if (w.emph && prev?.emph && groups.length) groups[groups.length - 1].push(w);
    else groups.push([w]);
  });
  return groups;
};

const STROKE = '0 0 2px #000, 0 3px 0 rgba(0,0,0,0.9), 0 6px 24px rgba(0,0,0,0.65)';

type TokenProps = {text: string; active: boolean; emph: boolean; spoken: boolean; s: StyleSpec; pop: number};

// Mỗi kiểu phụ đề là một cách vẽ token (từ thường hoặc cụm từ khóa)
const renderToken = ({text, active, emph, spoken, s, pop}: TokenProps): React.CSSProperties => {
  const p = s.palette;
  const size = emph ? (text.length > 14 ? 64 : text.length > 10 ? 72 : 80) : 70;
  const base: React.CSSProperties = {
    fontFamily: s.fonts.body,
    fontWeight: 800,
    fontSize: size,
    lineHeight: 1.25,
    letterSpacing: '-0.01em',
    textTransform: 'uppercase',
    display: 'inline-block',
    whiteSpace: 'nowrap',
    borderRadius: 16,
  };
  switch (s.caption) {
    case 'box':
      return {
        ...base,
        padding: '2px 16px 8px',
        borderRadius: 4,
        color: emph && active ? p.emphText : p.text,
        background: emph && active ? p.emphBg : 'rgba(0,0,0,0.88)',
        opacity: spoken ? 1 : 0.55,
      };
    case 'bounce':
      return {
        ...base,
        textTransform: 'none',
        fontSize: size + 6,
        // trang sáng: p.text là mực tối, đi với viền nâu đen thì cả chữ thành khối đen; dùng chữ kem như trên nền tối, cụm từ khóa mực tối trên viền vàng
        color: active ? p.captionActive : PAGE[s.broll]?.light ? (emph ? p.textOnSurface : p.surface) : p.text,
        WebkitTextStroke: `10px ${emph ? p.accent2 : '#2b1a10'}`,
        paintOrder: 'stroke fill',
        transform: `translateY(${active ? -10 * pop : 0}px) rotate(${active ? -3 : 0}deg) scale(${active ? 1.12 : 1})`,
      };
    case 'underline':
      return {
        ...base,
        textTransform: 'none',
        fontWeight: 700,
        fontSize: size - 8,
        color: active || emph ? p.captionActive : p.text,
        textShadow: '0 2px 16px rgba(0,0,0,0.7)',
        borderBottom: `6px solid ${active ? p.accent : 'transparent'}`,
        borderRadius: 0,
        paddingBottom: 2,
      };
    case 'ink':
      // mực trên trang sổ sáng: không viền đen; từ đang đọc nền vàng dạ quang, từ khóa mực xanh lá ngân hàng
      return {
        ...base,
        textTransform: 'none',
        fontWeight: 800,
        fontSize: size - 6,
        color: emph ? p.captionActive : p.text,
        background: active ? p.emphBg : 'transparent',
        borderRadius: 6,
        padding: '0 8px 4px',
        opacity: spoken ? 1 : 0.45,
      };
    case 'chat':
      // chữ trong bong bóng chat trắng: từ đang đọc xanh nút bấm, từ khóa đậm có gạch chân xanh lá
      return {
        ...base,
        textTransform: 'none',
        fontWeight: emph ? 900 : 800,
        fontSize: size - 12,
        lineHeight: 1.2,
        color: active ? p.captionActive : p.text,
        borderBottom: `5px solid ${emph ? p.accent2 : 'transparent'}`,
        borderRadius: 0,
        opacity: spoken ? 1 : 0.4,
      };
    case 'typed':
      // chữ đánh máy mực xanh trên tờ hồ sơ: từ đang đọc gạch chân mực đỏ, từ khóa tô dạ quang vàng
      return {
        ...base,
        textTransform: 'none',
        fontWeight: 800,
        fontSize: size - 8,
        lineHeight: 1.25,
        color: active ? p.captionActive : p.text,
        background: emph && spoken ? p.emphBg : 'transparent',
        borderBottom: `5px solid ${active ? p.accent : 'transparent'}`,
        borderRadius: 0,
        padding: '0 6px 2px',
        opacity: spoken ? 1 : 0.42,
      };
    case 'block':
      // chữ hẹp khổng lồ trên nền đen phim: từ đang đọc thành khối vàng chữ đen
      return {
        ...base,
        fontFamily: s.fonts.display,
        fontWeight: 700,
        fontSize: size + 14,
        lineHeight: 1.08,
        letterSpacing: '0.01em',
        color: active ? p.emphText : emph ? p.accent : p.text,
        background: active ? p.emphBg : 'transparent',
        borderRadius: 0,
        padding: '0 10px 2px',
        margin: '0 6px',
        transform: `scale(${active ? 1.04 : 1})`,
      };
    case 'glow':
      return {
        ...base,
        color: active ? p.captionActive : emph ? p.accent2 : p.text,
        textShadow: active
          ? `0 0 12px ${p.captionActive}, 0 0 32px ${p.captionActive}, 0 4px 0 rgba(0,0,0,0.8)`
          : emph
            ? `0 0 18px ${p.accent2}, 0 4px 0 rgba(0,0,0,0.8)`
            : STROKE,
        transform: `scale(${active ? 1.08 : 1})`,
      };
    case 'pill':
    default:
      return emph
        ? {
            ...base,
            padding: '0 20px 6px',
            color: active ? p.emphText : p.accent,
            background: active ? p.emphBg : 'transparent',
            textShadow: active ? '0 3px 0 rgba(0,0,0,0.35)' : STROKE,
            boxShadow: active ? '0 14px 40px rgba(0,0,0,0.4)' : 'none',
            transform: `scale(${active ? 1.06 : 1}) rotate(${active ? -2 : 0}deg)`,
          }
        : {...base, padding: '0 2px', color: active ? p.captionActive : p.text, textShadow: STROKE, transform: `scale(${active ? 1.08 : 1})`};
  }
};

export const ViralCaptions: React.FC<{top?: number}> = ({top = 1418}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {pages, cue} = useEdit();
  const s = useStyle();
  const page = pages.find((p) => frame >= p.startFrame && frame < p.endFrame);
  // Câu hỏi đã có trên thẻ bình luận nên không lặp phụ đề
  if (!page || (page.startFrame >= cue('coldEnd') - 3 && page.startFrame < cue('questionEnd'))) return null;
  const t = frame / FPS;
  const pop = spring({frame: frame - page.startFrame, fps, config: {damping: 13, stiffness: 320, mass: 0.5}});
  const groups = groupWords(page.words);
  const chat = s.caption === 'chat';
  return (
    <div
      style={{
        ...(chat
          ? {background: s.palette.surface, borderRadius: '44px 44px 44px 12px', padding: '26px 34px 30px', boxShadow: '0 18px 50px rgba(15,28,63,0.14)'}
          : {}),
        position: 'absolute',
        // chừa cột nút TikTok bên phải (≈ 140 px): chữ dài không chạm icon
        left: 60,
        right: 150,
        top,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: chat ? 'flex-start' : 'center',
        alignItems: 'center',
        // viền dày (bounce) và quầng sáng (glow) ăn vào khoảng trắng nên cần cách rộng hơn; bounce còn phóng 1,12 lần chữ đang đọc nên cách rộng nhất
        columnGap: s.caption === 'box' || s.caption === 'block' ? 0 : s.caption === 'pill' || s.caption === 'chat' ? 14 : s.caption === 'ink' ? 6 : s.caption === 'bounce' ? 38 : 30,
        rowGap: 4,
        transform: `scale(${interpolate(pop, [0, 1], [0.78, 1])})`,
        opacity: interpolate(pop, [0, 0.35], [0, 1], {extrapolateRight: 'clamp'}),
      }}
    >
      {groups.map((group, gi) => {
        const nextStart = page.words[page.words.indexOf(group[group.length - 1]) + 1]?.start;
        const groupEnd = nextStart ?? group[group.length - 1].end + 0.35;
        if (group[0].emph) {
          const active = t >= group[0].start - 0.02 && t < groupEnd;
          const text = group.map((w) => w.text).join(' ');
          return (
            <span key={gi} style={renderToken({text, active, emph: true, spoken: t >= group[0].start - 0.02, s, pop})}>
              {text}
            </span>
          );
        }
        return group.map((w, i) => {
          const active = t >= w.start - 0.02 && t < (group[i + 1]?.start ?? groupEnd);
          return (
            <span key={`${gi}-${i}`} style={renderToken({text: w.text, active, emph: false, spoken: t >= w.start - 0.02, s, pop})}>
              {w.text}
            </span>
          );
        });
      })}
    </div>
  );
};
