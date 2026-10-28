import React from 'react';
import {AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {useEdit} from './edit-data';

import {PAGE, useStyle} from './style';
import {PageBackdrop} from './broll';

// Màn kết: câu hỏi kéo bình luận (tín hiệu mạnh nhất cho thuật toán) + thương hiệu + lối tư vấn
type EndCardProps = {
  // Ba dòng câu hỏi kéo bình luận; dòng giữa là điểm nhấn lớn màu vàng
  lines: [string, React.ReactNode, string];
  ask: string;
  // Logo thương hiệu (đường dẫn trong public/) và hai dòng kêu gọi cuối
  logos?: string[];
  footer?: [string, string];
};

export const EndCard: React.FC<EndCardProps> = ({lines, ask, logos = [], footer}) => {
  const {footage} = useEdit();
  const st = useStyle();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = (at: number) => spring({frame: frame - at, fps, config: {damping: 14, stiffness: 170}});
  // nền hiện ngay (video thầy đã hết), chỉ phóng nhẹ cho có chuyển động
  const bgScale = interpolate(frame, [0, 110], [1.25, 1.12], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  // chữ đứng > 2 s thì thở nhẹ (motion-design.md)
  const idle = `translateY(${Math.sin(frame / 30) * 3}px) scale(${1 + Math.sin(frame / 24) * 0.01})`;
  // bố cục lightbox: màn kết nằm trên mặt đèn trắng, chữ thường phải dùng màu chữ trên nền sáng
  const ink = st.broll === 'lightbox' ? st.palette.textOnSurface : st.palette.text;
  const rise = (at: number) => {
    const v = s(at);
    return {opacity: interpolate(v, [0, 0.3], [0, 1], {extrapolateRight: 'clamp'}), transform: `translateY(${interpolate(v, [0, 1], [50, 0])}px)`};
  };
  return (
    <AbsoluteFill>
      {PAGE[st.broll] ? <PageBackdrop /> : <AbsoluteFill>
        <Img src={footage('last-frame.jpg')} style={{width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(28px) brightness(0.5)', transform: `scale(${bgScale})`}} />
        <AbsoluteFill style={{background: `linear-gradient(180deg, ${st.palette.bg}aa, ${st.palette.bg}ee)`}} />
      </AbsoluteFill>}
      <AbsoluteFill style={{alignItems: 'center', paddingTop: PAGE[st.broll]?.endTop ?? 380, textAlign: 'center', fontFamily: st.fonts.body, transform: frame > 45 ? idle : undefined}}>
        <div style={{...rise(4), fontWeight: 800, fontSize: 64, color: ink, lineHeight: 1.25}}>{lines[0]}</div>
        <div style={{...rise(8), fontFamily: st.fonts.display, fontWeight: st.fonts.displayWeight, fontSize: 120, color: st.palette.accent, lineHeight: 1.2, textShadow: PAGE[st.broll]?.light ? 'none' : '0 8px 30px rgba(0,0,0,0.5)'}}>{lines[1]}</div>
        <div style={{...rise(12), fontWeight: 800, fontSize: 64, color: ink}}>{lines[2]}</div>
        <div
          style={{
            ...rise(18),
            marginTop: 26,
            background: st.palette.chipBg,
            color: st.palette.chipText,
            fontWeight: 800,
            fontSize: 44,
            padding: '14px 34px 18px',
            borderRadius: 999,
          }}
        >
          {ask}
        </div>
        {logos.length ? (
          <div style={{...rise(30), marginTop: 70, background: '#fff', borderRadius: 26, padding: '20px 34px', display: 'flex', alignItems: 'center', gap: 26}}>
            {logos.map((src, i) => (
              <React.Fragment key={src}>
                {i ? <div style={{width: 2, height: 54, background: '#cfe2f3'}} /> : null}
                <Img src={staticFile(src)} style={{height: 58}} />
              </React.Fragment>
            ))}
          </div>
        ) : null}
        {footer ? (
          <div style={{...rise(36), marginTop: 26, fontWeight: 700, fontSize: 34, color: ink, lineHeight: 1.4, maxWidth: 820}}>
            {footer[0]}
            <br />
            <span style={{color: st.palette.accent, fontWeight: 800}}>{footer[1]}</span>
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
