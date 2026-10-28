import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {CONSOLE, ConsoleBackdrop, ConsoleSwitch, FILM, hiSegments, KRAFT, LIGHTBOX, LightboxBackdrop, monoFont, PAYSLIP, PayslipBackdrop, STORE, TRAY, TrayBackdrop, useBrand} from './broll';
import {Img, staticFile} from 'remotion';
import {CITATION, CitationBackdrop, citationTearClip, plexMono} from './broll';
import {BibShell, TrackBackdrop} from './broll';
import {FlapRow, PLATFORM, PlatformBackdrop, PlatformBoard} from './broll';
import {EASE, MarkerHighlight} from './motion';
import {fitDisplay, useStyle} from './style';

// Khung bìa: hiện đủ ở khung 0 (ảnh đại diện, ô lưới hồ sơ, lúc lướt tới) rồi thu về sau COVER_HOLD khung để lộ cảnh hook.
// Giọng vẫn chạy từ khung 0 nên bìa chỉ giữ ~0,3 s; tiêu đề bìa nói đúng câu hook để không lệch lời.
export const COVER_HOLD = 10;
export const COVER_EXIT = 8;
export type CoverSpec = {kicker: string; title: string; hi?: string[]; sub?: string; image?: string};

export const CoverCard: React.FC<CoverSpec> = ({kicker, title, hi = [], sub, image}) => {
  const frame = useCurrentFrame();
  const st = useStyle();
  const brand = useBrand();
  if (frame >= COVER_HOLD + COVER_EXIT) return null;
  const q = interpolate(frame, [COVER_HOLD, COVER_HOLD + COVER_EXIT], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.in});
  const lines = (st.fonts.uppercaseDisplay ? title.toUpperCase() : title).split('\n');
  const hiSet = new Set(hi.map((h) => (st.fonts.uppercaseDisplay ? h.toUpperCase() : h)));
  const size = fitDisplay(st, lines, 936, 220);
  const word = (w: string, wi: number, hiColor: string) => (
    <React.Fragment key={wi}>
      {wi ? ' ' : null}
      {hiSet.has(w) ? <span style={{color: hiColor}}>{w}</span> : w}
    </React.Fragment>
  );
  // bố cục toàn trang: bìa trượt hẳn lên khỏi khung (không mờ tại chỗ), vì mờ dần thì chữ bìa chồng lên tiêu đề hook bên dưới như chữ ma
  const exitStyle: React.CSSProperties = {transform: `translateY(${-1920 * q}px)`, boxShadow: q > 0 ? '0 30px 60px rgba(0,0,0,0.35)' : undefined};
  if (st.broll === 'passbook') {
    // bìa sổ tiết kiệm: da xanh lá đậm, khung chỉ vàng ép nhũ, chữ vàng
    const gold = '#f1d98a';
    const sz = fitDisplay(st, lines, 860, 170);
    return (
      <AbsoluteFill style={{background: 'linear-gradient(160deg, #24604a 0%, #163f30 100%)', ...exitStyle}}>
        <div style={{position: 'absolute', inset: 48, border: `4px solid ${gold}`, borderRadius: 26}} />
        <div style={{position: 'absolute', inset: 64, border: `2px solid ${gold}88`, borderRadius: 18}} />
        <AbsoluteFill style={{padding: '400px 100px 0', display: 'flex', flexDirection: 'column', gap: 30}}>
          <div style={{fontFamily: monoFont(), fontWeight: 800, fontSize: 38, color: gold, letterSpacing: '0.16em', textTransform: 'uppercase'}}>{kicker}</div>
          <div style={{height: 4, width: 220, background: gold}} />
          {lines.map((line, li) => (
            <div key={li} style={{fontFamily: st.fonts.display, fontWeight: 800, fontSize: sz, lineHeight: 1.08, color: gold, whiteSpace: 'nowrap', textShadow: '0 3px 0 rgba(0,0,0,0.35)'}}>
              {line.split(' ').map((w, wi) => word(w, wi, '#ffffff'))}
            </div>
          ))}
          {sub ? <div style={{fontFamily: st.fonts.body, fontWeight: 800, fontSize: 46, color: '#f4efe2', lineHeight: 1.3, maxWidth: 860}}>{sub}</div> : null}
        </AbsoluteFill>
        {brand.name ? <div style={{position: 'absolute', left: 100, bottom: 470, fontFamily: monoFont(), fontWeight: 700, fontSize: 34, color: `${gold}cc`}}>@ {brand.name}</div> : null}
      </AbsoluteFill>
    );
  }
  if (st.broll === 'phone') {
    // màn hình khóa: đồng hồ lớn, thẻ thông báo của app chứa tiêu đề
    const sz = fitDisplay(st, lines, 820, 150);
    return (
      <AbsoluteFill style={{background: `linear-gradient(170deg, ${st.palette.accent} 0%, #6d28d9 100%)`, ...exitStyle}}>
        <div style={{position: 'absolute', top: 250, left: 0, right: 0, textAlign: 'center', fontFamily: st.fonts.display, fontWeight: 700, fontSize: 200, color: '#ffffffee', letterSpacing: '-0.02em'}}>9:41</div>
        <div style={{position: 'absolute', top: 560, left: 50, right: 50, background: 'rgba(255,255,255,0.96)', borderRadius: 48, padding: '34px 40px 44px', boxShadow: '0 30px 80px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: 18}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 18, fontFamily: st.fonts.body, fontWeight: 800, fontSize: 32, color: '#6b7896'}}>
            <div style={{width: 64, height: 64, borderRadius: 18, background: st.palette.accent, color: '#fff', fontWeight: 800, fontSize: 38, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>₩</div>
            <span style={{textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1}}>{kicker}</span>
            <span>bây giờ</span>
          </div>
          {lines.map((line, li) => (
            <div key={li} style={{fontFamily: st.fonts.display, fontWeight: 800, fontSize: sz, lineHeight: 1.08, color: st.palette.text, whiteSpace: 'nowrap'}}>
              {line.split(' ').map((w, wi) => word(w, wi, st.palette.accent))}
            </div>
          ))}
          {sub ? <div style={{fontFamily: st.fonts.body, fontWeight: 800, fontSize: 42, color: '#46536f', lineHeight: 1.3}}>{sub}</div> : null}
        </div>
        {brand.name ? <div style={{position: 'absolute', left: 0, right: 0, bottom: 470, textAlign: 'center', fontFamily: st.fonts.body, fontWeight: 800, fontSize: 36, color: '#ffffffcc'}}>@ {brand.name}</div> : null}
      </AbsoluteFill>
    );
  }
  if (st.broll === 'payslip') {
    // tờ phiếu lương: bảng lương lớn trong ô chi tiết, dòng "Lương/giờ" bị gạch đỏ và số đúng viết tay đỏ bên cạnh
    const m = PAYSLIP.main;
    const ink = st.palette.textOnSurface;
    const sz = fitDisplay(st, lines, 826, 150);
    return (
      <AbsoluteFill style={exitStyle}>
        <PayslipBackdrop s={st} />
        <div style={{position: 'absolute', left: m.left, top: m.top, width: m.width, height: m.height, background: st.palette.surface, borderRadius: PAYSLIP.radius, border: `3px solid ${st.palette.accent2}`, boxSizing: 'border-box', padding: '0 90px 0 44px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28}}>
          <div style={{alignSelf: 'flex-start', background: st.palette.chipBg, color: st.palette.chipText, fontFamily: st.fonts.body, fontWeight: 600, fontSize: 40, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '8px 24px 12px', borderRadius: 8}}>{kicker}</div>
          {lines.map((line, li) => (
            <div key={li} style={{fontFamily: st.fonts.display, fontWeight: st.fonts.displayWeight, fontSize: sz, lineHeight: 1.08, color: ink, whiteSpace: 'nowrap'}}>
              {line.split(' ').map((w, wi) => word(w, wi, st.palette.accent))}
            </div>
          ))}
          {sub ? <div style={{fontFamily: st.fonts.body, fontWeight: 600, fontSize: 48, color: `${ink}cc`, lineHeight: 1.25, whiteSpace: 'pre-line'}}>{sub}</div> : null}
          <div style={{marginTop: 18, borderTop: `3px solid ${st.palette.accent2}55`, paddingTop: 22, position: 'relative', height: 190}}>
            <div style={{display: 'flex', alignItems: 'baseline', gap: 16, fontFamily: st.fonts.body, fontWeight: 600, fontSize: 44, color: `${ink}cc`, whiteSpace: 'nowrap'}}>
              <span>Lương/giờ</span>
              <span style={{flex: 1, borderBottom: `4px dotted ${ink}44`}} />
              <span style={{position: 'relative', fontFamily: st.fonts.display, fontWeight: 700, fontSize: 68, color: ink}}>
                8.000 ₩
                <span style={{position: 'absolute', left: -12, right: -12, top: '52%', height: 9, borderRadius: 5, background: st.palette.accent, transform: 'rotate(-3deg)'}} />
              </span>
            </div>
            <div style={{position: 'absolute', right: 0, top: 84, fontFamily: st.fonts.display, fontWeight: 700, fontSize: 96, color: st.palette.accent, transform: 'rotate(-5deg)', whiteSpace: 'nowrap'}}>10.320 ₩</div>
          </div>
        </div>
        {brand.name ? <div style={{position: 'absolute', left: 70, right: 150, top: PAYSLIP.low.top + 150, textAlign: 'center', fontFamily: st.fonts.body, fontWeight: 600, fontSize: 38, color: `${ink}aa`}}>@ {brand.name}</div> : null}
      </AbsoluteFill>
    );
  }
  if (st.broll === 'console') {
    // tủ điện: dải trên có ba công tắc lớn (hai ON đèn xanh, một OFF đèn đỏ cam), màn hình dưới hiện tiêu đề hook
    const m = CONSOLE.main;
    const t = CONSOLE.top;
    const sz = fitDisplay(st, lines, 830, 150);
    return (
      <AbsoluteFill style={exitStyle}>
        <ConsoleBackdrop s={st} idle={false} />
        <div style={{position: 'absolute', left: t.left, top: t.top, width: t.width, height: t.height}}>
          {[true, true, false].map((on, k) => (
            <ConsoleSwitch key={k} on={on} s={st} scale={1.1} style={{left: 160 - 82 + k * 320, top: 18}} />
          ))}
        </div>
        <div style={{position: 'absolute', left: m.left, top: m.top, width: m.width, height: m.height, borderRadius: CONSOLE.radius, overflow: 'hidden', background: `radial-gradient(ellipse 90% 70% at 50% 40%, ${st.palette.surface} 0%, ${st.palette.bg} 100%)`, boxSizing: 'border-box', padding: '0 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28}}>
          <AbsoluteFill style={{backgroundImage: 'repeating-linear-gradient(180deg, rgba(0,0,0,0.06) 0 2px, transparent 2px 4px)'}} />
          <div style={{position: 'relative', alignSelf: 'flex-start', background: st.palette.chipBg, color: st.palette.chipText, fontFamily: st.fonts.body, fontWeight: 700, fontSize: 40, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '6px 22px 10px', borderRadius: 6}}>{kicker}</div>
          {lines.map((line, li) => (
            <div key={li} style={{position: 'relative', fontFamily: st.fonts.display, fontWeight: st.fonts.displayWeight, fontSize: sz, lineHeight: 1.12, color: st.palette.text, whiteSpace: 'nowrap'}}>
              {line.split(' ').map((w, wi) => word(w, wi, st.palette.accent))}
            </div>
          ))}
          {sub ? <div style={{position: 'relative', fontFamily: st.fonts.body, fontWeight: 600, fontSize: 48, color: `${st.palette.text}cc`, lineHeight: 1.25, whiteSpace: 'pre-line'}}>{sub}</div> : null}
          <AbsoluteFill style={{background: 'linear-gradient(112deg, transparent 0 30%, rgba(255,255,255,0.05) 30% 41%, transparent 41% 46%, rgba(255,255,255,0.03) 46% 49%, transparent 49% 100%)', boxShadow: 'inset 0 0 90px rgba(0,0,0,0.45)'}} />
        </div>
        {brand.name ? <div style={{position: 'absolute', left: 100, top: 1500, maxWidth: 830, fontFamily: st.fonts.body, fontWeight: 600, fontSize: 36, color: `${st.palette.text}aa`, whiteSpace: 'nowrap'}}>@ {brand.name}</div> : null}
      </AbsoluteFill>
    );
  }
  if (st.broll === 'lightbox') {
    // hộp đèn sáng: kicker và tiêu đề hook trên mặt đèn, dưới là bìa hồ sơ kraft và kính lúp tròn soi vào chữ "D-4"
    const w = LIGHTBOX.win;
    const ink = st.palette.textOnSurface;
    // ngắt lại dòng để chữ rộng Unbounded vẫn đủ lớn: cụm từ khóa dính liền (nbsp), chọn số dòng cho cỡ chữ lớn nhất còn vừa chiều cao
    const NB = ' ';
    const glued = hi.reduce((t, h) => t.split(h).join(h.split(' ').join(NB)), lines.join(' '));
    const words = glued.split(' ');
    const splits = (m: number, n: number): number[][] => (n === 1 ? [[m]] : Array.from({length: m - n + 1}, (_, k) => k + 1).flatMap((k) => splits(m - k, n - 1).map((r) => [k, ...r])));
    const layouts = [2, 3, 4].filter((n) => n <= words.length).map((n) => {
      const best = splits(words.length, n)
        .map((cuts) => {
          let at = 0;
          return cuts.map((c) => words.slice(at, (at += c)).join(' ').split(NB).join(' '));
        })
        .sort((a, b) => Math.max(...a.map((l) => l.length)) - Math.max(...b.map((l) => l.length)))[0];
      return {rows: best, fs: Math.min(fitDisplay(st, best, 880, 150), Math.floor(330 / (best.length * 1.12)))};
    });
    const pick = layouts.sort((a, b) => b.fs - a.fs)[0];
    const hiList = hi;
    return (
      <AbsoluteFill style={exitStyle}>
        <LightboxBackdrop s={st} idle={false} />
        <div style={{position: 'absolute', left: w.left + 40, top: w.top + 36, background: st.palette.chipBg, color: st.palette.chipText, fontFamily: st.fonts.body, fontWeight: 700, fontSize: 36, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '6px 22px 10px', borderRadius: 6}}>{kicker}</div>
        <div style={{position: 'absolute', left: w.left + 40, top: w.top + 120, width: 880}}>
          {pick.rows.map((line, li) => (
            <div key={li} style={{fontFamily: st.fonts.display, fontWeight: st.fonts.displayWeight, fontSize: pick.fs, lineHeight: 1.12, color: ink, whiteSpace: 'nowrap'}}>
              {hiSegments(line, hiList).map((seg, si) => (seg.hi ? <MarkerHighlight key={si} at={-20} color={`${st.palette.accent}cc`}>{seg.text}</MarkerHighlight> : <React.Fragment key={si}>{seg.text}</React.Fragment>))}
            </div>
          ))}
        </div>
        {sub ? <div style={{position: 'absolute', left: w.left + 40, top: w.top + 120 + Math.round(pick.rows.length * pick.fs * 1.12) + 26, width: 880, fontFamily: st.fonts.body, fontWeight: 500, fontSize: 40, lineHeight: 1.3, color: `${ink}cc`, whiteSpace: 'pre-line'}}>{sub}</div> : null}
        <div style={{position: 'absolute', left: w.left + 50, top: w.top + 640, width: 560, height: 290, transform: 'rotate(-4deg)', filter: 'drop-shadow(0 16px 22px rgba(0,0,0,0.3))'}}>
          <div style={{position: 'absolute', left: 0, top: 0, height: 50, padding: '0 22px', display: 'flex', alignItems: 'center', borderRadius: '12px 12px 0 0', background: st.palette.chipBg, color: st.palette.chipText, fontFamily: st.fonts.body, fontWeight: 700, fontSize: 28, letterSpacing: '0.06em', textTransform: 'uppercase'}}>Hồ sơ · 심사</div>
          <div style={{position: 'absolute', left: 0, right: 0, top: 50, bottom: 0, background: KRAFT, borderRadius: '0 12px 12px 12px', padding: '34px 36px', boxSizing: 'border-box', fontFamily: st.fonts.display, fontWeight: st.fonts.displayWeight, fontSize: 56, color: ink, lineHeight: 1.2, whiteSpace: 'nowrap'}}>
            HỒ SƠ D-4
            <div style={{marginTop: 22, height: 3, background: `${ink}33`, width: '80%'}} />
            <div style={{marginTop: 18, height: 3, background: `${ink}33`, width: '55%'}} />
          </div>
        </div>
        <div style={{position: 'absolute', left: w.left + 420, top: w.top + 600, width: 300, height: 300, filter: 'drop-shadow(0 18px 20px rgba(0,0,0,0.35))'}}>
          <div style={{position: 'absolute', left: 218, top: 232, width: 24, height: 190, borderRadius: 12, background: 'linear-gradient(90deg, #0d0d0d, #3a3a3a, #0d0d0d)', transform: 'rotate(-42deg)', transformOrigin: '50% 0%'}} />
          <div style={{position: 'absolute', inset: 0, borderRadius: 150, border: '16px solid #111111', boxSizing: 'border-box', background: `linear-gradient(135deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.1) 38%, rgba(0,0,0,0.04) 100%), ${st.palette.surface}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <div style={{fontFamily: st.fonts.display, fontWeight: st.fonts.displayWeight, fontSize: 104, color: ink, textShadow: `0 4px 0 ${st.palette.accent}55`}}>D-4</div>
          </div>
        </div>
        {brand.name ? <div style={{position: 'absolute', left: w.left + 10, top: 1392, maxWidth: 830, fontFamily: st.fonts.body, fontWeight: 700, fontSize: 36, color: `${st.palette.text}cc`, whiteSpace: 'nowrap'}}>@ {brand.name}</div> : null}
      </AbsoluteFill>
    );
  }
  if (st.broll === 'citation') {
    // biên bản xử phạt: ảnh hiện trường tràn mép trên (đáy xé răng cưa), dưới là tờ biên bản có chip vàng, tiêu đề hook, dấu phạt đỏ nghiêng ở góc phải trên tờ
    const f = CITATION.form;
    const sz = fitDisplay(st, lines, 860, 150);
    return (
      <AbsoluteFill style={exitStyle}>
        <CitationBackdrop s={st} idle={false} />
        <div style={{position: 'absolute', left: CITATION.photo.left, top: CITATION.photo.top, width: CITATION.photo.width, height: CITATION.photo.height, clipPath: citationTearClip(), overflow: 'hidden', background: st.palette.text}}>
          {image ? <Img src={staticFile(image)} style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : null}
          <AbsoluteFill style={{background: 'rgba(0,0,0,0.15)'}} />
        </div>
        <div style={{position: 'absolute', left: 72, top: f.top + 48, background: st.palette.chipBg, color: st.palette.chipText, fontFamily: plexMono(), fontWeight: 500, fontSize: 32, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '6px 20px 8px', whiteSpace: 'nowrap'}}>{kicker}</div>
        <div style={{position: 'absolute', left: 72, top: f.top + 180, width: 860}}>
          {lines.map((line, li) => (
            <div key={li} style={{fontFamily: st.fonts.display, fontWeight: st.fonts.displayWeight, fontSize: sz, lineHeight: 1.08, color: st.palette.text, whiteSpace: 'nowrap'}}>
              {line.split(' ').map((w, wi) => word(w, wi, st.palette.accent))}
            </div>
          ))}
          {sub ? <div style={{marginTop: 26, fontFamily: st.fonts.body, fontWeight: 700, fontSize: 44, lineHeight: 1.3, color: st.palette.text, whiteSpace: 'pre-line'}}>{sub}</div> : null}
        </div>
        <div style={{position: 'absolute', left: 764, top: f.top + 6, width: 160, height: 160, borderRadius: 80, border: `7px solid ${st.palette.accent}`, boxSizing: 'border-box', transform: 'rotate(-14deg)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.92}}>
          <div style={{width: 128, height: 128, borderRadius: 64, border: `3px solid ${st.palette.accent}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap', fontFamily: st.fonts.display, fontWeight: st.fonts.displayWeight, fontSize: 28, lineHeight: 1, letterSpacing: '0.04em', color: st.palette.accent, textAlign: 'center'}}>VI PHẠM</div>
        </div>
        {brand.name ? <div style={{position: 'absolute', left: 72, top: 1640, maxWidth: 830, fontFamily: plexMono(), fontWeight: 500, fontSize: 30, color: `${st.palette.text}aa`, whiteSpace: 'nowrap'}}>@ {brand.name}</div> : null}
      </AbsoluteFill>
    );
  }
  if (st.broll === 'track') {
    // đường chạy: số áo lớn ở giữa trên ghi tiêu đề hook, vạch đích ca-rô ngang giữa khung, thẻ vàng ghi sub bên dưới
    const w = 960;
    const h = 640;
    const bibTop = 270;
    const sz = Math.min(fitDisplay(st, lines, 840, 150), Math.floor((h - 64 - 60) / (lines.length * 1.14)));
    const finishTop = bibTop + h + 50;
    return (
      <AbsoluteFill style={exitStyle}>
        <TrackBackdrop s={st} idle={false} />
        <div style={{position: 'absolute', left: (1080 - w) / 2, top: bibTop}}>
          <BibShell s={st} kicker={kicker} width={w} height={h}>
            <div style={{position: 'absolute', left: 40, right: 40, top: 64, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'}}>
              {lines.map((line, li) => (
                <div key={li} style={{fontFamily: st.fonts.display, fontWeight: st.fonts.displayWeight, fontSize: sz, lineHeight: 1.14, color: st.palette.textOnSurface, whiteSpace: 'nowrap'}}>
                  {hiSegments(line, hi).map((seg, si) => (seg.hi ? <MarkerHighlight key={si} at={-20} color={`${st.palette.accent}e6`}>{seg.text}</MarkerHighlight> : <React.Fragment key={si}>{seg.text}</React.Fragment>))}
                </div>
              ))}
            </div>
          </BibShell>
        </div>
        <div style={{position: 'absolute', left: 0, right: 0, top: finishTop, height: 36, background: 'repeating-conic-gradient(#111111 0 25%, #ffffff 0 50%) 0 0 / 72px 36px'}} />
        {sub ? (
          <div style={{position: 'absolute', left: 90, top: finishTop + 90, transform: 'rotate(-1.5deg)', background: st.palette.chipBg, color: st.palette.chipText, fontFamily: st.fonts.body, fontWeight: 700, fontSize: 52, lineHeight: 1.3, whiteSpace: 'pre-line', padding: '22px 44px 26px', borderRadius: 14, boxShadow: '0 16px 28px rgba(0,0,0,0.3)'}}>{sub}</div>
        ) : null}
        {brand.name ? <div style={{position: 'absolute', left: 90, top: 1440, maxWidth: 830, fontFamily: st.fonts.body, fontWeight: 700, fontSize: 36, color: `${st.palette.text}cc`, whiteSpace: 'nowrap'}}>@ {brand.name}</div> : null}
      </AbsoluteFill>
    );
  }
  if (st.broll === 'platform') {
    // sân ga: tường gạch men với dải tuyến xanh; sau cửa kính chắn tàu (nền tối) là kicker, tiêu đề hook và sub; bảng giờ tàu dưới cửa có một hàng lật chữ
    const d = PLATFORM.door;
    const sz = Math.min(fitDisplay(st, lines, 840, 170), Math.floor(340 / (lines.length * 1.12)));
    return (
      <AbsoluteFill style={exitStyle}>
        <PlatformBackdrop s={st} idle={false} />
        {/* tấm biển thông báo ga sáng đặt sau kính: dải tuyến xanh ở đầu, chữ tối, nội dung bắt đầu từ y 420 */}
        <div style={{position: 'absolute', left: d.left + 24, top: d.top + 24, width: d.width - 48, height: d.height - 48, borderRadius: 8, background: st.palette.emphText, boxShadow: 'inset 0 0 0 3px rgba(0,0,0,0.08)', overflow: 'hidden'}}>
          <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 120, background: st.palette.accent, display: 'flex', alignItems: 'center', gap: 22, padding: '0 36px'}}>
            <div style={{width: 64, height: 64, borderRadius: 32, boxSizing: 'border-box', background: st.palette.emphText, border: `8px solid ${st.palette.text}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: st.fonts.body, fontWeight: 800, fontSize: 32, lineHeight: 1, color: st.palette.text}}>2</div>
            <div style={{fontFamily: st.fonts.body, fontWeight: 800, fontSize: 40, letterSpacing: '0.08em', color: st.palette.emphText, whiteSpace: 'nowrap'}}>SÂN GA · TUYẾN 2</div>
          </div>
        </div>
        <div style={{position: 'absolute', left: d.left + 60, top: 420, width: 840, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 22}}>
          <div style={{background: st.palette.chipBg, color: st.palette.chipText, fontFamily: st.fonts.body, fontWeight: 800, fontSize: 38, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '6px 22px 10px', borderRadius: 6}}>{kicker}</div>
          <div style={{marginTop: 10}}>
            {lines.map((line, li) => (
              <div key={li} style={{fontFamily: st.fonts.display, fontWeight: st.fonts.displayWeight, fontSize: sz, lineHeight: 1.12, color: st.palette.text, whiteSpace: 'nowrap'}}>
                {line.split(' ').map((w, wi) => word(w, wi, st.palette.accent))}
              </div>
            ))}
          </div>
          {sub ? <div style={{marginTop: 18, fontFamily: st.fonts.body, fontWeight: 800, fontSize: 44, lineHeight: 1.3, color: `${st.palette.text}d9`, whiteSpace: 'pre-line'}}>{sub}</div> : null}
        </div>
        <PlatformBoard s={st}>
          <FlapRow s={st} text={[...hi, kicker].join(' · ').toUpperCase()} hi={hi.map((h) => h.toUpperCase())} fs={40} />
        </PlatformBoard>
        {brand.name ? <div style={{position: 'absolute', left: PLATFORM.board.left, top: 1456, maxWidth: 830, fontFamily: st.fonts.body, fontWeight: 800, fontSize: 34, color: `${st.palette.text}b3`, whiteSpace: 'nowrap'}}>@ {brand.name}</div> : null}
      </AbsoluteFill>
    );
  }
  if (st.broll === 'tray') {
    // tờ menu giấy kem đặt trong ngăn lớn của khay cơm: nhãn món đỏ, tên món khổng lồ, dòng giá có chấm dẫn
    const sz = fitDisplay(st, lines, 840, 190);
    const m = TRAY.main;
    return (
      <AbsoluteFill style={exitStyle}>
        <TrayBackdrop s={st} />
        <div style={{position: 'absolute', left: m.left + 24, top: m.top + 24, width: m.width - 48, height: m.height - 48, background: st.palette.surface, borderRadius: 22, boxShadow: '0 16px 34px rgba(40,48,58,0.3)', padding: '0 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 30}}>
          <div style={{alignSelf: 'flex-start', background: st.palette.chipBg, color: st.palette.chipText, fontFamily: st.fonts.body, fontWeight: 700, fontSize: 42, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '8px 24px 12px', borderRadius: 10}}>{kicker}</div>
          {lines.map((line, li) => (
            <div key={li} style={{fontFamily: st.fonts.display, fontWeight: 400, fontSize: sz, lineHeight: 1.08, color: st.palette.textOnSurface, whiteSpace: 'nowrap'}}>
              {line.split(' ').map((w, wi) => word(w, wi, st.palette.accent))}
            </div>
          ))}
          {sub ? <div style={{fontFamily: st.fonts.body, fontWeight: 700, fontSize: 54, color: `${st.palette.textOnSurface}cc`, lineHeight: 1.25, whiteSpace: 'pre-line'}}>{sub}</div> : null}
          <div style={{marginTop: 30, display: 'flex', alignItems: 'center', gap: 16, fontFamily: monoFont(), fontWeight: 800, fontSize: 34, color: `${st.palette.textOnSurface}aa`}}>
            <span>식권 · SEOUL</span>
            <span style={{flex: 1, borderTop: `4px dotted ${st.palette.textOnSurface}44`}} />
            <span style={{color: st.palette.accent}}>₩ ?</span>
          </div>
        </div>
        {brand.name ? <div style={{position: 'absolute', left: 0, right: 0, top: TRAY.low.top + 120, textAlign: 'center', fontFamily: st.fonts.body, fontWeight: 700, fontSize: 38, color: `${st.palette.textOnSurface}aa`}}>@ {brand.name}</div> : null}
      </AbsoluteFill>
    );
  }
  if (st.broll === 'storefront') {
    // tờ "tuyển làm thêm" khổ lớn dán trên kính dưới mái hiên sọc: giấy kem sáng, tua xé ở chân tờ mang tên kênh
    const sz = fitDisplay(st, lines, 880, 170);
    const a = STORE.awning;
    return (
      <AbsoluteFill style={{background: '#f3ead6', ...exitStyle}}>
        <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: a.top + a.height, backgroundImage: `repeating-linear-gradient(90deg, ${st.palette.accent2} 0 ${STORE.stripe}px, ${st.palette.surface} ${STORE.stripe}px ${STORE.stripe * 2}px)`}} />
        <div style={{position: 'absolute', left: 0, right: 0, top: a.top + a.height - 1, height: a.scallop, backgroundImage: `radial-gradient(circle at ${STORE.stripe / 2}px 0, ${st.palette.accent2} ${a.scallop}px, transparent ${a.scallop + 1}px), radial-gradient(circle at ${STORE.stripe * 1.5}px 0, ${st.palette.surface} ${a.scallop}px, transparent ${a.scallop + 1}px)`, backgroundSize: `${STORE.stripe * 2}px ${a.scallop}px`}} />
        <div style={{position: 'absolute', left: 50, right: 50, top: 540, background: st.palette.surface, borderRadius: 8, padding: '54px 48px 36px', boxShadow: '0 30px 70px rgba(40,30,10,0.28)', transform: 'rotate(-1.2deg)', display: 'flex', flexDirection: 'column', gap: 22}}>
          <div style={{position: 'absolute', top: -18, left: 70, width: 170, height: 44, background: `${st.palette.accent}cc`, transform: 'rotate(-5deg)'}} />
          <div style={{position: 'absolute', top: -16, right: 70, width: 150, height: 44, background: `${st.palette.accent}cc`, transform: 'rotate(4deg)'}} />
          <div style={{alignSelf: 'flex-start', background: st.palette.emphBg, color: st.palette.emphText, fontFamily: st.fonts.body, fontWeight: 800, fontSize: 40, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '8px 24px 12px', borderRadius: 8}}>{kicker}</div>
          {lines.map((line, li) => (
            <div key={li} style={{fontFamily: st.fonts.display, fontWeight: 400, fontSize: sz, lineHeight: 1.08, color: st.palette.textOnSurface, whiteSpace: 'nowrap'}}>
              {line.split(' ').map((w, wi) => word(w, wi, st.palette.emphBg))}
            </div>
          ))}
          {sub ? <div style={{fontFamily: st.fonts.body, fontWeight: 700, fontSize: 46, color: `${st.palette.textOnSurface}cc`, lineHeight: 1.28, whiteSpace: 'pre-line'}}>{sub}</div> : null}
          <div style={{display: 'flex', marginTop: 10, borderTop: `4px dashed ${st.palette.textOnSurface}44`}}>
            {Array.from({length: 5}, (_, k) => (
              <div key={k} style={{flex: 1, height: 230, borderLeft: k ? `3px dashed ${st.palette.textOnSurface}33` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <div style={{transform: 'rotate(-90deg)', fontFamily: st.fonts.body, fontWeight: 800, fontSize: 32, color: `${st.palette.textOnSurface}aa`, whiteSpace: 'nowrap'}}>{k % 2 ? 'Du học D-4' : 'Làm thêm'}</div>
              </div>
            ))}
          </div>
        </div>
        {brand.name ? <div style={{position: 'absolute', left: 0, right: 0, bottom: 470, textAlign: 'center', fontFamily: st.fonts.body, fontWeight: 800, fontSize: 36, color: `${st.palette.textOnSurface}aa`}}>@ {brand.name}</div> : null}
      </AbsoluteFill>
    );
  }
  if (st.broll === 'film') {
    // khung tựa phim: đen, hai dải phim trên dưới, tựa vàng khổng lồ
    const sz = fitDisplay(st, lines, 960, 230);
    const strip = (top: number) => (
      <div style={{position: 'absolute', left: 0, right: 0, top, height: 120, background: '#050505'}}>
        <div style={{position: 'absolute', left: 0, right: 0, top: 18, height: FILM.hole.h, backgroundImage: `linear-gradient(90deg, #e8dfc8 0 ${FILM.hole.w}px, transparent ${FILM.hole.w}px)`, backgroundSize: `${FILM.hole.gap}px ${FILM.hole.h}px`}} />
        <div style={{position: 'absolute', left: 0, right: 0, bottom: 18, height: FILM.hole.h, backgroundImage: `linear-gradient(90deg, #e8dfc8 0 ${FILM.hole.w}px, transparent ${FILM.hole.w}px)`, backgroundSize: `${FILM.hole.gap}px ${FILM.hole.h}px`}} />
      </div>
    );
    return (
      <AbsoluteFill style={{background: '#111111', ...exitStyle}}>
        {strip(250)}
        {strip(1480)}
        <AbsoluteFill style={{padding: '470px 60px 0', display: 'flex', flexDirection: 'column', gap: 22}}>
          <div style={{alignSelf: 'flex-start', fontFamily: st.fonts.body, fontWeight: 900, fontSize: 40, color: '#fff', background: st.palette.accent2, padding: '8px 22px 10px', letterSpacing: '0.1em', textTransform: 'uppercase', transform: 'skewX(-8deg)'}}>{kicker}</div>
          {lines.map((line, li) => (
            <div key={li} style={{fontFamily: st.fonts.display, fontWeight: 700, fontSize: sz, lineHeight: 0.98, color: st.palette.accent, whiteSpace: 'nowrap', textTransform: 'uppercase'}}>
              {line.split(' ').map((w, wi) => word(w, wi, '#ffffff'))}
            </div>
          ))}
          {sub ? <div style={{fontFamily: st.fonts.body, fontWeight: 800, fontSize: 46, color: '#f2e8cf', lineHeight: 1.3, maxWidth: 940}}>{sub}</div> : null}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{background: st.palette.surface, opacity: 1 - q, transform: `scale(${1 - 0.12 * q}) translateY(${-260 * q}px)`, transformOrigin: '50% 20%'}}>
      <AbsoluteFill style={{padding: '420px 72px 0', display: 'flex', flexDirection: 'column', gap: 26}}>
        <div style={{alignSelf: 'flex-start', background: st.palette.emphBg, color: st.palette.emphText, fontFamily: st.fonts.body, fontWeight: 800, fontSize: 44, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '8px 24px 12px', borderRadius: 10}}>{kicker}</div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
          {lines.map((line, li) => (
            <div key={li} style={{fontFamily: st.fonts.display, fontWeight: st.fonts.displayWeight, fontSize: size, lineHeight: 1.02, letterSpacing: '-0.01em', color: st.palette.textOnSurface, whiteSpace: 'nowrap'}}>
              {line.split(' ').map((w, wi) => (
                <React.Fragment key={wi}>
                  {wi ? ' ' : null}
                  {hiSet.has(w) ? (
                    <span style={{color: st.palette.emphBg}}>
                      <MarkerHighlight at={-20} color={`${st.palette.accent}cc`}>{w}</MarkerHighlight>
                    </span>
                  ) : (
                    w
                  )}
                </React.Fragment>
              ))}
            </div>
          ))}
        </div>
        {sub ? <div style={{fontFamily: st.fonts.body, fontWeight: 700, fontSize: 48, color: `${st.palette.textOnSurface}cc`, lineHeight: 1.25, maxWidth: 900}}>{sub}</div> : null}
      </AbsoluteFill>
      {brand.name ? (
        <div style={{position: 'absolute', left: 72, bottom: 470, fontFamily: st.fonts.body, fontWeight: 800, fontSize: 38, color: `${st.palette.textOnSurface}99`, letterSpacing: '0.04em'}}>@ {brand.name}</div>
      ) : null}
    </AbsoluteFill>
  );
};
