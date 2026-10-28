import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {BrandProvider, monoFont, useBrand} from './broll';
import {MarkerHighlight} from './motion';
import {fitDisplay, PAGE, StyleId, StyleProvider, useStyle} from './style';
import {CoverCard} from './cover';

// Poster bìa thiết kế riêng (không cắt từ video): ảnh đại diện TikTok/Reels 1080×1920.
// Lưới hồ sơ TikTok cắt bìa về 3:4 ở giữa (y ≈ 240–1680), nên mọi chữ và hình chính nằm trong vùng đó; ngoài vùng chỉ là nền.
export type PosterSpec = {
  kicker: string; // nhãn ngắn trên cùng (đối tượng/visa, mốc thời gian)
  title: string; // 2–3 dòng, ngắt bằng \n; nói đúng lời hứa của hook
  hi?: string[]; // từ khóa tô màu nhấn + nét dạ quang
  sub?: string; // một câu phụ
  image: string; // ảnh trong public/ (khung đẹp nhất của B-roll chủ đạo, tải về hoặc tách bằng ffmpeg)
  stamp?: [string, string]; // con dấu trên ảnh: dòng lớn, dòng nhỏ
  series?: string; // số tập/chuỗi ở góc phải trên ("TOPIK #1")
};

const SAFE = {top: 250, bottom: 1670};

const PosterBody: React.FC<PosterSpec> = ({kicker, title, hi = [], sub, image, stamp, series}) => {
  const st = useStyle();
  const brand = useBrand();
  const ink = st.palette.textOnSurface;
  const up = (s: string) => (st.fonts.uppercaseDisplay ? s.toUpperCase() : s);
  const lines = up(title).split('\n');
  const hiSet = new Set(hi.map(up));
  const size = fitDisplay(st, lines, 888, 210);
  // bố cục toàn trang: ảnh bìa dùng đúng khung bìa của video (bìa sổ, màn hình khóa, khung tựa phim), không dùng mẫu giấy sáng chung
  if (PAGE[st.broll]) return <CoverCard kicker={kicker} title={title} hi={hi} sub={sub} image={image} />;
  return (
    <AbsoluteFill style={{background: st.palette.surface}}>
      {/* nền giấy kẻ mờ để không phẳng */}
      <AbsoluteFill style={{backgroundImage: `repeating-linear-gradient(0deg, ${ink}0a 0 2px, transparent 2px 64px)`}} />
      <div style={{position: 'absolute', left: 64, right: 64, top: SAFE.top, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div style={{background: st.palette.emphBg, color: st.palette.emphText, fontFamily: st.fonts.body, fontWeight: 800, fontSize: 46, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '8px 26px 12px', borderRadius: 10, whiteSpace: 'nowrap'}}>{kicker}</div>
        {series ? <div style={{fontFamily: monoFont(), fontWeight: 800, fontSize: 38, color: st.palette.emphBg, border: `4px solid ${st.palette.emphBg}`, borderRadius: 10, padding: '4px 16px', whiteSpace: 'nowrap'}}>{series}</div> : null}
      </div>
      <div style={{position: 'absolute', left: 90, right: 90, top: SAFE.top + 120, height: 560, transform: 'rotate(-2.5deg)', background: '#fff', padding: 16, boxShadow: '0 30px 60px rgba(0,0,0,0.28)', borderRadius: 8}}>
        <Img src={staticFile(image)} style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4}} />
        {stamp ? (
          <div style={{position: 'absolute', right: -24, bottom: -10, transform: 'rotate(-10deg)', border: `8px solid ${st.palette.emphBg}`, outline: `3px solid ${st.palette.emphBg}`, outlineOffset: 6, borderRadius: 16, background: `${st.palette.surface}f2`, padding: '6px 30px 12px', textAlign: 'center', boxShadow: '0 16px 40px rgba(0,0,0,0.3)'}}>
            <div style={{fontFamily: st.fonts.display, fontWeight: 800, fontSize: fitDisplay(st, [stamp[0]], 560, 92), lineHeight: 1.1, color: st.palette.emphBg, whiteSpace: 'nowrap'}}>{up(stamp[0])}</div>
            <div style={{fontFamily: monoFont(), fontWeight: 800, fontSize: 30, letterSpacing: '0.12em', color: st.palette.emphBg, textTransform: 'uppercase'}}>{stamp[1]}</div>
          </div>
        ) : null}
      </div>
      <div style={{position: 'absolute', left: 64, right: 64, top: SAFE.top + 740, display: 'flex', flexDirection: 'column', gap: 4}}>
        {lines.map((line, li) => (
          <div key={li} style={{fontFamily: st.fonts.display, fontWeight: st.fonts.displayWeight, fontSize: size, lineHeight: 1.08, color: ink, whiteSpace: 'nowrap', letterSpacing: '-0.01em'}}>
            {line.split(' ').map((w, wi) => (
              <React.Fragment key={wi}>
                {wi ? ' ' : null}
                {hiSet.has(w) ? (
                  <span style={{color: st.palette.emphBg}}>
                    <MarkerHighlight at={-100} color={`${st.palette.accent}d9`} seed={wi + li * 3}>{w}</MarkerHighlight>
                  </span>
                ) : (
                  w
                )}
              </React.Fragment>
            ))}
          </div>
        ))}
        {sub ? <div style={{marginTop: 18, fontFamily: st.fonts.body, fontWeight: 700, fontSize: 48, lineHeight: 1.25, color: `${ink}dd`}}>{sub}</div> : null}
      </div>
      {brand.name ? (
        <div style={{position: 'absolute', left: 64, top: SAFE.bottom - 60, fontFamily: st.fonts.body, fontWeight: 800, fontSize: 38, color: `${ink}aa`}}>@ {brand.name}</div>
      ) : null}
    </AbsoluteFill>
  );
};

// Bọc style + thương hiệu để render độc lập như một Still
export const CoverPoster: React.FC<PosterSpec & {style: StyleId; brandName?: string}> = ({style, brandName, ...spec}) => (
  <StyleProvider id={style}>
    <BrandProvider value={{name: brandName}}>
      <PosterBody {...spec} />
    </BrandProvider>
  </StyleProvider>
);
