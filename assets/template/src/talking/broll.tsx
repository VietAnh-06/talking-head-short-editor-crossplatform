import React, {createContext, useContext} from 'react';
import {AbsoluteFill, Easing, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont as loadMono} from '@remotion/google-fonts/JetBrainsMono';
import {loadFont as loadPlexMono} from '@remotion/google-fonts/IBMPlexMono';
import {loadFont as loadOverpassMono} from '@remotion/google-fonts/OverpassMono';
import {MaskReveal} from '../components/motion-text';
import {FPS} from './edit-data';
import {BeatsApi, createBeatsApi, ResolvedBeat, TRANSITION} from './edit-core';
import {Ambience, Sfx, SfxName} from './sfx';
import {fitDisplay, PAGE, StyleSpec, useStyle} from './style';
import {MarkerCircle, MarkerHighlight} from './motion';

export type {Beat, BeatSpec, ResolvedBeat} from './edit-core';
export {resolveBeats, TRANSITION} from './edit-core';

const BeatsContext = createContext<BeatsApi | null>(null);

// Thương hiệu in trên biên lai: logo (đường dẫn trong public/) hoặc tên kênh dạng chữ khi kênh không có logo.
// Không bọc BrandProvider thì giữ logo LETCO như các video trước.
export type Brand = {logo?: string; name?: string};
const BrandContext = createContext<Brand>({logo: 'img/logo-letco.png'});
export const BrandProvider = BrandContext.Provider;
export const useBrand = () => useContext(BrandContext);

export const BeatsProvider: React.FC<{beats: ResolvedBeat[]; children: React.ReactNode}> = ({beats, children}) => (
  <BeatsContext.Provider value={createBeatsApi(beats)}>{children}</BeatsContext.Provider>
);

export const useBeats = () => {
  const api = useContext(BeatsContext);
  if (!api) throw new Error('useBeats phải nằm trong BeatsProvider');
  return api;
};

export const CARD = {left: 60, top: 610, width: 960, height: 780};
// Bố cục chia đôi: B-roll phía trên, thầy ở bảng phía dưới
export const SPLIT = {seam: 1000};

type Entrance = 'open' | 'in' | 'whip-left' | 'whip-right';

// Tiếng chuyển cảnh phát từ đầu file, 3 khung trước nhát cắt (đã kiểm trên 12 video). Đã thử canh đỉnh âm vào nhát cắt
// (align="peak"): tiếng phải bắt đầu sớm tới 0,6 s nên đè chữ đứng ngay trước cụm neo ("LETCO" → "NETCO" trên clip-12).

// Độ nghiêng (px) của vạch chuyển cảnh 'stripe'
const STRIPE_SLANT = 420;

// Mép xé răng cưa của chuyển cảnh 'tear' (px): bước răng và biên độ
const TEAR_STEP = 36;
const TEAR_AMP = 16;
const tearZig = (edge: number, offset = 0) =>
  Array.from({length: Math.ceil(1080 / TEAR_STEP) + 1}, (_, k) => {
    const x = Math.min(1080, k * TEAR_STEP);
    const y = edge + offset + (k % 2 ? TEAR_AMP : -TEAR_AMP) + (((k * 37) % 7) - 3) * 2;
    return `${x}px ${y}px`;
  });
const tearPolygon = (edge: number, keep: 'above' | 'below') =>
  keep === 'above' ? `polygon(0 0, 1080px 0, ${tearZig(edge).reverse().join(', ')})` : `polygon(${tearZig(edge).join(', ')}, 1080px 1920px, 0 1920px)`;

// Lưới chấm của chuyển cảnh 'bubble' (px): ô lưới và bán kính phủ kín ô (≥ nửa đường chéo)
const BUBBLE_CELL = 120;
const BUBBLE_FULL = 88;

// Dải dấu hủy tem của chuyển cảnh 'postmark' (px): bề rộng dải giấy, khoảng cách và biên độ các vạch lượn sóng
const POSTMARK_BAND = 210;
const POSTMARK_GAP = 58;
const POSTMARK_AMP = 11;

// Lưới ô của chuyển cảnh 'checker' (px): ô lật mở dần theo đường chéo từ góc trên trái; STAGGER là phần thời lượng dành cho độ lệch giữa ô đầu và ô cuối
const CHECKER_CELL = 135;
const CHECKER_STAGGER = 0.55;
const CHECKER_COLS = Math.ceil(1080 / CHECKER_CELL);
const CHECKER_ROWS = Math.ceil(1920 / CHECKER_CELL);
const checkerClip = (q: number): string | undefined => {
  if (q >= 1) return undefined;
  const span = CHECKER_COLS + CHECKER_ROWS - 2;
  const cells: string[] = [];
  for (let r = 0; r < CHECKER_ROWS; r++) {
    for (let c = 0; c < CHECKER_COLS; c++) {
      const local = Math.min(1, Math.max(0, (q - ((r + c) / span) * CHECKER_STAGGER) / (1 - CHECKER_STAGGER)));
      if (local <= 0) continue;
      // nửa cạnh +0,5 px để ô kề nhau liền mép, không lộ đường kẻ khi đã mở hết
      const half = (CHECKER_CELL * local) / 2 + 0.5;
      const cx = c * CHECKER_CELL + CHECKER_CELL / 2;
      const cy = r * CHECKER_CELL + CHECKER_CELL / 2;
      cells.push(`M${cx - half} ${cy - half}H${cx + half}V${cy + half}H${cx - half}Z`);
    }
  }
  return cells.length ? `path('${cells.join('')}')` : 'inset(50% 50% 50% 50%)';
};

// Vệt sáng của chuyển cảnh 'lightleak': dải sáng ấm quét chéo qua khung (pos: % theo chiều quét), mạnh nhất giữa chuyển cảnh
const LightLeak: React.FC<{pos: number; strength: number; s: StyleSpec}> = ({pos, strength, s}) => (
  <AbsoluteFill style={{pointerEvents: 'none', mixBlendMode: 'screen', opacity: strength}}>
    <AbsoluteFill style={{background: `linear-gradient(115deg, transparent ${pos - 45}%, ${s.palette.accent2}99 ${pos - 22}%, #fff1d0 ${pos}%, ${s.palette.accent}aa ${pos + 18}%, transparent ${pos + 42}%)`}} />
    <AbsoluteFill style={{background: `radial-gradient(ellipse 60% 35% at ${pos}% ${100 - pos * 0.6}%, #ffe4b0cc, transparent 70%)`}} />
  </AbsoluteFill>
);

// Kim quét của chuyển cảnh 'clockwipe': vạch màu nhấn từ tâm ra ngoài, xoay theo góc đã quét. Bố cục trang (payslip) có ô B-roll
// riêng: kim quay quanh tâm ô và bị cắt trong ô, để không vẽ đè lên thẻ, phụ đề hay chân trang.
const clockBox = (s: StyleSpec) => (s.broll === 'payslip' ? PAYSLIP.main : undefined);
const clockCenter = (s: StyleSpec) => {
  const b = clockBox(s);
  return b ? {x: b.left + b.width / 2, y: b.top + b.height / 2} : {x: 540, y: 960};
};
const ClockHand: React.FC<{deg: number; s: StyleSpec}> = ({deg, s}) => {
  const b = clockBox(s);
  const c = clockCenter(s);
  const len = b ? Math.hypot(b.width, b.height) / 2 + 20 : 1200;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', clipPath: b ? `inset(${b.top}px ${1080 - b.left - b.width}px ${1920 - b.top - b.height}px ${b.left}px round ${PAYSLIP.radius}px)` : undefined}}>
      <div style={{position: 'absolute', left: c.x - 5, top: c.y - len, width: 10, height: len, background: s.palette.accent, boxShadow: `0 0 24px ${s.palette.accent}`, transformOrigin: '50% 100%', transform: `rotate(${deg}deg)`}} />
      <div style={{position: 'absolute', left: c.x - 22, top: c.y - 22, width: 44, height: 44, borderRadius: 22, background: s.palette.surface, border: `8px solid ${s.palette.accent}`}} />
    </AbsoluteFill>
  );
};

// Chữ đơn cách cho dòng in hóa đơn; chỉ nạp khi style dùng tới
let mono: string | undefined;
export const monoFont = () => (mono ??= loadMono('normal', {weights: ['700', '800'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily);

// Mép dưới răng cưa của tờ giấy (hóa đơn, nhãn tiêu đề) cho clipPath, theo bề rộng px
const zigBottom = (width: number, step = 22, depth = 14) => {
  const pts = Array.from({length: Math.ceil(width / step) + 1}, (_, k) => `${Math.min(width, k * step)}px ${k % 2 ? '100%' : `calc(100% - ${depth}px)`}`);
  return `polygon(0 0, ${width}px 0, ${pts.reverse().join(', ')})`;
};

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// Biến đổi toàn cảnh theo kiểu chuyển cảnh của style: vào (p: 0→1) và ra về cảnh thầy (out: 0→1)
const transitionStyle = (s: StyleSpec, entrance: Entrance, p: number, out: number, frame: number): {style: React.CSSProperties; flash: number; glitch: number; stripe?: number; tear?: number; postmark?: number; clock?: number; shutter?: number; crt?: CrtState; leak?: {pos: number; strength: number}} => {
  const dir = entrance === 'whip-left' ? -1 : 1;
  const between = entrance === 'whip-left' || entrance === 'whip-right';
  switch (s.transition) {
    case 'tear': {
      // tờ mới xé dọc từ trên xuống: cảnh mới nằm trên mép răng cưa; khi về cảnh thầy thì mép xé tiếp và kéo cảnh đi
      const q = entrance === 'open' ? 1 : p;
      const span = [-TEAR_AMP * 3, 1920 + TEAR_AMP * 3];
      const inEdge = interpolate(q, [0, 1], span);
      const outEdge = interpolate(out, [0, 1], span);
      const clipPath = out > 0 ? tearPolygon(outEdge, 'below') : q < 1 ? tearPolygon(inEdge, 'above') : undefined;
      return {style: {clipPath}, flash: 0, glitch: 0, tear: out > 0 ? (out < 1 ? outEdge : undefined) : q < 1 ? inEdge : undefined};
    }
    case 'bubble': {
      // tô ô trắc nghiệm: cảnh mới lộ ra qua lưới chấm tròn lớn dần rồi liền lại; về cảnh thầy thì chấm co lại
      const q = entrance === 'open' ? 1 : p;
      const r = out > 0 ? (1 - out) * BUBBLE_FULL : q * BUBBLE_FULL;
      const mask = r < BUBBLE_FULL - 1 ? `radial-gradient(circle at center, #000 ${r}px, transparent ${r + 1.5}px)` : undefined;
      return {
        style: mask ? {WebkitMaskImage: mask, maskImage: mask, WebkitMaskSize: `${BUBBLE_CELL}px ${BUBBLE_CELL}px`, maskSize: `${BUBBLE_CELL}px ${BUBBLE_CELL}px`, WebkitMaskPosition: 'center', maskPosition: 'center', transform: `scale(${interpolate(q, [0, 1], [1.04, 1]) + out * 0.03})`} : {},
        flash: 0,
        glitch: 0,
      };
    }
    case 'postmark': {
      // con lăn dấu bưu điện chạy ngang: dải giấy có vạch lượn sóng quét qua, cảnh mới lộ ra ở phía sau dải
      const q = entrance === 'open' ? 1 : p;
      const span = [-POSTMARK_BAND, 1080 + POSTMARK_BAND];
      const inEdge = interpolate(q, [0, 1], span);
      const outEdge = interpolate(out, [0, 1], span);
      const half = POSTMARK_BAND / 2;
      const clipPath = out > 0
        ? `polygon(${outEdge - half}px 0, 1080px 0, 1080px 1920px, ${outEdge - half}px 1920px)`
        : q < 1 ? `polygon(0 0, ${inEdge - half}px 0, ${inEdge - half}px 1920px, 0 1920px)` : undefined;
      return {style: {clipPath}, flash: 0, glitch: 0, postmark: out > 0 ? (out < 1 ? outEdge : undefined) : q < 1 ? inEdge : undefined};
    }
    case 'stripe': {
      // vạch chéo quét ngang: cảnh mới lộ ra sau mép vạch, khi về cảnh thầy thì vạch quét tiếp và mang cảnh đi
      const q = entrance === 'open' ? 1 : p;
      const inEdge = interpolate(q, [0, 1], [-STRIPE_SLANT, 1080 + STRIPE_SLANT]);
      const outEdge = interpolate(out, [0, 1], [-STRIPE_SLANT, 1080 + STRIPE_SLANT]);
      const clipPath = out > 0
        ? `polygon(${outEdge + STRIPE_SLANT}px 0, 1080px 0, 1080px 1920px, ${outEdge}px 1920px)`
        : q < 1 ? `polygon(0 0, ${inEdge + STRIPE_SLANT}px 0, ${inEdge}px 1920px, 0 1920px)` : undefined;
      return {style: {clipPath}, flash: 0, glitch: 0, stripe: out > 0 ? (out < 1 ? outEdge : undefined) : q < 1 ? inEdge : undefined};
    }
    case 'clockwipe': {
      // kim đồng hồ quét một vòng từ 12 giờ: cảnh mới lộ ra sau kim; về cảnh thầy thì kim quét tiếp và xóa cảnh theo vòng
      const q = entrance === 'open' ? 1 : p;
      const deg = out > 0 ? out * 360 : q * 360;
      const c = clockCenter(s);
      const at = `${c.x}px ${c.y}px`;
      const mask = out > 0 ? `conic-gradient(from 0deg at ${at}, transparent ${deg}deg, #000 ${deg + 0.5}deg)` : q < 1 ? `conic-gradient(from 0deg at ${at}, #000 ${deg}deg, transparent ${deg + 0.5}deg)` : undefined;
      return {style: mask ? {WebkitMaskImage: mask, maskImage: mask} : {}, flash: 0, glitch: 0, clock: (out > 0 && out < 1) || q < 1 ? deg : undefined};
    }
    case 'shutter': {
      // cửa cuốn cửa hàng kéo lên: cảnh mới lộ từ dưới lên sau thanh đáy cửa cuốn; về cảnh thầy thì cửa kéo xuống che lại
      const q = entrance === 'open' ? 1 : p;
      const w = STORE.window;
      const edge = out > 0 ? w.top + w.height * out : w.top + w.height * (1 - q);
      const clipPath = out > 0 ? `inset(${edge}px 0 0 0)` : q < 1 ? `inset(${edge}px 0 0 0)` : undefined;
      return {style: {clipPath}, flash: 0, glitch: 0, shutter: (out > 0 && out < 1) || q < 1 ? edge : undefined};
    }
    case 'backlight':
      // đèn nền hộp đèn chớp: chỉ ô hộp đèn đổi (xem backlightState); cả cảnh không biến đổi nên khung trang và nhãn đứng yên
      return {style: {}, flash: 0, glitch: 0};
    case 'policeline':
      // dải băng cảnh sát quét chéo: chỉ tác động trong ô ảnh (xem policeState), cả cảnh không biến đổi nên tờ biên bản và phụ đề đứng yên
      return {style: {}, flash: 0, glitch: 0};
    case 'screendoor':
      // hai cánh cửa kính chắn tàu khép rồi mở: chỉ tác động trong ô cửa (xem doorState), cả cảnh không biến đổi nên tường ga, bảng và nhãn đứng yên
      return {style: {}, flash: 0, glitch: 0};
    case 'photofinish':
      // vạch ảnh chụp đích quét ngang dải ảnh: chỉ tác động trong dải (xem photoState), cả cảnh không biến đổi nên khung trang và nhãn đứng yên
      return {style: {}, flash: 0, glitch: 0};
    case 'crt': {
      // màn hình CRT tắt: cảnh ép thành vạch sáng rồi chấm, cảnh mới bung ra từ chấm; chỉ tác động trong ô kính nên không biến đổi cả khung
      return {style: {}, flash: 0, glitch: 0, crt: crtState(interpolate(frame, [0, CRT_FRAMES], [0, 1], clamp), out, entrance)};
    }
    case 'checker': {
      // ô bàn cờ lật mở lan chéo từ góc trên trái; về cảnh thầy thì các ô thu lại theo thứ tự ngược
      const q = entrance === 'open' ? 1 : p;
      const clipPath = out > 0 ? checkerClip(1 - out) : checkerClip(q);
      return {style: {clipPath, transform: `scale(${interpolate(q, [0, 1], [1.05, 1]) + out * 0.03})`}, flash: 0, glitch: 0};
    }
    case 'lightleak': {
      // vệt sáng phim quét chéo: cảnh mới hiện dần dưới vệt sáng, phơi sáng quá rồi về đúng; về cảnh thầy thì vệt sáng quét lại và cảnh tan
      const q = entrance === 'open' ? 1 : p;
      const strength = Math.sin(Math.PI * (out > 0 ? out : q));
      return {
        style: {opacity: interpolate(q, [0, 0.45], [0, 1], clamp) * (1 - out), filter: strength > 0.02 ? `brightness(${1 + strength * 0.7}) saturate(${1 + strength * 0.25})` : undefined},
        flash: 0,
        glitch: 0,
        leak: strength > 0.02 ? {pos: interpolate(out > 0 ? out : q, [0, 1], [-30, 130]), strength} : undefined,
      };
    }
    case 'print': {
      // máy in sổ: dòng mới in từ trên xuống, mép in là một vạch mực đi xuống
      const q = entrance === 'open' ? 1 : p;
      return {style: {clipPath: q < 1 ? `inset(0 0 ${(1 - q) * 100}% 0)` : undefined, opacity: 1 - out}, flash: 0, glitch: 0};
    }
    case 'swipe': {
      // vuốt story trong app: bài mới đẩy từ phải sang, hơi thu nhỏ rồi bung đúng cỡ
      const q = entrance === 'open' ? 1 : p;
      return {style: {transform: `translateX(${interpolate(q, [0, 1], [1080, 0])}px) scale(${interpolate(q, [0, 0.7, 1], [0.92, 0.97, 1])})`, opacity: 1 - out}, flash: 0, glitch: 0};
    }
    case 'advance': {
      // cuộn phim: khung mới kéo từ phải vào như phim chạy, mờ nhòe theo chiều ngang lúc đang chạy
      const q = entrance === 'open' ? 1 : p;
      const blur = (1 - q) * 18;
      return {style: {transform: `translateX(${interpolate(q, [0, 1], [1080, 0])}px)`, filter: blur > 0.3 ? `blur(${blur}px)` : undefined, opacity: 1 - out}, flash: 0, glitch: 0};
    }
    case 'flash':
      return {style: {transform: `scale(${interpolate(p, [0, 1], [1.06, 1]) + out * 0.04})`, opacity: 1 - out}, flash: Math.max(1 - p, out) * (entrance === 'open' ? 0 : 1), glitch: 0};
    case 'slide':
      return {
        style: {transform: `translateX(${interpolate(p, [0, 1], [dir * 1080, 0]) - out * 1080}px) rotate(${interpolate(p, [0, 1], [dir * 3, 0])}deg)`},
        flash: 0,
        glitch: 0,
      };
    case 'soft':
      return {style: {opacity: (entrance === 'open' ? 1 : p) * (1 - out), transform: `scale(${interpolate(p, [0, 1], [1.04, 1]) + out * 0.03})`}, flash: 0, glitch: 0};
    case 'glitch': {
      const g = Math.max(1 - p, out) * (entrance === 'open' ? 0 : 1);
      const jitter = g > 0.05 ? ((frame * 37) % 7) - 3 : 0;
      return {style: {transform: `translateX(${jitter * 14 * g}px)`, opacity: interpolate(p, [0, 0.4], [0, 1], clamp) * (1 - out * 0.9), filter: g > 0.05 ? `hue-rotate(${g * 90}deg) saturate(${1 + g * 2})` : undefined}, flash: 0, glitch: g};
    }
    case 'zoomwhip':
    default: {
      const inT = between ? `translateX(${interpolate(p, [0, 1], [dir * 1080, 0])}px) scale(${interpolate(p, [0, 1], [1.08, 1])})` : `scale(${interpolate(p, [0, 1], [1.3, 1])})`;
      const blur = interpolate(p, [0, 1], [between ? 28 : 22, 0]) + out * 20;
      return {
        style: {transform: `${inT} scale(${1 + out * 0.18})`, filter: blur > 0.3 ? `blur(${blur}px)` : undefined, opacity: (between ? 1 : interpolate(p, [0, 0.5], [0, 1], clamp)) * (1 - out)},
        flash: 0,
        glitch: 0,
      };
    }
  }
};

const ClipVideo: React.FC<{beat: Extract<ResolvedBeat, {kind: 'broll'}>; kb: number; style?: React.CSSProperties}> = ({beat, kb, style}) => (
  <OffthreadVideo
    src={staticFile(`broll/${beat.clip}.mp4`)}
    trimBefore={Math.round((beat.startSec ?? 0.4) * FPS)}
    muted
    style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${beat.focusX ?? 50}% 50%`, transform: `scale(${kb})`, ...style}}
  />
);

const BlurBg: React.FC<{beat: Extract<ResolvedBeat, {kind: 'broll'}>; s: StyleSpec}> = ({beat, s}) => (
  <AbsoluteFill style={{overflow: 'hidden', backgroundColor: s.palette.bg}}>
    <Img src={staticFile(`broll/${beat.clip}.jpg`)} style={{width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(34px) brightness(0.58) saturate(1.35)', transform: 'scale(1.25)'}} />
    <AbsoluteFill style={{background: `linear-gradient(180deg, ${s.palette.bg}cc 0%, ${s.palette.bg}22 35%, ${s.palette.bg}44 70%, ${s.palette.bg}dd 100%)`}} />
  </AbsoluteFill>
);

const Label: React.FC<{text: string; s: StyleSpec; chip: number; variant: 'chip' | 'bar' | 'hand'}> = ({text, s, chip, variant}) => {
  if (variant === 'hand') {
    return <div style={{fontFamily: s.fonts.display, fontWeight: 800, fontSize: 52, color: s.palette.textOnSurface, transform: `rotate(-2deg) scale(${chip})`, transformOrigin: 'left center'}}>{text}</div>;
  }
  if (variant === 'bar') {
    return (
      <div style={{display: 'inline-flex', transform: `translateX(${interpolate(chip, [0, 1], [-700, 0])}px)`}}>
        <div style={{width: 14, background: s.palette.accent}} />
        <div style={{fontFamily: s.fonts.display, fontWeight: s.fonts.displayWeight, fontSize: 46, textTransform: s.fonts.uppercaseDisplay ? 'uppercase' : 'none', color: s.palette.textOnSurface, background: s.palette.surface, padding: '8px 26px 12px'}}>{text}</div>
      </div>
    );
  }
  return (
    <div
      style={{
        fontFamily: s.fonts.body,
        fontWeight: 800,
        fontSize: 36,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: s.palette.chipText,
        background: s.palette.chipBg,
        padding: '8px 22px 11px',
        borderRadius: 14,
        transform: `translateX(${interpolate(chip, [0, 1], [-260, 0])}px)`,
        boxShadow: s.transition === 'glitch' ? `0 0 24px ${s.palette.chipBg}` : '0 10px 30px rgba(0,0,0,0.35)',
        display: 'inline-block',
      }}
    >
      {text}
    </div>
  );
};

// Một cảnh minh họa theo bố cục và chuyển cảnh của style
const BrollScene: React.FC<{beat: Extract<ResolvedBeat, {kind: 'broll'}>; entrance: Entrance; toTalk: boolean; length: number; index: number}> = ({
  beat,
  entrance,
  toTalk,
  length,
  index,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = useStyle();
  const kb = interpolate(frame, [0, length], [1.06, 1.16], {easing: Easing.inOut(Easing.quad)});
  const chip = spring({frame: frame - 5, fps, config: {damping: 14, stiffness: 220}});
  // cảnh mở đầu video không có gì bên dưới nên hiện ngay, không chuyển cảnh
  const p = entrance === 'open' ? 1 : interpolate(frame, [0, TRANSITION], [0, 1], {...clamp, easing: Easing.bezier(0.2, 0.8, 0.2, 1)});
  const out = toTalk ? interpolate(frame, [length - TRANSITION, length], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)}) : 0;
  const t = transitionStyle(s, entrance, p, out, frame);
  let content: React.ReactNode;
  if (s.broll === 'fullbleed') {
    content = (
      <>
        <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#000'}}>
          <ClipVideo beat={beat} kb={kb * 1.02} style={{filter: 'contrast(1.06) saturate(1.1)'}} />
        </AbsoluteFill>
        <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.75) 100%)'}} />
        {beat.label ? <div style={{position: 'absolute', left: 0, top: 1240}}><Label text={beat.label} s={s} chip={chip} variant="bar" /></div> : null}
      </>
    );
  } else if (s.broll === 'polaroid') {
    const tilt = index % 2 ? 3 : -3;
    content = (
      <>
        <BlurBg beat={beat} s={s} />
        <div style={{position: 'absolute', left: 90, top: 600, width: 900, background: s.palette.surface, padding: '26px 26px 0', boxShadow: '0 40px 90px rgba(0,0,0,0.5)', transform: `rotate(${tilt}deg)`}}>
          <div style={{width: '100%', height: 640, overflow: 'hidden', backgroundColor: '#000'}}>
            <ClipVideo beat={beat} kb={kb} style={{filter: 'sepia(0.12) saturate(1.1)'}} />
          </div>
          <div style={{height: 120, display: 'flex', alignItems: 'center', paddingLeft: 10}}>{beat.label ? <Label text={beat.label} s={s} chip={chip} variant="hand" /> : null}</div>
          <div style={{position: 'absolute', top: -26, left: 60, width: 170, height: 52, background: `${s.palette.accent}cc`, transform: 'rotate(-6deg)'}} />
          <div style={{position: 'absolute', top: -22, right: 60, width: 150, height: 52, background: `${s.palette.accent2}bb`, transform: 'rotate(5deg)'}} />
        </div>
      </>
    );
  } else if (s.broll === 'split') {
    content = (
      <>
        <AbsoluteFill style={{backgroundColor: s.palette.bg}} />
        <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: SPLIT.seam, overflow: 'hidden'}}>
          <ClipVideo beat={beat} kb={kb} />
          <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.25) 42%, rgba(0,0,0,0.4) 100%)'}} />
        </div>
        <div style={{position: 'absolute', left: 0, right: 0, top: SPLIT.seam - 3, height: 6, background: s.palette.accent}} />
        {beat.label ? <div style={{position: 'absolute', left: 60, top: SPLIT.seam - 90}}><Label text={beat.label} s={s} chip={chip} variant="chip" /></div> : null}
      </>
    );
  } else if (s.broll === 'receipt') {
    content = (
      <>
        <BlurBg beat={beat} s={s} />
        <ReceiptCard beat={beat} kb={kb} s={s} index={index} frame={frame} instant={entrance === 'open'} />
      </>
    );
  } else if (s.broll === 'omr') {
    content = (
      <>
        <BlurBg beat={beat} s={s} />
        <OmrCard beat={beat} kb={kb} s={s} index={index} frame={frame} />
      </>
    );
  } else if (s.broll === 'passbook') {
    content = <PassbookStrip beat={beat} kb={kb} s={s} index={index} frame={frame} />;
  } else if (s.broll === 'phone') {
    content = <PhonePost beat={beat} kb={kb} s={s} index={index} frame={frame} />;
  } else if (s.broll === 'dossier') {
    content = <DossierPhoto beat={beat} kb={kb} s={s} index={index} frame={frame} />;
  } else if (s.broll === 'tray') {
    content = <TrayCompartment beat={beat} kb={kb} s={s} index={index} frame={frame} />;
  } else if (s.broll === 'payslip') {
    content = <PayslipCell beat={beat} kb={kb} s={s} index={index} frame={frame} />;
  } else if (s.broll === 'console') {
    content = <ConsoleMonitor beat={beat} kb={kb} s={s} index={index} frame={frame} crt={t.crt} labelAt={consoleLabelAt(entrance)} />;
  } else if (s.broll === 'lightbox') {
    content = <LightboxWindow beat={beat} kb={kb} s={s} index={index} frame={frame} bl={backlightState(frame, out, entrance)} out={out} labelAt={consoleLabelAt(entrance)} />;
  } else if (s.broll === 'citation') {
    content = <CitationPhoto beat={beat} kb={kb} s={s} index={index} frame={frame} police={policeState(frame, out, entrance)} labelAt={consoleLabelAt(entrance)} />;
  } else if (s.broll === 'track') {
    content = <TrackStrip beat={beat} kb={kb} s={s} index={index} frame={frame} photo={photoState(frame, out, entrance)} labelAt={consoleLabelAt(entrance)} />;
  } else if (s.broll === 'platform') {
    content = <PlatformDoor beat={beat} kb={kb} s={s} index={index} frame={frame} door={doorState(frame, out, entrance)} labelAt={consoleLabelAt(entrance)} signOut={interpolate(frame, [length - TRANSITION - 3, length - TRANSITION], [1, 0], clamp)} />;
  } else if (s.broll === 'storefront') {
    content = <StoreWindow beat={beat} kb={kb} s={s} index={index} frame={frame} />;
  } else if (s.broll === 'film') {
    content = <FilmFrame beat={beat} kb={kb} s={s} index={index} frame={frame} />;
  } else if (s.broll === 'envelope') {
    content = (
      <>
        <BlurBg beat={beat} s={s} />
        <EnvelopeCard beat={beat} kb={kb} s={s} index={index} frame={frame} />
      </>
    );
  } else if (s.broll === 'ticket') {
    content = (
      <>
        <BlurBg beat={beat} s={s} />
        <TicketCard beat={beat} kb={kb} chip={chip} s={s} index={index} />
      </>
    );
  } else {
    const neon = s.transition === 'glitch';
    content = (
      <>
        <BlurBg beat={beat} s={s} />
        <div
          style={{
            position: 'absolute',
            ...CARD,
            borderRadius: neon ? 18 : 40,
            overflow: 'hidden',
            boxShadow: neon ? `0 0 0 4px ${s.palette.accent}, 0 0 50px ${s.palette.accent}88, 0 0 120px ${s.palette.accent2}44` : '0 40px 100px rgba(0,0,0,0.55), 0 0 0 4px rgba(255,255,255,0.9)',
            backgroundColor: '#000',
          }}
        >
          <ClipVideo beat={beat} kb={kb} />
          <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.35) 100%)'}} />
          {beat.label ? <div style={{position: 'absolute', top: 28, left: 28}}><Label text={beat.label} s={s} chip={chip} variant="chip" /></div> : null}
        </div>
      </>
    );
  }
  return (
    <>
    <AbsoluteFill style={t.style}>
      {content}
      {t.flash > 0.01 ? <AbsoluteFill style={{backgroundColor: '#fff', opacity: t.flash}} /> : null}
      {t.leak ? <LightLeak pos={t.leak.pos} strength={t.leak.strength} s={s} /> : null}
      {t.glitch > 0.05 ? (
        <AbsoluteFill style={{mixBlendMode: 'screen', opacity: t.glitch}}>
          {[0, 1, 2, 3, 4].map((k) => (
            <div key={k} style={{position: 'absolute', left: 0, right: 0, top: ((frame * 131 + k * 397) % 1800), height: 20 + ((k * 53 + frame * 17) % 60), background: k % 2 ? s.palette.accent : s.palette.accent2, opacity: 0.55}} />
          ))}
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
    {t.stripe !== undefined && t.stripe > -STRIPE_SLANT && t.stripe < 1080 + STRIPE_SLANT ? (
      <AbsoluteFill style={{pointerEvents: 'none'}}>
        {[
          {from: -70, to: -20, color: s.palette.accent2},
          {from: -20, to: 50, color: s.palette.emphBg},
        ].map((b) => {
          const x = (t.stripe as number);
          return (
            <div
              key={b.color}
              style={{
                position: 'absolute',
                inset: 0,
                background: b.color,
                clipPath: `polygon(${x + b.from + STRIPE_SLANT}px 0, ${x + b.to + STRIPE_SLANT}px 0, ${x + b.to}px 1920px, ${x + b.from}px 1920px)`,
              }}
            />
          );
        })}
      </AbsoluteFill>
    ) : null}
    {t.tear !== undefined ? <TearEdge edge={t.tear} s={s} /> : null}
    {t.postmark !== undefined ? <PostmarkBand edge={t.postmark} s={s} /> : null}
    {t.clock !== undefined ? <ClockHand deg={t.clock} s={s} /> : null}
    {t.shutter !== undefined ? <ShutterBand edge={t.shutter} s={s} /> : null}
    </>
  );
};

// Sợi giấy ở mép xé: dải màu giấy rồi bóng đổ, vẽ ngoài phần cảnh bị cắt; chỉ có trong lúc chuyển
const TearEdge: React.FC<{edge: number; s: StyleSpec}> = ({edge, s}) => {
  const band = (a: number, b: number) => `polygon(${tearZig(edge, a).join(', ')}, ${tearZig(edge, b).reverse().join(', ')})`;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <AbsoluteFill style={{background: 'rgba(0,0,0,0.35)', clipPath: band(14, 34)}} />
      <AbsoluteFill style={{background: s.palette.surface, clipPath: band(-2, 16)}} />
    </AbsoluteFill>
  );
};

// Hóa đơn in nhiệt: tờ giấy nhả ra từ khe máy in, hình ở giữa, nhãn là một dòng mục hàng có chấm dẫn
export const RECEIPT = {left: 100, top: 572, width: 880, photo: 500};

// instant: cảnh mở đầu video hiện sẵn tờ giấy (khung 0 là ảnh bìa, không để trống)
const ReceiptCard: React.FC<{beat: Extract<ResolvedBeat, {kind: 'broll'}>; kb: number; s: StyleSpec; index: number; frame: number; instant?: boolean}> = ({beat, kb, s, index, frame, instant}) => {
  const feed = instant ? 1 : interpolate(frame, [2, 15], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const label = beat.label ?? '';
  const ink = s.palette.textOnSurface;
  const brand = useBrand();
  const rule = <div style={{borderTop: `3px dashed ${ink}44`, margin: '14px 0'}} />;
  return (
    <>
      <div style={{position: 'absolute', left: RECEIPT.left, width: RECEIPT.width, top: RECEIPT.top + 14, bottom: 0, overflow: 'hidden'}}>
        <div style={{transform: `translateY(${(feed - 1) * 840}px)`, filter: 'drop-shadow(0 30px 40px rgba(0,0,0,0.5))'}}>
          <div style={{background: s.palette.surface, clipPath: zigBottom(RECEIPT.width), padding: '20px 30px 44px'}}>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: monoFont(), fontWeight: 800, fontSize: 28, letterSpacing: '0.12em', color: ink}}>
              <span style={{display: 'inline-flex', alignItems: 'center', gap: 14}}>
                {brand.logo ? <Img src={staticFile(brand.logo)} style={{height: 32}} /> : <span style={{fontFamily: s.fonts.body, fontWeight: 800, fontSize: 30, letterSpacing: '0.02em', color: s.palette.emphBg}}>{brand.name}</span>}
                <span style={{color: `${ink}88`}}>·</span>
                BIÊN LAI
              </span>
              <span style={{color: s.palette.emphBg}}>#{String(index + 1).padStart(3, '0')}</span>
            </div>
            {rule}
            <div style={{height: RECEIPT.photo, overflow: 'hidden', backgroundColor: '#000', borderRadius: 6}}>
              <ClipVideo beat={beat} kb={kb} style={{filter: 'contrast(1.06) saturate(0.92) sepia(0.08)'}} />
            </div>
            {rule}
            <div style={{display: 'flex', alignItems: 'flex-end', gap: 16}}>
              <div style={{fontFamily: s.fonts.display, fontWeight: s.fonts.displayWeight, fontSize: Math.min(74, Math.floor(1300 / Math.max(1, label.length))), lineHeight: 1.08, color: ink, textTransform: 'uppercase', whiteSpace: 'nowrap'}}>{label}</div>
              <div style={{flex: 1, borderBottom: `5px dotted ${ink}66`, marginBottom: 16}} />
              <div style={{fontFamily: monoFont(), fontWeight: 800, fontSize: 34, color: ink, marginBottom: 6}}>×1</div>
            </div>
          </div>
        </div>
      </div>
      <div style={{position: 'absolute', left: RECEIPT.left - 34, width: RECEIPT.width + 68, top: RECEIPT.top, height: 30, borderRadius: 15, background: '#0b0907', boxShadow: 'inset 0 -6px 0 rgba(255,255,255,0.07), 0 12px 30px rgba(0,0,0,0.6)'}} />
    </>
  );
};

// Phiếu trả lời trắc nghiệm: vạch định vị ở lề trái, hình trong khung kẻ hồng, dưới là hàng 5 ô A–E có một ô được tô
// rộng 930: mép phải ≤ 990 px, chừa cột nút TikTok bên phải
export const OMR = {left: 60, top: 600, width: 930, photo: 510};
const OMR_CHOICES = ['A', 'B', 'C', 'D', 'E'];

const OmrCard: React.FC<{beat: Extract<ResolvedBeat, {kind: 'broll'}>; kb: number; s: StyleSpec; index: number; frame: number}> = ({beat, kb, s, index, frame}) => {
  const label = beat.label ?? '';
  const ink = s.palette.textOnSurface;
  const pink = s.palette.emphBg;
  const brand = useBrand();
  const pick = (index * 3 + 1) % OMR_CHOICES.length;
  const fill = interpolate(frame, [6, 14], [0, 1], {...clamp, easing: Easing.out(Easing.back(1.8))});
  const rise = interpolate(frame, [0, 10], [40, 0], {...clamp, easing: Easing.out(Easing.cubic)});
  return (
    <div style={{position: 'absolute', left: OMR.left, top: OMR.top, width: OMR.width, transform: `translateY(${rise}px) rotate(${index % 2 ? 0.8 : -0.8}deg)`, filter: 'drop-shadow(0 36px 60px rgba(0,0,0,0.55))'}}>
      <div style={{background: s.palette.surface, borderRadius: 10, padding: '20px 30px 26px 66px', position: 'relative'}}>
        <div style={{position: 'absolute', left: 20, top: 26, bottom: 26, display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}>
          {Array.from({length: 14}, (_, k) => <div key={k} style={{width: 24, height: 12, background: ink}} />)}
        </div>
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: s.fonts.body, fontWeight: 700, fontSize: 26, letterSpacing: '0.14em', color: pink, textTransform: 'uppercase'}}>
          <span style={{display: 'inline-flex', alignItems: 'center', gap: 14}}>
            {brand.logo ? <Img src={staticFile(brand.logo)} style={{height: 30}} /> : <span style={{letterSpacing: '0.02em', color: ink}}>{brand.name}</span>}
            {(brand.name ?? '').length > 20 ? null : (
              <>
                <span style={{color: `${ink}66`}}>·</span>
                Phiếu trả lời
              </>
            )}
          </span>
          <span style={{fontFamily: monoFont(), fontWeight: 800}}>CÂU {String(index + 1).padStart(2, '0')}</span>
        </div>
        <div style={{borderTop: `3px solid ${pink}`, margin: '12px 0 14px'}} />
        <div style={{height: OMR.photo, overflow: 'hidden', backgroundColor: '#000', border: `3px solid ${pink}`, borderRadius: 4}}>
          <ClipVideo beat={beat} kb={kb} style={{filter: 'contrast(1.05) saturate(0.95)'}} />
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 26, marginTop: 20}}>
          <div style={{display: 'flex', gap: 10}}>
            {OMR_CHOICES.map((c, k) => {
              const on = k === pick;
              return (
                <div key={c} style={{position: 'relative', width: 50, height: 50, borderRadius: 25, border: `3px solid ${pink}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: s.fonts.body, fontWeight: 700, fontSize: 24, color: pink}}>
                  {c}
                  {on ? <div style={{position: 'absolute', inset: 3, borderRadius: 22, background: ink, transform: `scale(${fill})`}} /> : null}
                </div>
              );
            })}
          </div>
          <div style={{flex: 1, minWidth: 0, fontFamily: s.fonts.display, fontWeight: s.fonts.displayWeight, fontSize: Math.min(70, Math.floor(1100 / Math.max(1, label.length))), lineHeight: 1.3, paddingTop: 4, color: ink, textTransform: 'uppercase', whiteSpace: 'nowrap'}}>{label}</div>
        </div>
      </div>
    </div>
  );
};

// Vạch lượn sóng của dấu hủy tem, vẽ từ x0 tới x1 ở độ cao y
const wavePath = (x0: number, x1: number, y: number, phase = 0) => {
  const step = 26;
  let d = `M ${x0} ${y}`;
  for (let x = x0, k = phase; x < x1; x += step, k++) d += ` Q ${x + step / 2} ${y + (k % 2 ? POSTMARK_AMP : -POSTMARK_AMP)} ${x + step} ${y}`;
  return d;
};

// Dải giấy của con lăn dấu bưu điện ở mép chuyển cảnh: vạch sóng mực xanh và một vòng dấu đỏ giữa khung
const PostmarkBand: React.FC<{edge: number; s: StyleSpec}> = ({edge, s}) => {
  const x0 = edge - POSTMARK_BAND;
  const rows = Math.ceil(1920 / POSTMARK_GAP) + 1;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: x0, top: 0, width: POSTMARK_BAND, height: 1920, background: s.palette.surface, boxShadow: '0 0 40px rgba(0,0,0,0.45)'}} />
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        {Array.from({length: rows}, (_, k) => (
          <path key={k} d={wavePath(x0 + 14, edge - 14, 20 + k * POSTMARK_GAP, k)} fill="none" stroke={s.palette.textOnSurface} strokeWidth={8} strokeLinecap="round" opacity={0.88} />
        ))}
        <circle cx={edge - POSTMARK_BAND / 2} cy={900} r={86} fill={s.palette.surface} stroke={s.palette.accent2} strokeWidth={9} />
        <circle cx={edge - POSTMARK_BAND / 2} cy={900} r={64} fill="none" stroke={s.palette.accent2} strokeWidth={4} />
      </svg>
    </AbsoluteFill>
  );
};

// Phong bì thư máy bay: viền sọc đỏ–xanh, dòng người gửi và con tem góc phải, hình trong ô cửa sổ, nhãn ở dòng "Gửi"
// rộng 930: mép phải ≤ 990 px chừa cột nút TikTok; đáy ≈ 1370 px, trên vùng phụ đề (1418)
// ===== Bố cục toàn trang: nền vẽ một lần (PageBackdrop), cảnh chỉ vẽ phần ảnh nên chuyển cảnh không kéo theo khung trang =====
export const PASSBOOK = {strip: {top: 210, height: 600}, ruleTop: 830, rule: 64, margin: 96};
export const PHONE = {card: {left: 60, top: 410, width: 960, head: 84, photo: 450, foot: 64}};
export const FILM = {strip: {top: 700, height: 560}, hole: {w: 38, h: 26, gap: 64}, inset: 64};
// Khay cơm inox (식판): ngăn lớn chứa B-roll (980×980 ≈ 46 % khung), ngăn dài dưới chứa tiêu đề, hai bát tròn ở chân khay (vùng nút TikTok, chỉ trang trí)
export const TRAY = {inset: 22, radius: 64, main: {left: 50, top: 90, width: 980, height: 980}, low: {left: 50, top: 1104, width: 980, height: 300}, well: 34};
// Bố cục 'payslip': tờ phiếu lương sáng trên mặt bàn; B-roll trong ô "chi tiết" (960×980, 45 % khung), vùng dưới cho tiêu đề và đồ họa
export const PAYSLIP = {sheet: {left: 30, top: 34, width: 1020, height: 1852}, header: {top: 34, height: 86}, main: {left: 60, top: 130, width: 960, height: 980}, low: {left: 60, top: 1134, width: 960, height: 280}, radius: 18};
export const CONSOLE = {top: {left: 60, top: 96, width: 960, height: 312}, main: {left: 60, top: 432, width: 960, height: 980}, bezel: 22, radius: 26};
// Bố cục 'lightbox' (simsa): thảm cắt xanh kẻ ô của bàn thẩm định; tab hồ sơ ở trên cho tiêu đề, hộp đèn soi ở giữa hiện B-roll
// (960×984 ≈ 46 % khung); đồ họa đặc trưng là tờ giấy đặt lên đèn, neo đáy ô `win`, cao ≤ `doc.maxHeight`
export const LIGHTBOX = {tab: {left: 60, top: 96, width: 960, height: 230}, win: {left: 60, top: 356, width: 960, height: 984}, frame: 18, radius: 14, doc: {left: 90, width: 900, bottom: 1310, maxHeight: 640}};
// Bố cục 'citation' (danso): biên bản xử phạt giấy than vàng nhạt; ảnh hiện trường tràn mép trên (1080×900 ≈ 47 % khung), mép dưới ảnh
// xé răng cưa; tờ biên bản bên dưới chứa ô tiêu đề / ô đồ họa (không cùng lúc) và phụ đề; chân tờ (vùng nút TikTok) chỉ trang trí
export const CITATION = {photo: {left: 0, top: 0, width: 1080, height: 900}, tear: 16, form: {left: 36, top: 918, width: 1008, height: 968}, head: {left: 72, top: 950, width: 860, height: 300}, graphic: {left: 72, top: 950, width: 860, height: 420}, tag: {left: 40, bottom: 856}};
// Bố cục 'track' (yeokjeon): đường chạy tartan đỏ cam; số áo thi đấu ở trên cho tiêu đề / đồ họa (không cùng lúc), B-roll là dải ảnh
// tràn bề ngang ở giữa (1080×940 ≈ 49 % khung) có vạch đích ca-rô ở mép trên, vạch làn trắng ở mép dưới; phụ đề dưới dải ảnh
export const TRACK = {bib: {left: 60, top: 96, width: 960, height: 430}, strip: {left: 0, top: 560, width: 1080, height: 940}, finish: 18, laneTop: 1500, card: {left: 60, top: 600, width: 960, height: 860}};
// Bố cục 'platform' (hwanseung): tường gạch men ga tàu điện sáng; B-roll sau cửa kính chắn tàu nửa trên (960×980 ≈ 45,4 % khung,
// khung inox vẽ ra ngoài ô), bảng giờ tàu lật chữ dưới cửa cho tiêu đề / đồ họa (không cùng lúc); phụ đề dưới bảng
export const PLATFORM = {door: {left: 60, top: 110, width: 960, height: 980}, frame: 20, radius: 10, board: {left: 60, top: 1120, width: 960, height: 300}, sign: {left: 84, top: 134}};
export const STORE = {fascia: 150, awning: {top: 150, height: 112, scallop: 34}, window: {left: 30, top: 310, width: 1020, height: 1000}, frame: 14, stripe: 90};

// Thanh đáy cửa cuốn và vài lá thép phía trên mép, chỉ trong ô kính, chỉ có trong lúc chuyển
const ShutterBand: React.FC<{edge: number; s: StyleSpec}> = ({edge, s}) => {
  const w = STORE.window;
  const band = 150;
  const top = Math.max(w.top, edge - band);
  return (
    <div style={{position: 'absolute', left: w.left, width: w.width, top, height: Math.max(0, edge - top), overflow: 'hidden', pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: band, backgroundImage: 'repeating-linear-gradient(180deg, #8d96a6 0 6px, #c9d0db 6px 20px, #6e7787 20px 26px)', boxShadow: '0 16px 30px rgba(0,0,0,0.55)'}} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 22, background: '#3a4252', borderTop: `4px solid ${s.palette.accent}`}} />
      <div style={{position: 'absolute', left: w.width / 2 - 60, bottom: 4, width: 120, height: 12, borderRadius: 6, background: '#1d2330'}} />
    </div>
  );
};

export const DOSSIER = {sheet: {left: 36, right: 36, top: 150, bottom: 70}, photo: {left: 96, top: 910, width: 840, height: 600, mat: 16}};

const SprocketRow: React.FC<{y: number; offset: number; color: string}> = ({y, offset, color}) => (
  <div style={{position: 'absolute', left: 0, right: 0, top: y, height: FILM.hole.h, backgroundImage: `linear-gradient(90deg, ${color} 0 ${FILM.hole.w}px, transparent ${FILM.hole.w}px)`, backgroundSize: `${FILM.hole.gap}px ${FILM.hole.h}px`, backgroundPosition: `${offset}px 0`}} />
);

export const PageBackdrop: React.FC = () => {
  const s = useStyle();
  const brand = useBrand();
  const frame = useCurrentFrame();
  if (s.broll === 'passbook') {
    const green = s.palette.accent2;
    return (
      <AbsoluteFill style={{background: s.palette.bg}}>
        <div style={{position: 'absolute', left: 0, right: 0, top: PASSBOOK.ruleTop, bottom: 0, backgroundImage: `repeating-linear-gradient(180deg, transparent 0 ${PASSBOOK.rule - 2}px, #d8cfb8 ${PASSBOOK.rule - 2}px ${PASSBOOK.rule}px)`}} />
        <div style={{position: 'absolute', top: PASSBOOK.ruleTop, bottom: 0, left: PASSBOOK.margin, width: 3, background: `${s.palette.accent}88`}} />
        <div style={{position: 'absolute', top: PASSBOOK.ruleTop, bottom: 0, left: PASSBOOK.margin + 9, width: 3, background: `${s.palette.accent}88`}} />
        <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: PASSBOOK.strip.top - 14, background: green, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 60px 18px'}}>
          <div style={{fontFamily: s.fonts.display, fontWeight: 800, fontSize: 40, color: '#f1d98a', letterSpacing: '0.12em', whiteSpace: 'nowrap'}}>SỔ TIẾT KIỆM</div>
          <div style={{fontFamily: monoFont(), fontWeight: 700, fontSize: 28, color: '#f4efe2cc', letterSpacing: '0.08em', whiteSpace: 'nowrap'}}>DU HỌC D-4</div>
        </div>
        <div style={{position: 'absolute', left: 0, right: 0, top: PASSBOOK.strip.top - 14, height: 6, background: '#f1d98a'}} />
      </AbsoluteFill>
    );
  }
  if (s.broll === 'phone') {
    const c = PHONE.card;
    return (
      <AbsoluteFill style={{background: s.palette.bg}}>
        <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 300, background: `linear-gradient(180deg, ${s.palette.accent} 0%, #3b6ef5 100%)`, borderRadius: '0 0 56px 56px'}} />
        <div style={{position: 'absolute', left: c.left, right: c.left, top: 222, display: 'flex', alignItems: 'center', gap: 20}}>
          <div style={{width: 64, height: 64, borderRadius: 20, background: '#ffffff', color: s.palette.accent, fontFamily: s.fonts.display, fontWeight: 800, fontSize: 38, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>₩</div>
          <div style={{fontFamily: s.fonts.display, fontWeight: 800, fontSize: 40, color: '#ffffff'}}>Ví D-4</div>
          <div style={{flex: 1}} />
          <div style={{fontFamily: s.fonts.body, fontWeight: 800, fontSize: 30, color: '#ffffffcc'}}>{brand.name ?? ''}</div>
        </div>
        <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 150, background: '#ffffff', borderTop: '2px solid #dbe4f3', display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start', paddingTop: 26}}>
          {['Trang chủ', 'Chi tiêu', 'Làm thêm', 'Tài khoản'].map((t, i) => (
            <div key={t} style={{fontFamily: s.fonts.body, fontWeight: 800, fontSize: 26, color: i === 2 ? s.palette.accent : '#8a97b3', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8}}>
              <div style={{width: 40, height: 40, borderRadius: 12, background: i === 2 ? s.palette.accent : '#c9d3e6'}} />
              {t}
            </div>
          ))}
        </div>
      </AbsoluteFill>
    );
  }
  if (s.broll === 'dossier') {
    const sh = DOSSIER.sheet;
    return (
      <AbsoluteFill style={{background: `radial-gradient(ellipse 120% 80% at 30% 20%, #c99a60 0%, ${s.palette.bg} 60%, #a5773f 100%)`}}>
        <div style={{position: 'absolute', left: sh.left + 20, top: sh.top - 82, height: 96, padding: '0 34px', background: '#d4a86c', borderRadius: '22px 22px 0 0', display: 'flex', alignItems: 'center', fontFamily: s.fonts.body, fontWeight: 900, fontSize: 32, letterSpacing: '0.14em', color: '#4a3417', boxShadow: 'inset 0 -6px 0 rgba(0,0,0,0.08)'}}>HỒ SƠ VISA · D-4</div>
        <div style={{position: 'absolute', left: sh.left, right: sh.right, top: sh.top, bottom: sh.bottom, background: s.palette.surface, borderRadius: 10, boxShadow: '0 26px 60px rgba(60,35,10,0.45)'}}>
          <div style={{position: 'absolute', left: 44, right: 44, top: 22, display: 'flex', justifyContent: 'space-between', fontFamily: monoFont(), fontWeight: 700, fontSize: 24, color: `${s.palette.text}99`, letterSpacing: '0.08em', whiteSpace: 'nowrap'}}>
            <span>MẪU 01 · NƠI NỘP HỒ SƠ</span>
            <span>DU HỌC HÀN QUỐC</span>
          </div>
          <div style={{position: 'absolute', left: 44, right: 44, top: 62, height: 3, background: `${s.palette.accent}66`}} />
        </div>
      </AbsoluteFill>
    );
  }
  if (s.broll === 'tray') {
    return <TrayBackdrop s={s} />;
  }
  if (s.broll === 'payslip') {
    return <PayslipBackdrop s={s} />;
  }
  if (s.broll === 'console') {
    return <ConsoleBackdrop s={s} />;
  }
  if (s.broll === 'lightbox') {
    return <LightboxBackdrop s={s} />;
  }
  if (s.broll === 'citation') {
    return <CitationBackdrop s={s} />;
  }
  if (s.broll === 'track') {
    return <TrackBackdrop s={s} />;
  }
  if (s.broll === 'platform') {
    return <PlatformBackdrop s={s} />;
  }
  if (s.broll === 'storefront') {
    const w = STORE.window;
    const a = STORE.awning;
    return (
      <AbsoluteFill style={{background: s.palette.bg}}>
        <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: STORE.fascia, background: 'linear-gradient(180deg, #070b14 0%, #131c2e 100%)'}} />
        <div style={{position: 'absolute', left: 0, right: 0, top: a.top, height: a.height, backgroundImage: `repeating-linear-gradient(90deg, ${s.palette.accent2} 0 ${STORE.stripe}px, ${s.palette.surface} ${STORE.stripe}px ${STORE.stripe * 2}px)`, boxShadow: 'inset 0 -16px 22px rgba(0,0,0,0.25)'}} />
        <div style={{position: 'absolute', left: 0, right: 0, top: a.top + a.height - 1, height: a.scallop, backgroundImage: `radial-gradient(circle at ${STORE.stripe / 2}px 0, ${s.palette.accent2} ${a.scallop}px, transparent ${a.scallop + 1}px), radial-gradient(circle at ${STORE.stripe * 1.5}px 0, ${s.palette.surface} ${a.scallop}px, transparent ${a.scallop + 1}px)`, backgroundSize: `${STORE.stripe * 2}px ${a.scallop}px`, filter: 'drop-shadow(0 10px 10px rgba(0,0,0,0.35))'}} />
        <div style={{position: 'absolute', left: 0, right: 0, top: w.top + w.height, bottom: 0, background: `radial-gradient(ellipse 70% 45% at 50% 0%, ${s.palette.accent}2e 0%, transparent 70%), linear-gradient(180deg, #151f33 0%, #0a101c 100%)`}} />
        <div style={{position: 'absolute', left: w.left - STORE.frame, top: w.top - STORE.frame, width: w.width + STORE.frame * 2, height: w.height + STORE.frame * 2, background: '#1f2a3d', borderRadius: 6, boxShadow: `0 0 0 3px #2c3a52, 0 0 60px ${s.palette.accent}22`}} />
        <div style={{position: 'absolute', left: w.left, top: w.top, width: w.width, height: w.height, background: 'radial-gradient(ellipse at 50% 40%, #24324a 0%, #101826 80%)'}} />
        <div style={{position: 'absolute', left: 0, right: 0, top: w.top + w.height + STORE.frame, height: 10, background: '#2c3a52'}} />
      </AbsoluteFill>
    );
  }
  if (s.broll === 'film') {
    const st = FILM.strip;
    return (
      <AbsoluteFill style={{background: s.palette.bg}}>
        <AbsoluteFill style={{background: 'radial-gradient(ellipse 90% 60% at 50% 50%, #2a2622 0%, #111111 70%)'}} />
        <div style={{position: 'absolute', left: 0, right: 0, top: st.top, height: st.height, background: '#050505', boxShadow: '0 30px 80px rgba(0,0,0,0.8)'}} />
        <SprocketRow y={st.top + 18} offset={-(frame * 2) % FILM.hole.gap} color="#e8dfc8" />
        <SprocketRow y={st.top + st.height - 18 - FILM.hole.h} offset={-(frame * 2) % FILM.hole.gap} color="#e8dfc8" />
      </AbsoluteFill>
    );
  }
  return null;
};

// Thép xước của khay: vân ngang mảnh trên nền xám bạc, ngăn lõm vào có bóng trong
const STEEL = 'repeating-linear-gradient(180deg, rgba(255,255,255,0.10) 0 2px, rgba(0,0,0,0.03) 2px 5px), linear-gradient(160deg, #eef1f4 0%, #c3cad2 46%, #e3e7eb 70%, #b4bcc5 100%)';
const WELL = 'inset 0 10px 22px rgba(40,48,58,0.35), inset 0 -4px 10px rgba(255,255,255,0.7), 0 2px 0 rgba(255,255,255,0.8)';

export const TrayBackdrop: React.FC<{s: StyleSpec}> = ({s}) => {
  const m = TRAY.main;
  const l = TRAY.low;
  const i = TRAY.inset;
  const bowl = (cx: number, r: number, fill: string) => (
    <div style={{position: 'absolute', left: cx - r, top: 1560 - r * 0.2, width: r * 2, height: r * 2, borderRadius: r, background: `radial-gradient(circle at 50% 42%, ${fill} 0 ${r * 0.62}px, #f4f6f8 ${r * 0.64}px, #c7ced6 ${r}px)`, boxShadow: WELL}} />
  );
  return (
    <AbsoluteFill style={{background: 'repeating-linear-gradient(90deg, #d9b07a 0 160px, #cfa36b 160px 168px, #ddb683 168px 330px), linear-gradient(180deg, #e2bd88, #c99a60)'}}>
      <div style={{position: 'absolute', left: i, right: i, top: i, bottom: i, borderRadius: TRAY.radius, backgroundImage: STEEL, boxShadow: '0 30px 60px rgba(80,50,20,0.35), inset 0 0 0 3px rgba(255,255,255,0.65)'}} />
      <div style={{position: 'absolute', left: m.left - 8, top: m.top - 8, width: m.width + 16, height: m.height + 16, borderRadius: TRAY.well + 8, backgroundImage: STEEL, boxShadow: WELL}} />
      <div style={{position: 'absolute', left: l.left, top: l.top, width: l.width, height: l.height, borderRadius: TRAY.well, backgroundImage: STEEL, boxShadow: WELL}} />
      {bowl(250, 150, '#f7f2e6')}
      {bowl(640, 150, `${s.palette.accent}cc`)}
      <div style={{position: 'absolute', left: 820, top: 1440, width: 22, height: 420, borderRadius: 11, background: 'linear-gradient(90deg, #9aa3ad, #eef1f4, #9aa3ad)', transform: 'rotate(8deg)', boxShadow: '4px 8px 10px rgba(0,0,0,0.2)'}} />
      <div style={{position: 'absolute', left: 870, top: 1440, width: 22, height: 420, borderRadius: 11, background: 'linear-gradient(90deg, #9aa3ad, #eef1f4, #9aa3ad)', transform: 'rotate(11deg)', boxShadow: '4px 8px 10px rgba(0,0,0,0.2)'}} />
    </AbsoluteFill>
  );
};

// Ngăn lớn của khay: clip tràn ngăn bo góc, phiếu ăn 식권 có mép răng cưa trượt vào góc dưới trái làm nhãn
const TrayCompartment: React.FC<{beat: Extract<ResolvedBeat, {kind: 'broll'}>; kb: number; s: StyleSpec; index: number; frame: number}> = ({beat, kb, s, index, frame}) => {
  const m = TRAY.main;
  const slip = spring({frame: frame - 5, fps: FPS, config: {damping: 14, stiffness: 190}});
  const ink = s.palette.textOnSurface;
  const teeth = `radial-gradient(circle at 9px 50%, transparent 7px, ${s.palette.surface} 7.5px)`;
  return (
    <>
      <div style={{position: 'absolute', left: m.left, top: m.top, width: m.width, height: m.height, borderRadius: TRAY.well, overflow: 'hidden', backgroundColor: '#000'}}>
        <ClipVideo beat={beat} kb={kb} style={{filter: 'contrast(1.04) saturate(1.1)'}} />
        <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,0) 66%, rgba(0,0,0,0.38) 100%)', boxShadow: 'inset 0 8px 18px rgba(0,0,0,0.35)'}} />
      </div>
      {beat.label ? (
        <div style={{position: 'absolute', left: m.left + 30, top: m.top + m.height - 190, maxWidth: 700, display: 'flex', transform: `translateX(${interpolate(slip, [0, 1], [-90, 0])}px) rotate(${interpolate(slip, [0, 1], [-6, -2])}deg)`, opacity: interpolate(slip, [0, 0.3], [0, 1], clamp), filter: 'drop-shadow(0 12px 20px rgba(0,0,0,0.4))'}}>
          <div style={{width: 18, backgroundImage: teeth, backgroundSize: '18px 22px'}} />
          <div style={{background: s.palette.surface, padding: '14px 26px 16px 18px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 12, fontFamily: monoFont(), fontWeight: 800, fontSize: 24, color: s.palette.accent, letterSpacing: '0.08em', whiteSpace: 'nowrap'}}>
              <span>식권</span>
              <span style={{flex: 1, borderTop: `3px dotted ${ink}44`}} />
              <span style={{color: `${ink}88`}}>No.{String(index + 1).padStart(2, '0')}</span>
            </div>
            <div style={{fontFamily: s.fonts.body, fontWeight: 700, fontSize: 44, lineHeight: 1.1, color: ink, textWrap: 'balance'}}>{beat.label}</div>
          </div>
          <div style={{width: 18, backgroundImage: teeth, backgroundSize: '18px 22px', transform: 'scaleX(-1)'}} />
        </div>
      ) : null}
    </>
  );
};

// Phiếu lương: mặt bàn văn phòng xám lục (vân giấy lót mờ), tờ phiếu sáng giữ thẳng với dải đầu màu xanh lục, ô chi tiết có kẻ mảnh
const PAYSLIP_DESK = 'repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 7px), repeating-linear-gradient(90deg, rgba(0,0,0,0.05) 0 1px, transparent 1px 11px)';
const PAYSLIP_SHADOW = '0 34px 70px rgba(10,16,13,0.55), 0 4px 10px rgba(10,16,13,0.35)';

export const PayslipBackdrop: React.FC<{s: StyleSpec}> = ({s}) => {
  const brand = useBrand();
  const sh = PAYSLIP.sheet;
  const h = PAYSLIP.header;
  const m = PAYSLIP.main;
  const l = PAYSLIP.low;
  const ink = s.palette.textOnSurface;
  const rule = `${s.palette.accent2}33`;
  return (
    <AbsoluteFill style={{background: `${PAYSLIP_DESK}, radial-gradient(ellipse 90% 70% at 50% 40%, ${s.palette.bg} 0%, #222b27 100%)`}}>
      <div style={{position: 'absolute', left: sh.left, top: sh.top, width: sh.width, height: sh.height, background: s.palette.surface, borderRadius: 10, boxShadow: PAYSLIP_SHADOW, overflow: 'hidden'}}>
        <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: h.height, background: s.palette.accent2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 150px 0 34px'}}>
          <div style={{fontFamily: s.fonts.display, fontWeight: 700, fontSize: 34, letterSpacing: '0.06em', color: s.palette.surface, whiteSpace: 'nowrap'}}>급여명세서 · PHIẾU LƯƠNG</div>
          <div style={{fontFamily: s.fonts.body, fontWeight: 600, fontSize: 21, color: `${s.palette.surface}cc`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 470, textAlign: 'right'}}>{brand.name ?? ''}</div>
        </div>
      </div>
      <div style={{position: 'absolute', left: m.left - 3, top: m.top - 3, width: m.width + 6, height: m.height + 6, borderRadius: PAYSLIP.radius + 3, border: `3px solid ${s.palette.accent2}`, opacity: 0.85}} />
      {[0, 1, 2, 3].map((k) => (
        <div key={k} style={{position: 'absolute', left: l.left, width: l.width, top: l.top + 70 * (k + 1) + 6 * k, height: 0, borderTop: `2px solid ${rule}`}} />
      ))}
      <div style={{position: 'absolute', left: 90, top: 1700, width: 520, display: 'flex', alignItems: 'baseline', gap: 16, fontFamily: s.fonts.body, fontWeight: 600, fontSize: 32, color: `${ink}88`, whiteSpace: 'nowrap'}}>
        <span>Ký nhận</span>
        <span style={{flex: 1, borderBottom: `3px solid ${ink}44`}} />
      </div>
      <div style={{position: 'absolute', left: 660, top: 1668, width: 150, height: 150, borderRadius: 75, border: `4px solid ${s.palette.accent}55`, boxShadow: `inset 0 0 0 8px ${s.palette.surface}, inset 0 0 0 11px ${s.palette.accent}33`, transform: 'rotate(-12deg)'}} />
    </AbsoluteFill>
  );
};

// Ô chi tiết của phiếu lương: khung kẻ mảnh bo góc, thẻ mục "CHI TIẾT · 내역" trên góc, nhãn là dòng mục phiếu lương dán mép dưới trái
const PayslipCell: React.FC<{beat: Extract<ResolvedBeat, {kind: 'broll'}>; kb: number; s: StyleSpec; index: number; frame: number}> = ({beat, kb, s, index, frame}) => {
  const m = PAYSLIP.main;
  const slip = spring({frame: frame - 5, fps: FPS, config: {damping: 16, stiffness: 200}});
  const ink = s.palette.textOnSurface;
  return (
    <>
      <div style={{position: 'absolute', left: m.left, top: m.top, width: m.width, height: m.height, borderRadius: PAYSLIP.radius, overflow: 'hidden', backgroundColor: '#000'}}>
        <ClipVideo beat={beat} kb={kb} style={{filter: 'contrast(1.04) saturate(1.05)'}} />
        <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,0) 70%, rgba(0,0,0,0.32) 100%)'}} />
        <div style={{position: 'absolute', left: 0, top: 0, background: s.palette.surface, color: `${ink}bb`, fontFamily: s.fonts.body, fontWeight: 600, fontSize: 22, letterSpacing: '0.12em', padding: '6px 20px 8px 18px', borderRadius: `0 0 ${PAYSLIP.radius}px 0`, whiteSpace: 'nowrap'}}>CHI TIẾT · 내역</div>
      </div>
      {beat.label ? (
        <div style={{position: 'absolute', left: m.left, top: m.top + m.height - 104, maxWidth: 780, display: 'flex', alignItems: 'stretch', background: s.palette.chipBg, borderRadius: '0 12px 12px 0', borderLeft: `8px solid ${s.palette.accent}`, boxShadow: '0 10px 22px rgba(10,16,13,0.4)', transform: `translateX(${interpolate(slip, [0, 1], [-520, 0])}px)`, opacity: interpolate(slip, [0, 0.25], [0, 1], clamp)}}>
          <div style={{display: 'flex', alignItems: 'center', padding: '10px 16px 12px 20px', fontFamily: s.fonts.display, fontWeight: 700, fontSize: 36, color: s.palette.accent, whiteSpace: 'nowrap'}}>{String(index + 1).padStart(2, '0')}</div>
          <div style={{width: 3, margin: '10px 0', background: `${ink}33`}} />
          <div style={{display: 'flex', alignItems: 'center', padding: '10px 26px 12px 18px', fontFamily: s.fonts.body, fontWeight: 600, fontSize: 40, lineHeight: 1.12, color: s.palette.chipText, textWrap: 'balance'}}>{beat.label}</div>
        </div>
      ) : null}
    </>
  );
};

// ---- Bố cục 'console' (suseup): tủ điện thép tối, dải công tắc ở trên, màn hình giám sát ở dưới ----
const STEEL_GRAIN = 'repeating-linear-gradient(180deg, rgba(255,255,255,0.028) 0 1px, transparent 1px 4px), repeating-linear-gradient(180deg, rgba(0,0,0,0.05) 0 2px, transparent 2px 9px)';
const KNOB_METAL = 'linear-gradient(160deg, #6b757d 0%, #3b434a 55%, #565f67 100%)';
const BEZEL_BLACK = '#050607';

// Tấm nhôm phay của dải trên: dùng chung cho ba công tắc nghỉ (backdrop) và tiêu đề dymo (che công tắc nghỉ khi có chữ)
export const consolePlateStyle = (s: StyleSpec): React.CSSProperties => {
  const t = CONSOLE.top;
  return {
    position: 'absolute', left: t.left, top: t.top, width: t.width, height: t.height, borderRadius: 14, boxSizing: 'border-box',
    background: `repeating-linear-gradient(180deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 3px), linear-gradient(180deg, ${s.palette.bg} 0%, ${s.palette.surface} 160%)`,
    border: `2px solid ${s.palette.text}1f`,
    boxShadow: 'inset 0 3px 10px rgba(0,0,0,0.55), 0 2px 0 rgba(255,255,255,0.06)',
  };
};

// Một công tắc gạt: đèn trên, rãnh, cần gạt (lên = ON, đèn accent2; xuống = OFF, đèn accent). Gốc tọa độ là góc trên trái của thân 150×250 × scale
export const ConsoleSwitch: React.FC<{on: boolean; s: StyleSpec; scale?: number; angle?: number; lit?: boolean; style?: React.CSSProperties}> = ({on, s, scale = 1, angle, lit = true, style}) => {
  const lamp = on ? s.palette.accent2 : s.palette.accent;
  const deg = angle ?? (on ? 0 : 180);
  return (
    <div style={{position: 'absolute', width: 150, height: 250, transform: `scale(${scale})`, transformOrigin: '0 0', borderRadius: 18, background: KNOB_METAL, border: '2px solid rgba(255,255,255,0.14)', boxShadow: '0 12px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.28)', ...style}}>
      <div style={{position: 'absolute', left: 58, top: 26, width: 34, height: 34, borderRadius: 17, background: lit ? lamp : '#2a3036', boxShadow: lit ? `0 0 26px 6px ${lamp}99, inset 0 -3px 5px rgba(0,0,0,0.3)` : 'inset 0 2px 5px rgba(0,0,0,0.6)', border: '3px solid #20262b'}} />
      <div style={{position: 'absolute', left: 53, top: 96, width: 44, height: 128, borderRadius: 22, background: '#0a0d0f', boxShadow: 'inset 0 6px 12px rgba(0,0,0,0.9), 0 1px 0 rgba(255,255,255,0.18)'}} />
      <div style={{position: 'absolute', left: 75, top: 160, width: 0, height: 0, transform: `rotate(${deg}deg)`, transformOrigin: '0 0'}}>
        <div style={{position: 'absolute', left: -9, top: -74, width: 18, height: 74, borderRadius: 9, background: 'linear-gradient(90deg, #8b959d 0%, #e6ecef 45%, #6f7a82 100%)'}} />
        <div style={{position: 'absolute', left: -23, top: -108, width: 46, height: 46, borderRadius: 23, background: 'radial-gradient(circle at 35% 30%, #f1f5f7 0%, #9aa5ad 55%, #5d676f 100%)', boxShadow: '0 4px 8px rgba(0,0,0,0.55)'}} />
      </div>
    </div>
  );
};

// Nền tủ điện: thép xước sơn tĩnh điện, gân dập, bốn ốc vít, dải công tắc, bezel + kính màn hình, chữ khắc, lỗ thông gió. `idle`: vẽ ba công tắc nghỉ khi dải trên trống
export const ConsoleBackdrop: React.FC<{s: StyleSpec; idle?: boolean}> = ({s, idle = true}) => {
  const m = CONSOLE.main;
  const bz = CONSOLE.bezel;
  const tint = s.palette.text;
  const screw = (x: number, y: number, k: number) => (
    <div key={`${x}-${y}`} style={{position: 'absolute', left: x - 15, top: y - 15, width: 30, height: 30, borderRadius: 15, background: 'radial-gradient(circle at 35% 30%, #aab4bb 0%, #5d676f 70%, #3a4248 100%)', boxShadow: '0 2px 3px rgba(0,0,0,0.6)', transform: `rotate(${k * 37}deg)`}}>
      <div style={{position: 'absolute', left: 4, right: 4, top: 13, height: 4, borderRadius: 2, background: '#1d2328'}} />
    </div>
  );
  return (
    <AbsoluteFill style={{background: `${STEEL_GRAIN}, radial-gradient(ellipse 100% 70% at 50% 35%, ${s.palette.surface} 0%, ${s.palette.bg} 100%)`}}>
      <div style={{position: 'absolute', left: 26, top: 26, right: 26, bottom: 26, borderRadius: 22, border: `3px solid ${tint}0f`, boxShadow: `inset 0 0 0 5px rgba(0,0,0,0.18), 0 0 0 2px rgba(0,0,0,0.3)`}} />
      {[[44, 44], [1036, 44], [44, 1876], [1036, 1876]].map(([x, y], k) => screw(x, y, k))}
      <div style={consolePlateStyle(s)} />
      {idle ? (
        <div style={{position: 'absolute', left: CONSOLE.top.left, top: CONSOLE.top.top, width: CONSOLE.top.width, height: CONSOLE.top.height, opacity: 0.4}}>
          {[0, 1, 2].map((k) => (
            <ConsoleSwitch key={k} on={false} s={s} scale={0.8} lit={false} style={{left: 100 + k * 320, top: 56}} />
          ))}
        </div>
      ) : null}
      <div style={{position: 'absolute', left: m.left - bz, top: m.top - bz, width: m.width + bz * 2, height: m.height + bz * 2, borderRadius: CONSOLE.radius + bz, background: BEZEL_BLACK, boxShadow: `0 22px 44px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.09), 0 0 0 3px ${tint}12`}} />
      <div style={{position: 'absolute', left: m.left, top: m.top, width: m.width, height: m.height, borderRadius: CONSOLE.radius, background: '#000', overflow: 'hidden'}}>
        <AbsoluteFill style={{backgroundImage: 'repeating-linear-gradient(180deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 4px)'}} />
      </div>
      <div style={{position: 'absolute', left: m.left + 30, top: m.top + m.height + 4, height: 36, padding: '0 22px', display: 'flex', alignItems: 'center', borderRadius: 6, background: 'linear-gradient(180deg, #9aa4ab 0%, #7a848b 100%)', boxShadow: '0 3px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.35)', fontFamily: s.fonts.body, fontWeight: 700, fontSize: 22, letterSpacing: '0.16em', color: '#11151a', textShadow: '0 1px 0 rgba(255,255,255,0.35)', whiteSpace: 'nowrap'}}>MÀN HÌNH 01 · THỬ VIỆC</div>
      <div style={{position: 'absolute', left: 836, top: m.top + m.height + bz - 6, width: 20, height: 20, borderRadius: 10, background: s.palette.accent2, boxShadow: `0 0 14px 3px ${s.palette.accent2}99`, border: '3px solid #20262b'}} />
      <div style={{position: 'absolute', left: 84, top: 1640, width: 300, height: 130, opacity: 0.55, backgroundImage: 'radial-gradient(circle at 50% 50%, #05070a 0 7px, transparent 8px)', backgroundSize: '30px 30px'}} />
      <div style={{position: 'absolute', left: 84, top: 1810, width: 300, height: 52, opacity: 0.3, borderRadius: 4, backgroundImage: `repeating-linear-gradient(135deg, ${s.palette.chipBg} 0 16px, ${s.palette.bg} 16px 32px)`, border: `3px solid ${s.palette.chipBg}`}} />
    </AbsoluteFill>
  );
};

// CRT tắt: hình ép dọc thành vạch sáng, vạch co thành chấm; cảnh mới bung ra từ chấm. Mọi thứ chỉ trong ô kính
type CrtState = {oldStrip: number; rect: {w: number; h: number}; line: {w: number; alpha: number}};
const EASE_CRT = Easing.bezier(0.65, 0, 0.35, 1);
const easeIO = (x: number) => EASE_CRT(Math.min(1, Math.max(0, x)));
// vào chậm hơn các kiểu khác: 6 khung ép thành chấm, 6 khung bung ra (cảnh cũ chỉ còn ở dưới 9 khung đầu, phần sau là kính đen của nền)
export const CRT_FRAMES = 12;
const crtState = (q: number, out: number, entrance: Entrance): CrtState | undefined => {
  if (out > 0) {
    // về cảnh thầy: ép thành vạch rồi chấm rồi tắt
    const h = 1 - easeIO(out / 0.65);
    const w = out < 0.65 ? 1 : 1 - easeIO((out - 0.65) / 0.35);
    return {oldStrip: 0, rect: {w, h: out < 0.65 ? h : 0}, line: {w, alpha: out > 0.45 ? 1 : 0}};
  }
  if (entrance === 'open' || q >= 1) return undefined;
  if (q < 0.33) {
    const strip = 1 - easeIO(q / 0.33);
    return {oldStrip: strip, rect: {w: 0, h: 0}, line: {w: 1, alpha: interpolate(strip, [0, 0.25], [1, 0], clamp)}};
  }
  if (q < 0.5) return {oldStrip: 0, rect: {w: 0, h: 0}, line: {w: 1 - easeIO((q - 0.33) / 0.17), alpha: 1}};
  if (q < 0.62) {
    const w = easeIO((q - 0.5) / 0.12);
    return {oldStrip: 0, rect: {w, h: 0}, line: {w, alpha: 1}};
  }
  const h = easeIO((q - 0.62) / 0.38);
  return {oldStrip: 0, rect: {w: 1, h}, line: {w: 1, alpha: 1 - h}};
};

// Ô màn hình giám sát: kính 960×980 trong bezel (vẽ ở backdrop), scanline rất mờ, vệt phản quang; nhãn là băng Dymo dán lên góc bezel
// nhãn trượt vào sau khi cảnh cũ (có nhãn riêng) đã hết dưới cảnh mới: cảnh mở đầu và cảnh từ thầy vào không có cảnh cũ
const consoleLabelAt = (entrance: Entrance) => (entrance === 'whip-left' || entrance === 'whip-right' ? TRANSITION + 1 : 5);
const ConsoleMonitor: React.FC<{beat: Extract<ResolvedBeat, {kind: 'broll'}>; kb: number; s: StyleSpec; index: number; frame: number; crt?: CrtState; labelAt: number}> = ({beat, kb, s, index, frame, crt, labelAt}) => {
  const m = CONSOLE.main;
  const slide = spring({frame: frame - labelAt, fps: FPS, config: {damping: 16, stiffness: 210}});
  const rect = crt ? crt.rect : {w: 1, h: 1};
  const insetX = ((1 - rect.w) / 2) * m.width;
  const insetY = ((1 - rect.h) / 2) * m.height;
  const hidden = rect.w <= 0.002 || rect.h <= 0.002;
  const text = `${String(index + 1).padStart(2, '0')} · ${beat.label ?? ''}`;
  const size = Math.max(30, Math.min(40, Math.floor(790 / (text.length * 0.66))));
  return (
    <>
      <div style={{position: 'absolute', left: m.left, top: m.top, width: m.width, height: m.height, borderRadius: CONSOLE.radius, overflow: 'hidden', backgroundColor: '#000'}}>
        {crt && crt.oldStrip < 1 ? (
          <>
            <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: ((1 - crt.oldStrip) / 2) * m.height, background: '#000'}} />
            <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: ((1 - crt.oldStrip) / 2) * m.height, background: '#000'}} />
            {crt.oldStrip <= 0 ? <AbsoluteFill style={{background: '#000'}} /> : null}
          </>
        ) : null}
        {hidden ? null : (
          <AbsoluteFill style={{clipPath: crt ? `inset(${insetY}px ${insetX}px)` : undefined}}>
            <ClipVideo beat={beat} kb={kb} style={{filter: 'contrast(1.06) saturate(1.04)'}} />
            <AbsoluteFill style={{backgroundImage: 'repeating-linear-gradient(180deg, rgba(0,0,0,0.06) 0 2px, transparent 2px 4px)'}} />
            <AbsoluteFill style={{background: 'linear-gradient(112deg, transparent 0 30%, rgba(255,255,255,0.05) 30% 41%, transparent 41% 46%, rgba(255,255,255,0.03) 46% 49%, transparent 49% 100%)'}} />
            <AbsoluteFill style={{boxShadow: 'inset 0 0 90px rgba(0,0,0,0.45)', borderRadius: CONSOLE.radius}} />
          </AbsoluteFill>
        )}
        {crt && crt.line.alpha > 0.01 ? (
          <div style={{position: 'absolute', left: m.width / 2 - Math.max(5, (crt.line.w * m.width) / 2), top: m.height / 2 - 3, width: Math.max(10, crt.line.w * m.width), height: 6, borderRadius: 3, background: s.palette.text, opacity: crt.line.alpha, boxShadow: `0 0 22px 5px ${s.palette.text}88`}} />
        ) : null}
      </div>
      {beat.label ? (
        <div style={{position: 'absolute', left: m.left - 12, top: m.top - 36, transform: `translateX(${interpolate(slide, [0, 1], [-640, 0])}px)`, opacity: interpolate(slide, [0, 0.25], [0, 1], clamp), filter: 'drop-shadow(0 8px 10px rgba(0,0,0,0.55))'}}>
          <div style={{background: `linear-gradient(180deg, rgba(255,255,255,0.28) 0, transparent 14%, transparent 84%, rgba(0,0,0,0.2) 100%), ${s.palette.chipBg}`, color: s.palette.chipText, fontFamily: s.fonts.display, fontWeight: 800, fontSize: size, lineHeight: 1.32, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', padding: '2px 52px 6px 22px', clipPath: 'polygon(0 0, 100% 0, calc(100% - 22px) 100%, 0 100%)', textShadow: '1px 1px 0 rgba(255,255,255,0.55), -1px -1px 0 rgba(0,0,0,0.3)'}}>{text}</div>
        </div>
      ) : null}
    </>
  );
};

// ---- Bố cục 'lightbox' (simsa): thảm cắt xanh kẻ ô, hộp đèn soi viền nhôm ở giữa, tab hồ sơ phía trên ----
// Chất liệu (nhôm xước, giấy kraft) là chi tiết vật liệu nên màu ghi trực tiếp; màu thương hiệu lấy từ palette
export const KRAFT = 'repeating-linear-gradient(176deg, rgba(120,84,40,0.06) 0 2px, transparent 2px 7px), linear-gradient(180deg, #ead2a8 0%, #d9b985 100%)';
const ALUMINIUM = 'repeating-linear-gradient(90deg, rgba(255,255,255,0.2) 0 1px, rgba(0,0,0,0.03) 1px 3px), linear-gradient(160deg, #eceff1 0%, #b9c0c6 45%, #dfe3e6 70%, #a7afb6 100%)';
export const FOLDER_EAR = 52;

// Chia một dòng thành các đoạn thường / đoạn từ khóa (cụm nhiều chữ được), để tô nét dạ quang theo cụm
export const hiSegments = (line: string, hi: string[]) => {
  const out: {text: string; hi: boolean}[] = [];
  let rest = line;
  while (rest) {
    let at = -1;
    let len = 0;
    for (const h of hi) {
      const i = h ? rest.indexOf(h) : -1;
      if (i >= 0 && (at < 0 || i < at)) {
        at = i;
        len = h.length;
      }
    }
    if (at < 0) {
      out.push({text: rest, hi: false});
      break;
    }
    if (at > 0) out.push({text: rest.slice(0, at), hi: false});
    out.push({text: rest.slice(at, at + len), hi: true});
    rest = rest.slice(at + len);
  }
  return out;
};

// Bìa hồ sơ kraft nhô tai ở vùng LIGHTBOX.tab: tai là thẻ chipBg mang kicker, thân là bìa kraft chứa nội dung
export const FolderShell: React.FC<{s: StyleSpec; ear: React.ReactNode; children?: React.ReactNode; style?: React.CSSProperties}> = ({s, ear, children, style}) => {
  const t = LIGHTBOX.tab;
  return (
    <div style={{position: 'absolute', left: t.left, top: t.top, width: t.width, height: t.height, ...style}}>
      <div style={{position: 'absolute', left: 0, top: 0, height: FOLDER_EAR, minWidth: 380, maxWidth: t.width, display: 'flex', alignItems: 'center', padding: '0 24px', borderRadius: '14px 14px 0 0', background: s.palette.chipBg, color: s.palette.chipText, fontFamily: s.fonts.body, fontWeight: 700, fontSize: 30, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', boxSizing: 'border-box'}}>{ear}</div>
      <div style={{position: 'absolute', left: 0, right: 0, top: FOLDER_EAR, bottom: 0, background: KRAFT, borderRadius: '0 14px 14px 14px', boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.45), inset 0 -3px 0 rgba(90,60,20,0.18)', padding: '12px 28px 14px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>{children}</div>
    </div>
  );
};

// Nền bàn thẩm định: thảm cắt kẻ ô 1 cm (cứ 5 ô một đường đậm), thước có số ở mép trái và mép dưới, vết dao rạch, kẹp giấy ở vùng UI TikTok.
// `idle`: ô hộp đèn trống và tab hồ sơ mờ khi chưa có tiêu đề
export const LightboxBackdrop: React.FC<{s: StyleSpec; idle?: boolean}> = ({s, idle = true}) => {
  const w = LIGHTBOX.win;
  const fr = LIGHTBOX.frame;
  const tx = s.palette.text;
  const cell = 54;
  const rivet = (x: number, y: number) => <div key={`${x}-${y}`} style={{position: 'absolute', left: x - 5, top: y - 5, width: 10, height: 10, borderRadius: 5, background: 'radial-gradient(circle at 35% 30%, #f4f6f7 0%, #8d969d 100%)', boxShadow: '0 1px 1px rgba(0,0,0,0.45)'}} />;
  const cut = (left: number, top: number, len: number, deg: number) => (
    <div key={`${left}-${top}`} style={{position: 'absolute', left, top, width: len, height: 2, transform: `rotate(${deg}deg)`, transformOrigin: '0 50%', background: 'rgba(0,0,0,0.22)', boxShadow: `0 1px 0 ${tx}14`}} />
  );
  const marks = [0, 1, 2, 3, 4, 5, 6, 7];
  return (
    <AbsoluteFill
      style={{
        background: [
          `repeating-linear-gradient(0deg, ${tx}2e 0 2px, transparent 2px ${cell * 5}px)`,
          `repeating-linear-gradient(90deg, ${tx}2e 0 2px, transparent 2px ${cell * 5}px)`,
          `repeating-linear-gradient(0deg, ${tx}1a 0 1px, transparent 1px ${cell}px)`,
          `repeating-linear-gradient(90deg, ${tx}1a 0 1px, transparent 1px ${cell}px)`,
          `radial-gradient(ellipse 100% 70% at 50% 40%, ${s.palette.bg} 0%, ${s.palette.bg} 50%, rgba(0,0,0,0.3) 130%)`,
        ].join(', '),
        backgroundColor: s.palette.bg,
      }}
    >
      {cut(720, 1500, 330, -17)}
      {cut(90, 1160, 250, 23)}
      {cut(640, 40, 280, 9)}
      {cut(60, 1640, 200, -6)}
      <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: 46, background: `${s.palette.surface}1f`, borderRight: `2px solid ${tx}33`, opacity: 0.35}}>
        <div style={{position: 'absolute', right: 0, top: 0, bottom: 0, width: 14, backgroundImage: `repeating-linear-gradient(180deg, ${tx} 0 2px, transparent 2px ${cell / 2}px)`}} />
        <div style={{position: 'absolute', right: 0, top: 0, bottom: 0, width: 26, backgroundImage: `repeating-linear-gradient(180deg, ${tx} 0 3px, transparent 3px ${cell * 5}px)`}} />
        {marks.map((k) => (
          <div key={k} style={{position: 'absolute', left: 4, top: k * cell * 5 + 8, fontFamily: monoFont(), fontWeight: 700, fontSize: 20, color: tx}}>{k * 5}</div>
        ))}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 1850, height: 46, background: `${s.palette.surface}1f`, borderTop: `2px solid ${tx}33`, opacity: 0.35}}>
        <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 14, backgroundImage: `repeating-linear-gradient(90deg, ${tx} 0 2px, transparent 2px ${cell / 2}px)`}} />
        <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 26, backgroundImage: `repeating-linear-gradient(90deg, ${tx} 0 3px, transparent 3px ${cell * 5}px)`}} />
        {[0, 1, 2, 3].map((k) => (
          <div key={k} style={{position: 'absolute', left: k * cell * 5 + 8, top: 22, fontFamily: monoFont(), fontWeight: 700, fontSize: 20, color: tx}}>{k * 5}</div>
        ))}
      </div>
      <svg width={80} height={160} viewBox="0 0 80 160" style={{position: 'absolute', left: 850, top: 1640, transform: 'rotate(24deg)', filter: 'drop-shadow(3px 5px 3px rgba(0,0,0,0.4))'}}>
        <path d="M22 140 V34 a20 20 0 0 1 40 0 V112 a12 12 0 0 1 -24 0 V48" fill="none" stroke="#c4cbd1" strokeWidth={5} strokeLinecap="round" />
      </svg>
      {idle ? (
        <FolderShell s={s} ear="Hồ sơ · 심사" style={{opacity: 0.35}}>
          <div style={{height: 3, background: `${s.palette.textOnSurface}33`, marginBottom: 26}} />
          <div style={{height: 3, background: `${s.palette.textOnSurface}33`, marginBottom: 26, width: '70%'}} />
          <div style={{height: 3, background: `${s.palette.textOnSurface}33`, width: '45%'}} />
        </FolderShell>
      ) : null}
      <div style={{position: 'absolute', left: w.left - fr, top: w.top - fr, width: w.width + fr * 2, height: w.height + fr * 2, borderRadius: LIGHTBOX.radius + fr, background: ALUMINIUM, boxShadow: '0 44px 70px rgba(0,0,0,0.4), 0 8px 16px rgba(0,0,0,0.28), inset 0 2px 0 rgba(255,255,255,0.7), inset 0 -2px 0 rgba(0,0,0,0.2)'}}>
        {rivet(9, 9)}
        {rivet(w.width + fr * 2 - 9, 9)}
        {rivet(9, w.height + fr * 2 - 9)}
        {rivet(w.width + fr * 2 - 9, w.height + fr * 2 - 9)}
      </div>
      <div style={{position: 'absolute', left: w.left, top: w.top, width: w.width, height: w.height, borderRadius: LIGHTBOX.radius, background: `radial-gradient(ellipse 85% 75% at 50% 45%, #ffffff 0%, ${s.palette.surface} 62%, #ebe8da 100%)`, boxShadow: 'inset 0 0 40px rgba(60,50,20,0.14), inset 0 4px 10px rgba(0,0,0,0.28)', overflow: 'hidden'}}>
        {idle ? <AbsoluteFill style={{backgroundImage: `repeating-linear-gradient(0deg, ${s.palette.textOnSurface}0d 0 1px, transparent 1px ${cell}px), repeating-linear-gradient(90deg, ${s.palette.textOnSurface}0d 0 1px, transparent 1px ${cell}px)`}} /> : null}
      </div>
    </AbsoluteFill>
  );
};

// Đèn nền chớp (backlight): ô hộp đèn trắng dần như bật đèn mạnh, rồi ảnh mới hiện ra từ trắng kèm vạch quét sáng mảnh từ trên xuống
export const BACKLIGHT_FRAMES = 16;
type BacklightState = {white: number; sweep?: number};
const backlightState = (frame: number, out: number, entrance: Entrance): BacklightState | undefined => {
  // về cảnh thầy: ô trắng dần (nhanh hơn lúc vào)
  if (out > 0) return {white: out};
  if (entrance === 'open' || frame >= BACKLIGHT_FRAMES) return undefined;
  const half = BACKLIGHT_FRAMES / 2;
  if (frame < half) return {white: easeIO(frame / half)};
  const q = (frame - half) / half;
  return {white: 1 - easeIO(q), sweep: q};
};

// Ô hộp đèn: clip tràn ô, viền tối mảnh ở mép trên như cạnh kính; nhãn là thẻ phim vàng dán góc dưới trái, trượt ngắn rồi lật nhẹ
const LightboxWindow: React.FC<{beat: Extract<ResolvedBeat, {kind: 'broll'}>; kb: number; s: StyleSpec; index: number; frame: number; bl?: BacklightState; out: number; labelAt: number}> = ({beat, kb, s, index, frame, bl, out, labelAt}) => {
  const w = LIGHTBOX.win;
  const tag = spring({frame: frame - labelAt, fps: FPS, config: {damping: 15, stiffness: 200}});
  const text = `SOI ${String(index + 1).padStart(2, '0')} · ${beat.label ?? ''}`;
  const size = Math.max(26, Math.min(30, Math.floor(780 / (text.length * 0.62))));
  return (
    <>
      <div style={{position: 'absolute', left: w.left, top: w.top, width: w.width, height: w.height, borderRadius: LIGHTBOX.radius, overflow: 'hidden', backgroundColor: '#000'}}>
        <ClipVideo beat={beat} kb={kb} style={{filter: 'contrast(1.04) saturate(1.04)'}} />
        <AbsoluteFill style={{boxShadow: 'inset 0 5px 12px rgba(0,0,0,0.35)', borderRadius: LIGHTBOX.radius}} />
        {bl && bl.white > 0.003 ? <AbsoluteFill style={{background: s.palette.surface, opacity: bl.white}} /> : null}
        {bl && bl.sweep !== undefined && bl.sweep < 1 ? (
          <div style={{position: 'absolute', left: 0, right: 0, top: bl.sweep * w.height - 3, height: 6, background: '#ffffff', boxShadow: '0 6px 16px rgba(255,255,255,0.7), 0 -6px 16px rgba(255,255,255,0.4)'}} />
        ) : null}
      </div>
      {beat.label ? (
        <div style={{position: 'absolute', left: w.left + 20, top: w.top + 20, perspective: 600, opacity: interpolate(tag, [0, 0.3], [0, 1], clamp) * (1 - out), filter: 'drop-shadow(0 8px 10px rgba(0,0,0,0.4))'}}>
          <div style={{display: 'flex', alignItems: 'stretch', transformOrigin: '50% 0%', transform: `translateX(${interpolate(tag, [0, 1], [-70, 0])}px) rotateX(${interpolate(tag, [0, 1], [-65, 0])}deg)`, background: s.palette.chipBg, color: s.palette.chipText, borderRadius: 6}}>
            <div style={{width: 26, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', alignItems: 'center', padding: '6px 0', borderRight: `2px dashed ${s.palette.chipText}44`}}>
              {[0, 1, 2].map((k) => <div key={k} style={{width: 9, height: 9, borderRadius: 2, background: 'rgba(0,0,0,0.45)'}} />)}
            </div>
            <div style={{fontFamily: s.fonts.body, fontWeight: 700, fontSize: size, lineHeight: 1.2, letterSpacing: '0.02em', whiteSpace: 'nowrap', padding: '8px 22px 10px 16px'}}>{text}</div>
          </div>
        </div>
      ) : null}
    </>
  );
};

const PassbookStrip: React.FC<{beat: Extract<ResolvedBeat, {kind: 'broll'}>; kb: number; s: StyleSpec; index: number; frame: number}> = ({beat, kb, s, index, frame}) => {
  const st = PASSBOOK.strip;
  const ink = s.palette.textOnSurface;
  const typed = Math.floor(interpolate(frame, [6, 22], [0, (beat.label ?? '').length], clamp));
  return (
    <>
      <div style={{position: 'absolute', left: 0, right: 0, top: st.top, height: st.height, overflow: 'hidden', backgroundColor: '#000'}}>
        <ClipVideo beat={beat} kb={kb} style={{filter: 'contrast(1.04) saturate(0.92) sepia(0.05)'}} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: st.top + st.height, height: 4, background: ink}} />
      <div style={{position: 'absolute', left: PASSBOOK.margin + 30, right: 60, top: st.top + st.height + 6, height: 58, display: 'flex', alignItems: 'center', gap: 24, fontFamily: monoFont(), fontWeight: 800, fontSize: 32, color: ink}}>
        <span style={{color: s.palette.accent2}}>GD {String(index + 1).padStart(3, '0')}</span>
        <span style={{flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textTransform: 'uppercase'}}>{(beat.label ?? '').slice(0, typed)}</span>
      </div>
    </>
  );
};

const PhonePost: React.FC<{beat: Extract<ResolvedBeat, {kind: 'broll'}>; kb: number; s: StyleSpec; index: number; frame: number}> = ({beat, kb, s, index, frame}) => {
  const c = PHONE.card;
  const brand = useBrand();
  const like = interpolate(frame, [10, 18], [0, 1], {...clamp, easing: Easing.out(Easing.back(2))});
  return (
    <div style={{position: 'absolute', left: c.left, top: c.top, width: c.width, background: s.palette.surface, borderRadius: 40, overflow: 'hidden', boxShadow: '0 24px 60px rgba(15,28,63,0.16)'}}>
      <div style={{height: c.head, display: 'flex', alignItems: 'center', gap: 18, padding: '0 28px'}}>
        <div style={{width: 48, height: 48, borderRadius: 24, background: `linear-gradient(135deg, ${s.palette.accent}, ${s.palette.accent2})`}} />
        <div style={{fontFamily: s.fonts.body, fontWeight: 900, fontSize: 32, color: s.palette.text, whiteSpace: 'nowrap', overflow: 'hidden', flex: 1, minWidth: 0}}>{beat.label ?? brand.name ?? ''}</div>
        <div style={{fontFamily: s.fonts.body, fontWeight: 800, fontSize: 26, color: '#8a97b3'}}>#{index + 1}</div>
      </div>
      <div style={{height: c.photo, overflow: 'hidden', backgroundColor: '#000'}}>
        <ClipVideo beat={beat} kb={kb} />
      </div>
      <div style={{height: c.foot, display: 'flex', alignItems: 'center', gap: 28, padding: '0 28px', fontFamily: s.fonts.body, fontWeight: 800, fontSize: 28, color: '#8a97b3'}}>
        <span style={{color: '#e11d48', transform: `scale(${0.6 + like * 0.4})`, display: 'inline-block'}}>♥</span>
        <span>Lưu</span>
        <span>Chia sẻ</span>
      </div>
    </div>
  );
};

// Ô kính cửa hàng: clip tràn ô, phản quang chéo trên kính, tờ "tuyển làm thêm" có tua xé dán góc dưới trái làm nhãn
const StoreWindow: React.FC<{beat: Extract<ResolvedBeat, {kind: 'broll'}>; kb: number; s: StyleSpec; index: number; frame: number}> = ({beat, kb, s, index, frame}) => {
  const w = STORE.window;
  const stick = spring({frame: frame - 6, fps: FPS, config: {damping: 12, stiffness: 200}});
  const glare = interpolate(frame, [0, 90], [-30, 130], {...clamp, easing: Easing.inOut(Easing.quad)});
  const tabs = 6;
  return (
    <>
      <div style={{position: 'absolute', left: w.left, top: w.top, width: w.width, height: w.height, overflow: 'hidden', backgroundColor: '#000'}}>
        <ClipVideo beat={beat} kb={kb} style={{filter: 'contrast(1.05) saturate(1.08)'}} />
        <AbsoluteFill style={{background: `linear-gradient(118deg, transparent ${glare - 14}%, rgba(255,255,255,0.10) ${glare - 4}%, rgba(255,255,255,0.03) ${glare + 6}%, transparent ${glare + 12}%), linear-gradient(180deg, rgba(0,0,0,0) 62%, rgba(0,0,0,0.45) 100%)`}} />
      </div>
      {beat.label ? (
        <div style={{position: 'absolute', left: w.left + 34, top: w.top + w.height - 236, width: 640, transform: `rotate(-2deg) translateY(${interpolate(stick, [0, 1], [-34, 0])}px) scale(${interpolate(stick, [0, 1], [1.08, 1])})`, transformOrigin: '50% 0%', opacity: interpolate(stick, [0, 0.25], [0, 1], clamp), filter: 'drop-shadow(0 14px 22px rgba(0,0,0,0.45))'}}>
          <div style={{background: s.palette.surface, padding: '18px 26px 14px', borderRadius: '4px 4px 0 0'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 14, fontFamily: s.fonts.display, fontSize: 26, color: s.palette.emphBg, letterSpacing: '0.06em', whiteSpace: 'nowrap'}}>
              <span>TUYỂN</span>
              <span style={{flex: 1, height: 3, background: `${s.palette.textOnSurface}22`}} />
              <span style={{fontFamily: monoFont(), fontWeight: 800, fontSize: 24, color: `${s.palette.textOnSurface}88`}}>#{String(index + 1).padStart(2, '0')}</span>
            </div>
            <div style={{marginTop: 6, fontFamily: s.fonts.body, fontWeight: 800, fontSize: 44, lineHeight: 1.12, color: s.palette.textOnSurface, textWrap: 'balance'}}>{beat.label}</div>
          </div>
          <div style={{display: 'flex', background: s.palette.surface, borderTop: `3px dashed ${s.palette.textOnSurface}44`, borderRadius: '0 0 4px 4px', overflow: 'hidden'}}>
            {Array.from({length: tabs}, (_, k) => (
              <div key={k} style={{flex: 1, height: 62, borderLeft: k ? `2px dashed ${s.palette.textOnSurface}33` : 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7, transform: k === tabs - 1 ? 'rotate(4deg) translateY(4px)' : undefined}}>
                <div style={{width: '58%', height: 5, borderRadius: 3, background: `${s.palette.textOnSurface}55`}} />
                <div style={{width: '40%', height: 5, borderRadius: 3, background: `${s.palette.textOnSurface}33`}} />
              </div>
            ))}
          </div>
          <div style={{position: 'absolute', top: -14, left: 40, width: 120, height: 34, background: `${s.palette.accent}cc`, transform: 'rotate(-5deg)'}} />
          <div style={{position: 'absolute', top: -12, right: 40, width: 110, height: 34, background: `${s.palette.accent}cc`, transform: 'rotate(4deg)'}} />
        </div>
      ) : null}
    </>
  );
};

const FilmFrame: React.FC<{beat: Extract<ResolvedBeat, {kind: 'broll'}>; kb: number; s: StyleSpec; index: number; frame: number}> = ({beat, kb, s, index}) => {
  const st = FILM.strip;
  return (
    <>
      <div style={{position: 'absolute', left: 24, right: 24, top: st.top + FILM.inset, height: st.height - FILM.inset * 2, overflow: 'hidden', backgroundColor: '#000', borderRadius: 10}}>
        <ClipVideo beat={beat} kb={kb} style={{filter: 'contrast(1.12) saturate(0.85) sepia(0.12)'}} />
      </div>
      <div style={{position: 'absolute', left: 44, top: st.top + st.height - FILM.inset - 58, fontFamily: monoFont(), fontWeight: 800, fontSize: 32, color: s.palette.accent, background: 'rgba(0,0,0,0.72)', padding: '4px 12px 6px', letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap', maxWidth: 980, overflow: 'hidden'}}>
        {String(index + 1).padStart(2, '0')}A ▸ {beat.label ?? ''}
      </div>
    </>
  );
};

// Ảnh kẹp ghim trên tờ hồ sơ, hơi nghiêng; nhãn là ô "Mục" đóng dấu đỏ ở mép dưới ảnh
const DossierPhoto: React.FC<{beat: Extract<ResolvedBeat, {kind: 'broll'}>; kb: number; s: StyleSpec; index: number; frame: number}> = ({beat, kb, s, index, frame}) => {
  const ph = DOSSIER.photo;
  const tilt = index % 2 ? 1.4 : -1.4;
  const slam = interpolate(frame, [8, 14], [1.5, 1], {...clamp, easing: Easing.in(Easing.quad)});
  const ink = interpolate(frame, [8, 11], [0, 1], clamp);
  return (
    <div style={{position: 'absolute', left: ph.left, top: ph.top, width: ph.width, transform: `rotate(${tilt}deg)`}}>
      <div style={{background: '#ffffff', padding: ph.mat, boxShadow: '0 22px 50px rgba(60,35,10,0.35)'}}>
        <div style={{height: ph.height, overflow: 'hidden', backgroundColor: '#000'}}>
          <ClipVideo beat={beat} kb={kb} style={{filter: 'contrast(1.03) saturate(0.95)'}} />
        </div>
      </div>
      <div style={{position: 'absolute', top: -38, left: 70, width: 46, height: 120, border: '7px solid #8d97a6', borderRadius: 23, boxShadow: '0 4px 6px rgba(0,0,0,0.25)'}} />
      <div style={{position: 'absolute', top: -24, left: 82, width: 22, height: 80, border: '6px solid #aab3c0', borderRadius: 11}} />
      {beat.label ? (
        <div style={{position: 'absolute', left: 34, bottom: -36, transform: `rotate(${-tilt - 2}deg) scale(${slam})`, transformOrigin: 'left center', opacity: ink, background: s.palette.surface, border: `5px solid ${s.palette.accent}`, borderRadius: 6, padding: '6px 16px 8px', fontFamily: s.fonts.body, fontWeight: 900, fontSize: 29, color: s.palette.accent, letterSpacing: '0.02em', textTransform: 'uppercase', whiteSpace: 'nowrap', maxWidth: 800, overflow: 'hidden'}}>
          Mục {String(index + 1).padStart(2, '0')} · {beat.label}
        </div>
      ) : null}
    </div>
  );
};

export const ENVELOPE = {left: 60, top: 588, width: 930, photo: 452};

const EnvelopeCard: React.FC<{beat: Extract<ResolvedBeat, {kind: 'broll'}>; kb: number; s: StyleSpec; index: number; frame: number}> = ({beat, kb, s, index, frame}) => {
  const label = beat.label ?? '';
  const ink = s.palette.textOnSurface;
  const red = s.palette.accent2;
  const brand = useBrand();
  const rise = interpolate(frame, [0, 12], [46, 0], {...clamp, easing: Easing.out(Easing.cubic)});
  const fade = interpolate(frame, [0, 6], [0, 1], clamp);
  // tem dán xuống rồi dấu đóng đè lên: hai nhịp lệch nhau để mắt thấy từng việc
  const stampIn = interpolate(frame, [5, 13], [1.35, 1], {...clamp, easing: Easing.out(Easing.back(1.6))});
  const mark = interpolate(frame, [12, 17], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const stripes = `repeating-linear-gradient(135deg, ${red} 0 30px, ${s.palette.surface} 30px 46px, ${ink} 46px 76px, ${s.palette.surface} 76px 92px)`;
  return (
    <div style={{position: 'absolute', left: ENVELOPE.left, top: ENVELOPE.top, width: ENVELOPE.width, opacity: fade, transform: `translateY(${rise}px) rotate(${index % 2 ? 0.7 : -0.7}deg)`, filter: 'drop-shadow(0 36px 60px rgba(0,0,0,0.55))'}}>
      <div style={{background: stripes, padding: 14, borderRadius: 8}}>
        <div style={{background: s.palette.surface, borderRadius: 3, padding: '20px 26px 22px', position: 'relative'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', height: 118}}>
            <div style={{display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 6}}>
              <div style={{fontFamily: s.fonts.body, fontWeight: 800, fontSize: 32, color: ink, lineHeight: 1.3, maxWidth: 640}}>
                <span style={{color: red}}>Từ: </span>
                {brand.name}
              </div>
              <div style={{alignSelf: 'flex-start', fontFamily: s.fonts.body, fontWeight: 800, fontSize: 30, letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1.3, color: s.palette.surface, background: ink, padding: '2px 14px 4px', borderRadius: 4}}>
                Thư máy bay
              </div>
            </div>
            <div style={{position: 'relative', width: 104, height: 118, marginRight: 8}}>
              <div style={{position: 'absolute', inset: 0, transform: `scale(${stampIn}) rotate(3deg)`, background: s.palette.surface, padding: 7, WebkitMaskImage: 'radial-gradient(circle at 5px 5px, transparent 4px, #000 4.5px)', maskImage: 'radial-gradient(circle at 5px 5px, transparent 4px, #000 4.5px)', WebkitMaskSize: '10px 10px', maskSize: '10px 10px', WebkitMaskPosition: '-5px -5px', maskPosition: '-5px -5px', boxShadow: '0 4px 10px rgba(0,0,0,0.25)'}}>
                <div style={{width: '100%', height: '100%', border: `3px solid ${red}`, overflow: 'hidden', position: 'relative'}}>
                  <Img src={staticFile(`broll/${beat.clip}.jpg`)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                </div>
              </div>
              <svg width={190} height={130} style={{position: 'absolute', left: -120, top: -4, opacity: mark, transform: `scale(${interpolate(mark, [0, 1], [1.25, 1])})`, transformOrigin: '70% 50%'}}>
                <circle cx={130} cy={62} r={50} fill="none" stroke={ink} strokeWidth={5} opacity={0.85} />
                {[0, 1, 2, 3].map((k) => (
                  <path key={k} d={wavePath(4, 100, 28 + k * 22, k)} fill="none" stroke={ink} strokeWidth={5} strokeLinecap="round" opacity={0.85} />
                ))}
              </svg>
            </div>
          </div>
          <div style={{marginTop: 14, height: ENVELOPE.photo, overflow: 'hidden', backgroundColor: '#000', border: `3px solid ${ink}`, borderRadius: 4}}>
            <ClipVideo beat={beat} kb={kb} style={{filter: 'contrast(1.05) saturate(0.95) sepia(0.06)'}} />
          </div>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 18, borderBottom: `3px dashed ${ink}66`, paddingBottom: 6}}>
            <div style={{fontFamily: s.fonts.body, fontWeight: 800, fontSize: 30, color: red, textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1.3}}>Gửi</div>
            <div style={{flex: 1, minWidth: 0, fontFamily: s.fonts.display, fontWeight: s.fonts.displayWeight, fontSize: fitDisplay(s, [label], 740, 60), lineHeight: 1.3, paddingTop: 4, color: ink, textTransform: 'uppercase', whiteSpace: 'nowrap'}}>{label}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Thẻ boarding pass: hình ở thân vé, nhãn ở cuống vé có đường xé răng cưa và mã vạch
export const TICKET = {left: 60, top: 600, width: 960, photo: 600, stub: 176};

const barcode = (seed: string) => {
  let h = 7;
  return Array.from({length: 16}, (_, i) => {
    h = (h * 31 + seed.charCodeAt(i % Math.max(1, seed.length))) % 9973;
    return 3 + (h % 4) * 3;
  });
};

const TicketCard: React.FC<{beat: Extract<ResolvedBeat, {kind: 'broll'}>; kb: number; chip: number; s: StyleSpec; index: number}> = ({beat, kb, chip, s, index}) => {
  const label = beat.label ?? '';
  const notch = 30;
  const seat = String(index + 1).padStart(2, '0');
  return (
    <div style={{position: 'absolute', left: TICKET.left, top: TICKET.top, width: TICKET.width, filter: 'drop-shadow(0 40px 60px rgba(0,0,0,0.55))'}}>
      <div style={{height: TICKET.photo, borderRadius: '34px 34px 0 0', overflow: 'hidden', backgroundColor: '#000', position: 'relative'}}>
        <ClipVideo beat={beat} kb={kb} />
        <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0) 78%, rgba(0,0,0,0.3) 100%)'}} />
        <div style={{position: 'absolute', top: 24, left: 28, right: 28, display: 'flex', justifyContent: 'space-between', fontFamily: s.fonts.display, fontWeight: 800, fontSize: 34, letterSpacing: '0.14em', color: '#fff', textShadow: '0 2px 10px rgba(0,0,0,0.6)'}}>
          <span style={{display: 'inline-flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 12, padding: '6px 14px 6px 12px', textShadow: 'none', color: s.palette.textOnSurface, fontSize: 28}}>
            <Img src={staticFile('img/logo-letco.png')} style={{height: 34}} />✈ KOREA
          </span>
          <span style={{color: s.palette.captionActive}}>{seat}</span>
        </div>
      </div>
      <div
        style={{
          height: TICKET.stub,
          background: s.palette.surface,
          borderRadius: '0 0 34px 34px',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          padding: '0 40px',
          gap: 30,
          WebkitMaskImage: `radial-gradient(circle at 0 0, transparent ${notch}px, #000 ${notch + 1}px), radial-gradient(circle at 100% 0, transparent ${notch}px, #000 ${notch + 1}px)`,
          WebkitMaskComposite: 'source-in',
          maskComposite: 'intersect',
        }}
      >
        <div style={{position: 'absolute', top: 0, left: notch + 10, right: notch + 10, borderTop: `4px dashed ${s.palette.textOnSurface}33`}} />
        <div style={{width: 12, alignSelf: 'stretch', margin: '36px 0', background: `linear-gradient(180deg, ${s.palette.emphBg} 50%, ${s.palette.accent2} 50%)`, borderRadius: 6}} />
        <div style={{flex: 1, minWidth: 0, transform: `translateY(${interpolate(chip, [0, 1], [26, 0])}px)`, opacity: interpolate(chip, [0, 0.4], [0, 1], clamp)}}>
          <div style={{fontFamily: s.fonts.body, fontWeight: 700, fontSize: 24, letterSpacing: '0.22em', color: `${s.palette.textOnSurface}88`}}>ĐIỂM ĐẾN</div>
          <div style={{fontFamily: s.fonts.display, fontWeight: 900, fontSize: Math.min(72, Math.floor(1450 / Math.max(1, label.length))), lineHeight: 1.3, paddingTop: 4, color: s.palette.textOnSurface, textTransform: 'uppercase', whiteSpace: 'nowrap'}}>{label}</div>
        </div>
        <div style={{display: 'flex', alignItems: 'stretch', gap: 3, height: 104}}>
          {barcode(label).map((w, i) => (
            <div key={i} style={{width: w, background: i % 3 === 2 ? 'transparent' : s.palette.textOnSurface}} />
          ))}
        </div>
      </div>
    </div>
  );
};

// ---- Bố cục 'citation' (danso): biên bản xử phạt giấy than vàng nhạt, ảnh hiện trường tràn mép trên ----
// Chất liệu (bóng đổ, mực in) ghi trực tiếp; màu thương hiệu lấy từ palette
let plex: string | undefined;
export const plexMono = () => (plex ??= loadPlexMono('normal', {weights: ['500'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily);

// Mép xé răng cưa ở đáy ô ảnh: răng cao CITATION.tear, bước 30 px, lệch nhẹ để không đều như máy cắt
const CITATION_STEP = 30;
const citationTearPts = (dy = 0) =>
  Array.from({length: Math.ceil(1080 / CITATION_STEP) + 1}, (_, k) => {
    const x = Math.min(1080, k * CITATION_STEP);
    const y = CITATION.photo.height - (k % 2 ? 0 : CITATION.tear) - ((k * 37) % 5) * 1.2 + dy;
    return {x, y};
  });
export const citationTearClip = () => `polygon(0 0, 1080px 0, ${citationTearPts().reverse().map((p) => `${p.x}px ${p.y}px`).join(', ')})`;

// Nền tờ biên bản. `idle`: ô ảnh trống (khối mực tối) và dòng biểu mẫu mờ khi chưa có tiêu đề / đồ họa; bìa tắt cả hai
export const CitationBackdrop: React.FC<{s: StyleSpec; idle?: boolean}> = ({s, idle = true}) => {
  const f = CITATION.form;
  const p = s.palette;
  const ph = CITATION.photo;
  const rowTop = 960;
  const row = 64;
  const rows = Math.floor((f.top + f.height - rowTop) / row);
  const edge = [{x: 0, y: 0}, {x: 1080, y: 0}, ...citationTearPts(6).reverse()].map((q) => `${q.x},${q.y}`).join(' ');
  const mono = plexMono();
  return (
    <AbsoluteFill style={{background: p.bg}}>
      <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, opacity: 0.05, mixBlendMode: 'multiply'}}>
        <filter id="citation-fiber">
          <feTurbulence type="fractalNoise" baseFrequency="0.9 0.12" numOctaves={2} seed={4} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#citation-fiber)" />
      </svg>
      <div style={{position: 'absolute', left: f.left, top: f.top, width: f.width, height: f.height, boxSizing: 'border-box', border: `2px solid ${p.text}2e`, background: `${p.surface}59`}} />
      <div style={{position: 'absolute', left: f.left + 2, top: rowTop, width: f.width - 4, height: rows * row, backgroundImage: `repeating-linear-gradient(180deg, transparent 0 ${row - 2}px, ${p.accent2}38 ${row - 2}px ${row}px)`}} />
      <div style={{position: 'absolute', left: 112, top: rowTop, height: rows * row, width: 2, background: `${p.accent}55`}} />
      {Array.from({length: rows}, (_, k) => (
        <div key={k} style={{position: 'absolute', left: 52, top: rowTop + k * row + 30, fontFamily: mono, fontWeight: 500, fontSize: 22, color: p.text, opacity: 0.3}}>{String(k + 1).padStart(2, '0')}</div>
      ))}
      <div style={{position: 'absolute', left: 72, top: f.top + 2, height: 28, lineHeight: '28px', fontFamily: mono, fontWeight: 500, fontSize: 24, color: p.accent2, whiteSpace: 'nowrap'}}>BIÊN BẢN KIỂM TRA · SỐ 011</div>
      <div style={{position: 'absolute', left: 150, top: 1640, width: 560, height: 170, transform: 'rotate(-6deg)', background: `linear-gradient(90deg, transparent, ${p.accent2}1f 20%, ${p.accent2}14 80%, transparent)`}} />
      <div style={{position: 'absolute', left: 130, top: 1700, fontFamily: mono, fontWeight: 500, fontSize: 24, color: p.text, opacity: 0.3, whiteSpace: 'nowrap'}}>Chữ ký người vi phạm ____________</div>
      <div style={{position: 'absolute', left: 130, top: 1790, fontFamily: mono, fontWeight: 500, fontSize: 24, color: p.text, opacity: 0.3, whiteSpace: 'nowrap'}}>Cán bộ lập biên bản ____________</div>
      <div style={{position: 'absolute', left: 700, top: 1740, display: 'flex', alignItems: 'stretch', gap: 3, height: 90, opacity: 0.25}}>
        {barcode('danso-011').map((w, i) => (
          <div key={i} style={{width: w, background: i % 3 === 2 ? 'transparent' : p.text}} />
        ))}
      </div>
      <svg width={1080} height={ph.height + 40} style={{position: 'absolute', left: 0, top: 0, filter: 'blur(4px)'}}>
        <polygon points={edge} fill="rgba(0,0,0,0.24)" />
      </svg>
      {idle ? (
        <div style={{position: 'absolute', left: ph.left, top: ph.top, width: ph.width, height: ph.height, clipPath: citationTearClip(), background: p.text}}>
          <AbsoluteFill style={{backgroundImage: `repeating-linear-gradient(135deg, transparent 0 18px, ${p.surface}0d 18px 20px)`}} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// Dải băng cảnh sát của chuyển cảnh 'policeline': dải vàng rộng POLICE_BAND, nghiêng −POLICE_TILT°, quét trái → phải qua ô ảnh trong POLICE_FRAMES khung.
// `edge` là mép TRÁI của dải ở giữa ô (x tại hàng giữa); mép đó là ranh giới cảnh: vào thì cảnh mới lộ ra phía sau (bên trái) dải, ra thì cảnh cũ bị dải xóa dần.
const POLICE_FRAMES = 10;
const POLICE_BAND = 120;
const POLICE_TILT = 12;
const POLICE_SLANT = (CITATION.photo.height / 2) * Math.tan((POLICE_TILT * Math.PI) / 180);
type PoliceState = {mode: 'in' | 'out'; edge: number};
const policeState = (frame: number, out: number, entrance: Entrance): PoliceState | undefined => {
  const span = [-(POLICE_BAND + POLICE_SLANT + 4), 1080 + POLICE_SLANT + 4];
  if (out > 0) return {mode: 'out', edge: interpolate(out, [0, 1], span)};
  if (entrance === 'open' || frame >= POLICE_FRAMES) return undefined;
  return {mode: 'in', edge: interpolate(frame, [0, POLICE_FRAMES], span, {...clamp, easing: Easing.inOut(Easing.quad)})};
};
const policeClip = (st: PoliceState) => {
  const h = CITATION.photo.height;
  const e = st.edge;
  return st.mode === 'in'
    ? `polygon(0 0, ${e - POLICE_SLANT}px 0, ${e + POLICE_SLANT}px ${h}px, 0 ${h}px)`
    : `polygon(${e + POLICE_BAND - POLICE_SLANT}px 0, 1080px 0, 1080px ${h}px, ${e + POLICE_BAND + POLICE_SLANT}px ${h}px)`;
};
const PoliceBand: React.FC<{edge: number; s: StyleSpec}> = ({edge, s}) => {
  const len = 1300;
  const hazard = `repeating-linear-gradient(135deg, ${s.palette.chipText} 0 8px, ${s.palette.chipBg} 8px 16px)`;
  return (
    <div style={{position: 'absolute', left: edge, top: CITATION.photo.height / 2 - len / 2, width: POLICE_BAND, height: len, background: s.palette.chipBg, transform: `rotate(-${POLICE_TILT}deg)`, filter: 'drop-shadow(5px 0 7px rgba(0,0,0,0.28))', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: 12, background: hazard}} />
      <div style={{position: 'absolute', right: 0, top: 0, bottom: 0, width: 12, background: hazard}} />
      <div style={{position: 'absolute', left: POLICE_BAND / 2 - len / 2, top: len / 2 - POLICE_BAND / 2, width: len, height: POLICE_BAND, transform: 'rotate(90deg)', textAlign: 'center', lineHeight: `${POLICE_BAND}px`, fontFamily: s.fonts.display, fontWeight: 800, fontSize: 64, letterSpacing: '0.1em', whiteSpace: 'nowrap', color: s.palette.chipText}}>
        KIỂM TRA · KIỂM TRA · KIỂM TRA · KIỂM TRA · KIỂM TRA ·
      </div>
    </div>
  );
};

// Ô ảnh hiện trường: clip tràn mép trên và hai bên, đáy xé răng cưa; nhãn là thẻ vật chứng vàng có lỗ xỏ dây, trượt lên 24 px và lắc nhẹ
const CitationPhoto: React.FC<{beat: Extract<ResolvedBeat, {kind: 'broll'}>; kb: number; s: StyleSpec; index: number; frame: number; police?: PoliceState; labelAt: number}> = ({beat, kb, s, index, frame, police, labelAt}) => {
  const ph = CITATION.photo;
  const tg = CITATION.tag;
  const tag = spring({frame: frame - labelAt, fps: FPS, config: {damping: 9, stiffness: 190}});
  const text = `VẬT CHỨNG ${String(index + 1).padStart(2, '0')} · ${(beat.label ?? '').toUpperCase()}`;
  const size = Math.max(24, Math.min(30, Math.floor(820 / (text.length * 0.62))));
  return (
    <div style={{position: 'absolute', left: ph.left, top: ph.top, width: ph.width, height: ph.height, clipPath: citationTearClip(), overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, backgroundColor: '#000', clipPath: police ? policeClip(police) : undefined}}>
        <ClipVideo beat={beat} kb={kb} style={{filter: 'contrast(1.04) saturate(1.04)'}} />
        <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,0) 72%, rgba(0,0,0,0.3) 100%)'}} />
        {beat.label ? (
          <div style={{position: 'absolute', left: tg.left, bottom: ph.height - tg.bottom, opacity: interpolate(tag, [0, 0.3], [0, 1], clamp), transform: `translateY(${interpolate(tag, [0, 1], [24, 0])}px) rotate(${interpolate(tag, [0, 1], [-5, 0])}deg)`, transformOrigin: '0% 50%', filter: 'drop-shadow(0 6px 8px rgba(0,0,0,0.4))'}}>
            <div style={{display: 'flex', alignItems: 'center', background: s.palette.chipBg, color: s.palette.chipText, borderRadius: 8, padding: '8px 22px 10px 16px', gap: 14}}>
              <div style={{width: 18, height: 18, borderRadius: 9, background: '#000', opacity: 0.55, flex: '0 0 auto'}} />
              <div style={{fontFamily: plexMono(), fontWeight: 500, fontSize: size, lineHeight: 1.2, whiteSpace: 'nowrap'}}>{text}</div>
            </div>
          </div>
        ) : null}
      </div>
      {police ? <PoliceBand edge={police.edge} s={s} /> : null}
    </div>
  );
};

// ---- Bố cục 'track' (yeokjeon): đường chạy tartan đỏ cam, dải ảnh tràn ngang giữa trang, số áo thi đấu phía trên ----
// Chất liệu (ghim bạc, ca-rô đen trắng, hạt cao su) ghi trực tiếp; màu thương hiệu lấy từ palette
const CHECKER = 'repeating-conic-gradient(#111111 0 25%, #ffffff 0 50%) 0 0 / 36px 18px';

// Ghim băng bạc cài số áo: vòng cuộn + thanh kẹp, vẽ SVG đơn giản
const SilverPin: React.FC<{k: number; style?: React.CSSProperties}> = ({k, style}) => (
  <svg width={64} height={40} viewBox="0 0 64 40" style={{position: 'absolute', filter: 'drop-shadow(0 3px 3px rgba(0,0,0,0.35))', ...style}}>
    <defs>
      <linearGradient id={`track-pin-${k}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f4f6f8" />
        <stop offset="0.5" stopColor="#a9b1b9" />
        <stop offset="1" stopColor="#e2e6ea" />
      </linearGradient>
    </defs>
    <rect x={10} y={15} width={46} height={10} rx={5} fill={`url(#track-pin-${k})`} />
    <circle cx={13} cy={20} r={9} fill="none" stroke={`url(#track-pin-${k})`} strokeWidth={4} />
    <circle cx={51} cy={20} r={3} fill="#6b737c" />
  </svg>
);

const BIB_STRIP = 64;
const PIN_ROT = [-14, 14, 12, -12];
// Số áo thi đấu: giấy surface bo góc, dải tài trợ có kicker, bốn ghim bạc. `pins`: tỉ lệ phóng của từng ghim (TL, TR, BL, BR)
export const BibShell: React.FC<{s: StyleSpec; kicker: string; width: number; height: number; pins?: number[]; style?: React.CSSProperties; children?: React.ReactNode}> = ({s, kicker, width, height, pins = [1, 1, 1, 1], style, children}) => {
  const pos: React.CSSProperties[] = [{left: 10, top: 6}, {right: 10, top: 6}, {left: 10, bottom: 6}, {right: 10, bottom: 6}];
  return (
    <div style={{position: 'relative', width, height, boxSizing: 'border-box', background: s.palette.surface, borderRadius: 18, boxShadow: '0 20px 36px rgba(0,0,0,0.38), inset 0 0 0 2px rgba(0,0,0,0.06)', ...style}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: BIB_STRIP, borderRadius: '18px 18px 0 0', background: s.palette.emphBg, color: s.palette.chipBg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 90px', fontFamily: s.fonts.body, fontWeight: 700, fontSize: 30, letterSpacing: '0.14em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden'}}>{kicker}</div>
      {children}
      {pos.map((p, k) => (
        <SilverPin key={k} k={k} style={{...p, transform: `rotate(${PIN_ROT[k]}deg) scale(${pins[k] ?? 1})`}} />
      ))}
    </div>
  );
};

// Nền đường chạy: tartan có hạt cao su, hai vạch làn chụm nhẹ về giữa, số làn sơn mờ ở chân trang (vùng UI TikTok, chỉ trang trí).
// `idle` (mặc định): vẽ cả khung dải ảnh (vạch đích, vạch làn, ô trống tối) và số áo mờ khi vùng trên trống; bìa tắt cả hai
export const TrackBackdrop: React.FC<{s: StyleSpec; idle?: boolean}> = ({s, idle = true}) => {
  const p = s.palette;
  const st = TRACK.strip;
  const lane = (x1: number, x2: number) => `${x1},${TRACK.laneTop} ${x1 + 8},${TRACK.laneTop} ${x2 + 8},1920 ${x2},1920`;
  return (
    <AbsoluteFill style={{background: p.bg}}>
      <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, opacity: 0.05, mixBlendMode: 'multiply'}}>
        <filter id="track-rubber">
          <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves={2} seed={7} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#track-rubber)" />
      </svg>
      <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, opacity: 0.35}}>
        <polygon points={lane(352, 392)} fill={p.text} />
        <polygon points={lane(720, 680)} fill={p.text} />
      </svg>
      {[196, 540, 884].map((cx, k) => (
        <div key={k} style={{position: 'absolute', left: cx - 100, width: 200, top: 1650, textAlign: 'center', fontFamily: s.fonts.display, fontWeight: s.fonts.displayWeight, fontSize: 200, lineHeight: 1, color: p.text, opacity: 0.2}}>{k + 1}</div>
      ))}
      {idle ? (
        <>
          <div style={{position: 'absolute', left: st.left, top: st.top, width: st.width, height: st.height, background: 'linear-gradient(180deg, rgba(0,0,0,0.36) 0%, rgba(0,0,0,0.2) 100%)'}} />
          <div style={{position: 'absolute', left: 0, right: 0, top: st.top - TRACK.finish, height: TRACK.finish, background: CHECKER}} />
          <div style={{position: 'absolute', left: 0, right: 0, top: st.top - TRACK.finish - 14, height: 6, background: p.text, opacity: 0.9}} />
          <div style={{position: 'absolute', left: 0, right: 0, top: TRACK.laneTop, height: 8, background: p.text}} />
          <div style={{position: 'absolute', left: TRACK.bib.left, top: TRACK.bib.top, opacity: 0.3}}>
            <BibShell s={s} kicker="Xuất phát" width={TRACK.bib.width} height={TRACK.bib.height}>
              <div style={{position: 'absolute', left: 0, right: 0, top: BIB_STRIP, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: s.fonts.display, fontWeight: s.fonts.displayWeight, fontSize: 170, color: p.textOnSurface, whiteSpace: 'nowrap'}}>01</div>
            </BibShell>
          </div>
        </>
      ) : null}
    </AbsoluteFill>
  );
};

// Chuyển cảnh 'photofinish': vạch quét trắng 6 px từ trái sang phải trong dải ảnh (12 khung, out-cubic). Vào: cảnh mới lộ bên trái vạch;
// ra về cảnh thầy: cảnh cũ bị xóa bên trái vạch. `x` là vị trí vạch trong dải ảnh; undefined khi không chuyển
const PHOTO_FRAMES = 12;
const PHOTO_TRAIL = 140;
type PhotoState = {mode: 'in' | 'out'; x: number};
const photoState = (frame: number, out: number, entrance: Entrance): PhotoState | undefined => {
  const span = [-6, TRACK.strip.width + 6];
  if (out > 0) return {mode: 'out', x: interpolate(out, [0, 1], span, clamp)};
  if (entrance === 'open' || frame >= PHOTO_FRAMES) return undefined;
  return {mode: 'in', x: interpolate(frame, [0, PHOTO_FRAMES], span, {...clamp, easing: Easing.out(Easing.cubic)})};
};

// Dải ảnh tràn ngang 1080×940; nhãn là cột đánh dấu làn (hình thang vàng) trượt vào từ trái ở góc dưới trái
const TrackStrip: React.FC<{beat: Extract<ResolvedBeat, {kind: 'broll'}>; kb: number; s: StyleSpec; index: number; frame: number; photo?: PhotoState; labelAt: number}> = ({beat, kb, s, index, frame, photo, labelAt}) => {
  const st = TRACK.strip;
  const slide = spring({frame: frame - labelAt, fps: FPS, config: {damping: 16, stiffness: 210}});
  const text = `LÀN ${String(index + 1).padStart(2, '0')} · ${(beat.label ?? '').toUpperCase()}`;
  const size = Math.max(28, Math.min(32, Math.floor(820 / (text.length * 0.64))));
  const clip = photo ? (photo.mode === 'in' ? `inset(0 ${st.width - photo.x}px 0 0)` : `inset(0 0 0 ${photo.x}px)`) : undefined;
  return (
    <>
      <div style={{position: 'absolute', left: st.left, top: st.top, width: st.width, height: st.height, overflow: 'hidden'}}>
        <div style={{position: 'absolute', inset: 0, backgroundColor: '#000', clipPath: clip}}>
          <ClipVideo beat={beat} kb={kb} style={{filter: 'contrast(1.04) saturate(1.06)'}} />
          <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 74%, rgba(0,0,0,0.34) 100%)'}} />
        </div>
        {photo ? (
          <>
            <div style={{position: 'absolute', top: 0, bottom: 0, left: photo.x - PHOTO_TRAIL, width: PHOTO_TRAIL, background: `linear-gradient(90deg, ${s.palette.accent}00, ${s.palette.accent}80)`}} />
            <div style={{position: 'absolute', top: 0, bottom: 0, left: photo.x - 3, width: 6, background: s.palette.text, boxShadow: `0 0 18px 4px ${s.palette.text}aa`}} />
          </>
        ) : null}
      </div>
      {photo ? <div style={{position: 'absolute', left: photo.x - 8, top: st.top - TRACK.finish + 1, width: 16, height: 16, borderRadius: 8, background: s.palette.accent, boxShadow: `0 0 12px 3px ${s.palette.accent}aa`}} /> : null}
      {beat.label ? (
        <div style={{position: 'absolute', left: 40, bottom: 1920 - TRACK.laneTop + 28, transform: `translateX(${interpolate(slide, [0, 1], [-700, 0])}px)`, opacity: interpolate(slide, [0, 0.25], [0, 1], clamp), filter: 'drop-shadow(0 8px 10px rgba(0,0,0,0.4))'}}>
          <div style={{background: s.palette.chipBg, color: s.palette.chipText, fontFamily: s.fonts.body, fontWeight: 700, fontSize: size, lineHeight: 1.2, letterSpacing: '0.04em', whiteSpace: 'nowrap', padding: '10px 54px 12px 24px', clipPath: 'polygon(0 0, 100% 0, calc(100% - 28px) 100%, 0 100%)'}}>{text}</div>
        </div>
      ) : null}
    </>
  );
};

// ---- Bố cục 'platform' (hwanseung): sân ga tàu điện ngầm, cửa kính chắn tàu nửa trên, bảng giờ tàu lật chữ ở dưới ----
// Chất liệu (inox xước, gioăng cao su, ron gạch, kính, hạt vạch dẫn đường) ghi trực tiếp; màu thương hiệu lấy từ palette
let overpassMono: string | undefined;
export const overpassMonoFont = () => (overpassMono ??= loadOverpassMono('normal', {weights: ['700'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily);

const BOARD_PAD = 24;
// bảng giờ tàu rộng tới x 1020 nhưng chữ quan trọng phải kết thúc trước x 930
export const BOARD_TEXT_WIDTH = 930 - (PLATFORM.board.left + BOARD_PAD);

// Khung bảng giờ tàu: mặt than, viền nhôm mảnh, hai đinh tán; `children` đặt trong hệ tọa độ của bảng (960×300)
export const PlatformBoard: React.FC<{s: StyleSpec; children?: React.ReactNode; style?: React.CSSProperties}> = ({s, children, style}) => {
  const b = PLATFORM.board;
  const rivet: React.CSSProperties = {position: 'absolute', top: 8, width: 12, height: 12, borderRadius: 6, background: 'radial-gradient(circle at 35% 35%, #e3e7ea, #7d858c)'};
  return (
    <div style={{position: 'absolute', left: b.left, top: b.top, width: b.width, height: b.height, boxSizing: 'border-box', background: s.palette.surface, border: '3px solid #aeb4ba', borderRadius: 8, boxShadow: '0 14px 26px rgba(0,0,0,0.28)', overflow: 'hidden', ...style}}>
      <div style={{...rivet, left: 10}} />
      <div style={{...rivet, right: 10}} />
      {children}
    </div>
  );
};

type FlapChar = {ch: string; hi: boolean};
// Ô lật theo TỪ: `ch` là cả từ, ô rộng theo nội dung (đo ước lượng để vừa dòng, vẽ bằng bề rộng tự nhiên nên không cắt chữ)
const FLAP_GAP = 8;
const flapPad = (fs: number) => Math.round(fs * 0.18);
const flapCellW = (fs: number, word: string) => Math.round([...word].length * fs * 0.52) + flapPad(fs) * 2;
export const flapChars = (line: string, hi: string[]): FlapChar[] => hiSegments(line, hi).flatMap((seg) => seg.text.split(' ').filter(Boolean).map((ch) => ({ch, hi: seg.hi})));
export const flapWidth = (chars: FlapChar[], fs: number) => chars.reduce((a, c) => a + flapCellW(fs, c.ch) + FLAP_GAP, 0) - FLAP_GAP;

// Một hàng ô lật. `anim`: lật vào từ khung `at` (mỗi ô lật 2–3 ký tự trung gian rồi dừng, lệch nhịp trái sang phải, tổng ≤ 14 khung);
// bỏ `anim` thì các ô đứng yên ở chữ đúng. `base`: số thứ tự ô đầu hàng và tổng số ô để chia nhịp qua nhiều hàng
export const FlapLine: React.FC<{chars: FlapChar[]; fs: number; s: StyleSpec; color: string; hiColor: string; frame?: number; anim?: {at: number; base: number; total: number}}> = ({chars, fs, s, color, hiColor, frame = 0, anim}) => (
  <div style={{display: 'flex', gap: FLAP_GAP, height: Math.round(fs * 1.35)}}>
    {chars.map((c, i) => {
      // lật vào: nửa trên gập xuống 2 lần (scaleY), ô trống khi đang lật, rồi hiện chữ; tổng ≤ 12 khung
      let show = true;
      let squash = 1;
      if (anim) {
        const local = frame - (anim.at + 2 + (anim.base + i) * (6 / Math.max(1, anim.total)));
        if (local < 4) {
          show = false;
          squash = local < 0 ? 1 : Math.floor(local) % 2 === 0 ? 0.55 : 1;
        }
      }
      return (
        <div key={i} style={{position: 'relative', boxSizing: 'border-box', height: '100%', padding: `0 ${flapPad(fs)}px`, borderRadius: 6, background: 'linear-gradient(180deg, #1c1f24 0%, #15181c 49.5%, #07080a 50%, #121519 50.5%, #181b20 100%)', color: c.hi ? hiColor : color, fontFamily: s.fonts.display, fontWeight: s.fonts.displayWeight, fontSize: fs, lineHeight: `${Math.round(fs * 1.35)}px`, whiteSpace: 'nowrap', textAlign: 'center', overflow: 'hidden', transform: `scaleY(${squash})`, transformOrigin: 'top', opacity: anim && frame < anim.at ? 0 : 1}}>
          <span style={{opacity: show ? 1 : 0}}>{c.ch}</span>
          <div style={{position: 'absolute', left: 0, right: 0, top: '50%', height: 2, marginTop: -1, background: 'rgba(0,0,0,0.65)'}} />
        </div>
      );
    })}
  </div>
);

// Hàng chữ nghỉ trên bảng: ô đứng yên, mờ. Dùng cho bảng trống và bìa
export const FlapRow: React.FC<{s: StyleSpec; text: string; hi?: string[]; fs: number; opacity?: number}> = ({s, text, hi = [], fs, opacity = 1}) => (
  <div style={{position: 'absolute', left: BOARD_PAD, top: 0, bottom: 0, display: 'flex', alignItems: 'center', opacity}}>
    <FlapLine chars={flapChars(text, hi)} fs={fs} s={s} color={s.palette.textOnSurface} hiColor={s.palette.accent2} />
  </div>
);

// Nền ga tàu: tường gạch men, dải tuyến, khung inox quanh cửa, bảng giờ tàu, vạch an toàn và hàng gạch dẫn đường.
// `idle` (mặc định): bảng trống hiện hàng lật chữ nghỉ; bìa tắt để tự bố trí chữ trên bảng
export const PlatformBackdrop: React.FC<{s: StyleSpec; idle?: boolean}> = ({s, idle = true}) => {
  const p = s.palette;
  const d = PLATFORM.door;
  const f = PLATFORM.frame;
  const b = PLATFORM.board;
  const gasket: React.CSSProperties = {position: 'absolute', top: d.top, width: 8, height: d.height, background: '#1a1d20'};
  return (
    <AbsoluteFill style={{background: p.bg}}>
      <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0}}>
        <defs>
          <pattern id="hw-tile" width={120} height={120} patternUnits="userSpaceOnUse">
            <path d="M0 0H120M0 60H120M0 0V60M60 60V120" stroke={p.text} strokeOpacity={0.12} strokeWidth={2} fill="none" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hw-tile)" />
      </svg>
      <AbsoluteFill style={{background: 'radial-gradient(ellipse 90% 35% at 28% 14%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 70%), linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,0.07) 100%)'}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 60, height: 22, background: p.accent}} />
      <div style={{position: 'absolute', left: 60, top: 48, width: 46, height: 46, borderRadius: 23, boxSizing: 'border-box', background: p.emphText, border: `6px solid ${p.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: s.fonts.body, fontWeight: 800, fontSize: 24, lineHeight: 1, color: p.text}}>2</div>
      {/* khung inox xước quanh cửa, đèn báo, gioăng cao su hai mép dọc */}
      <div style={{position: 'absolute', left: d.left - f, top: d.top - f, width: d.width + f * 2, height: d.height + f * 2, borderRadius: PLATFORM.radius + 4, background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.1) 0 1px, rgba(0,0,0,0.04) 1px 3px), linear-gradient(180deg, #d5d9dd 0%, #a3a9af 45%, #c3c8cd 100%)', boxShadow: '0 12px 26px rgba(0,0,0,0.25)'}} />
      <div style={{position: 'absolute', left: d.left + d.width / 2 - 90, top: d.top - f + 7, display: 'flex', gap: 10}}>
        {[p.accent, p.accent, p.accent, p.chipBg, p.chipBg, p.chipBg].map((c, k) => (
          <div key={k} style={{width: 20, height: 6, borderRadius: 3, background: c, boxShadow: `0 0 6px ${c}`}} />
        ))}
      </div>
      <div style={{position: 'absolute', left: d.left, top: d.top, width: d.width, height: d.height, borderRadius: PLATFORM.radius, background: `radial-gradient(ellipse at 50% 35%, ${p.surface} 0%, #0f1114 100%)`, boxShadow: 'inset 0 0 40px rgba(0,0,0,0.6)'}} />
      <div style={{...gasket, left: d.left - 8, borderRadius: '4px 0 0 4px'}} />
      <div style={{...gasket, left: d.left + d.width, borderRadius: '0 4px 4px 0'}} />
      {/* hai thanh treo bảng giờ tàu */}
      {[170, 880].map((x) => (
        <div key={x} style={{position: 'absolute', left: x, top: b.top - 24, width: 14, height: 30, background: 'linear-gradient(90deg, #8d949b, #cfd4d8, #8d949b)', borderRadius: 3}} />
      ))}
      <PlatformBoard s={s}>{idle ? <FlapRow s={s} text="TUYẾN DU HỌC · D-4 · ĐANG CẬP NHẬT" fs={32} opacity={0.45} /> : null}</PlatformBoard>
      {/* mép sân ga: vạch vàng an toàn và hàng gạch dẫn đường nổi hạt (vùng UI TikTok, chỉ trang trí) */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 1640, height: 28, background: p.chipBg}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 1668, bottom: 0, backgroundColor: `${p.text}1f`, backgroundImage: `radial-gradient(circle, ${p.chipBg}99 0 7px, transparent 8px)`, backgroundSize: '44px 44px'}} />
    </AbsoluteFill>
  );
};

// Chuyển cảnh 'screendoor': 7 khung hai cánh kính trượt khép (nhanh), 7 khung tách ra (êm hơn), chỉ trong ô cửa.
// Khép: ô cửa chưa vẽ clip mới nên cánh cửa khép lên cảnh cũ; khép xong mới có clip dưới cánh rồi mở. Cờ `cut` (entrance 'open') thì không cửa.
// Trả undefined khi không chuyển
const DOOR_CLOSE = 7;
const DOOR_OPEN = 7;
type DoorState = {close: number; hideClip: boolean};
const doorState = (frame: number, out: number, entrance: Entrance): DoorState | undefined => {
  if (out > 0) return {close: interpolate(out, [0, 0.6], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)}), hideClip: false};
  if (entrance === 'open') return undefined;
  if (frame < DOOR_CLOSE) return {close: interpolate(frame, [0, DOOR_CLOSE], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)}), hideClip: true};
  if (frame < DOOR_CLOSE + DOOR_OPEN) return {close: interpolate(frame, [DOOR_CLOSE, DOOR_CLOSE + DOOR_OPEN], [1, 0], {...clamp, easing: Easing.inOut(Easing.quad)}), hideClip: false};
  return undefined;
};

const DoorLeaf: React.FC<{s: StyleSpec; side: 'left' | 'right'; x: number}> = ({s, side, x}) => {
  const w = PLATFORM.door.width / 2;
  const inner = side === 'left' ? {right: 0} : {left: 0};
  return (
    <div style={{position: 'absolute', top: 0, left: x, width: w, height: PLATFORM.door.height, boxSizing: 'border-box', background: 'rgba(118,146,156,0.85)', borderLeft: '6px solid #1a1d20', borderRight: '6px solid #1a1d20'}}>
      <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(255,255,255,0.2) 0 16%, rgba(255,255,255,0) 16% 28%, rgba(255,255,255,0.1) 28% 33%, rgba(255,255,255,0) 33%)'}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: Math.round(PLATFORM.door.height / 3), height: 56, background: s.palette.accent}} />
      <div style={{position: 'absolute', ...inner, top: 300, width: 14, height: 300, margin: '0 28px', borderRadius: 7, background: 'linear-gradient(90deg, #8d949b, #e1e5e8, #8d949b)', boxShadow: '0 2px 6px rgba(0,0,0,0.35)'}} />
    </div>
  );
};

const PlatformDoor: React.FC<{beat: Extract<ResolvedBeat, {kind: 'broll'}>; kb: number; s: StyleSpec; index: number; frame: number; door?: DoorState; labelAt: number; signOut: number}> = ({beat, kb, s, index, frame, door, labelAt, signOut}) => {
  const d = PLATFORM.door;
  const sg = PLATFORM.sign;
  const slide = spring({frame: frame - labelAt, fps: FPS, config: {damping: 16, stiffness: 210}});
  const text = (beat.label ?? '').toUpperCase();
  const size = Math.max(26, Math.min(32, Math.floor(620 / (Math.max(1, text.length) * 0.62))));
  const half = d.width / 2;
  const c = door?.close ?? 0;
  return (
    <>
      <div style={{position: 'absolute', left: d.left, top: d.top, width: d.width, height: d.height, overflow: 'hidden', borderRadius: PLATFORM.radius}}>
        {door?.hideClip ? null : (
          <div style={{position: 'absolute', inset: 0, backgroundColor: '#000'}}>
            <ClipVideo beat={beat} kb={kb} style={{filter: 'contrast(1.04) saturate(1.04)'}} />
            <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 80%, rgba(0,0,0,0.18) 100%)'}} />
          </div>
        )}
        {door ? (
          <>
            <DoorLeaf s={s} side="left" x={-half * (1 - c)} />
            <DoorLeaf s={s} side="right" x={half + half * (1 - c)} />
            <div style={{position: 'absolute', left: half - 3, top: 0, width: 6, height: d.height, background: '#0d0f11', opacity: interpolate(c, [0.85, 1], [0, 1], clamp)}} />
          </>
        ) : null}
      </div>
      {beat.label ? (
        <div style={{position: 'absolute', left: sg.left, top: sg.top, display: 'flex', alignItems: 'center', opacity: interpolate(slide, [0, 0.3], [0, 1], clamp) * signOut, transform: `translateX(${interpolate(slide, [0, 1], [-30, 0])}px)`, filter: 'drop-shadow(0 6px 8px rgba(0,0,0,0.4))'}}>
          <div style={{width: 62, height: 62, borderRadius: 31, boxSizing: 'border-box', background: s.palette.emphText, border: `7px solid ${s.palette.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: overpassMonoFont(), fontWeight: 700, fontSize: 28, lineHeight: 1, color: s.palette.text, zIndex: 1}}>{String(index + 1).padStart(2, '0')}</div>
          <div style={{marginLeft: -12, background: s.palette.emphText, color: s.palette.text, fontFamily: s.fonts.body, fontWeight: 800, fontSize: size, lineHeight: 1.2, letterSpacing: '0.03em', whiteSpace: 'nowrap', padding: '8px 26px 10px 26px', borderRadius: '0 8px 8px 0'}}>{text}</div>
        </div>
      ) : null}
    </>
  );
};

// Gạch chân đỏ vẽ tay cho từ khóa dài (vẽ dần từ trái sang)
const UnderlineMark: React.FC<{at: number; color: string; children: React.ReactNode}> = ({at, color, children}) => {
  const frame = useCurrentFrame();
  const k = interpolate(frame, [at, at + 10], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  return (
    <span style={{position: 'relative', display: 'inline-block'}}>
      {children}
      <svg width="100%" height={14} viewBox="0 0 100 14" preserveAspectRatio="none" style={{position: 'absolute', left: 0, bottom: -2, clipPath: `inset(0 ${(1 - k) * 100}% 0 0)`}}>
        <path d="M1 8 C 25 3, 55 12, 99 5" fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </span>
  );
};

export const BrollLayer: React.FC = () => {
  const {beats} = useBeats();
  const s = useStyle();
  let whip = 0;
  let zoom = 0;
  let shot = 0;
  return (
    <>
      {beats.map((b, i) => {
        const prev = beats[i - 1];
        const next = beats[i + 1];
        if (b.kind === 'talk') {
          return i > 0 ? <Sfx key={i} at={b.from - 4} name={s.sfx.zoom[zoom++ % s.sfx.zoom.length]} volume={0.28} /> : null;
        }
        // cut: cắt thẳng, không chuyển cảnh (cảnh nhanh liên tiếp; chuyển cảnh dài như crt dày quá thì rối mắt, tien-015)
        const entrance: Entrance = !prev || b.cut ? 'open' : prev.kind === 'talk' ? 'in' : (['whip-left', 'whip-right'] as Entrance[])[whip % 2];
        const transition = !prev || b.cut ? null : entrance === 'in' ? s.sfx.zoom[zoom++ % s.sfx.zoom.length] : s.sfx.whip[whip % s.sfx.whip.length];
        if (prev && prev.kind === 'broll') whip++;
        // cảnh minh họa kéo dài thêm một nhịp chuyển để cảnh sau lướt vào trên nền cảnh trước
        const length = b.to - b.from + (next?.kind === 'broll' ? TRANSITION : 0);
        const hits = b.hit ? (Array.isArray(b.hit) ? b.hit : [b.hit]) : [];
        return (
          <React.Fragment key={i}>
            <Sequence from={b.from} durationInFrames={length}>
              <BrollScene beat={b} entrance={entrance} toTalk={next?.kind === 'talk' && !b.hardOut} length={length} index={shot++} />
            </Sequence>
            {transition && !b.silent ? <Sfx at={b.from - 3} name={transition} volume={0.3} /> : null}
            {s.broll === 'console' && b.label && !b.silent ? <Sfx at={b.from + consoleLabelAt(entrance)} name={s.sfx.headline} volume={0.16} /> : null}
            {s.broll === 'lightbox' && b.label && !b.silent ? <Sfx at={b.from + consoleLabelAt(entrance)} name="click-interface" volume={0.14} /> : null}
            {s.broll === 'citation' && b.label && !b.silent && !b.cut ? <Sfx at={b.from + consoleLabelAt(entrance)} name="click-check" volume={0.14} /> : null}
            {s.broll === 'platform' && b.label && !b.silent ? <Sfx at={b.from + consoleLabelAt(entrance)} name="confirm" volume={0.14} /> : null}
            {s.broll === 'track' && b.label && !b.silent ? <Sfx at={b.from + consoleLabelAt(entrance)} name={s.sfx.pop[0]} volume={0.14} /> : null}
            {hits.map((h, k) => (
              <Sfx key={h} at={b.from + 8 + k * 7} name={h} volume={0.3} />
            ))}
            {b.amb ? <Ambience from={b.from} to={b.to} name={b.amb} volume={b.ambVolume ?? 0.1} /> : null}
          </React.Fragment>
        );
      })}
    </>
  );
};

// Tiêu đề lớn ở vùng trên, vẽ theo kiểu tiêu đề của style
export const Headline: React.FC<{from: number; to: number; kicker: string; text: string; hi?: string[]; size?: number}> = ({
  from,
  to,
  kicker,
  text,
  hi = [],
  size = 84,
}) => (
  <Sequence from={from} durationInFrames={to - from} layout="none">
    <HeadlineBody duration={to - from} kicker={kicker} text={text} hi={hi} size={size} />
  </Sequence>
);

const HeadlineBody: React.FC<{duration: number; kicker: string; text: string; hi: string[]; size: number}> = ({duration, kicker, text, hi, size}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = useStyle();
  const exit = interpolate(frame, [duration - 8, duration], [1, 0], clamp);
  const enter = spring({frame, fps, config: {damping: 15, stiffness: 190}});
  const display = s.fonts.uppercaseDisplay ? text.toUpperCase() : text;
  const hiWords = s.fonts.uppercaseDisplay ? hi.map((h) => h.toUpperCase()) : hi;
  const reveal = (color: string, extra: React.CSSProperties = {}) => (
    <MaskReveal
      text={display}
      at={3}
      size={size}
      weight={s.fonts.displayWeight}
      color={color}
      highlight={hiWords}
      highlightColor={s.palette.accent}
      stagger={2}
      style={{fontFamily: s.fonts.display, ...extra}}
    />
  );
  const wrap: React.CSSProperties = {position: 'absolute', top: 268, left: 64, right: 64, opacity: exit, display: 'flex', flexDirection: 'column', gap: 14};
  switch (s.headline) {
    case 'boxed':
      return (
        <div style={wrap}>
          <div style={{alignSelf: 'flex-start', background: s.palette.accent, color: '#fff', fontFamily: s.fonts.body, fontWeight: 900, fontSize: 30, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '6px 18px 8px', transform: `translateX(${interpolate(enter, [0, 1], [-300, 0])}px)`}}>{kicker}</div>
          <div style={{alignSelf: 'flex-start', background: 'rgba(0,0,0,0.88)', padding: '10px 22px 16px', transform: `scaleX(${enter})`, transformOrigin: 'left center'}}>{reveal(s.palette.text, {lineHeight: 1.1})}</div>
        </div>
      );
    case 'tape':
      return (
        <div style={{...wrap, alignItems: 'flex-start'}}>
          <div style={{position: 'relative', background: s.palette.surface, padding: '26px 34px 30px', transform: `rotate(-2deg) scale(${interpolate(enter, [0, 1], [0.7, 1])})`, boxShadow: '0 24px 60px rgba(0,0,0,0.4)', borderRadius: 10}}>
            <div style={{position: 'absolute', top: -22, left: '40%', width: 180, height: 46, background: `${s.palette.accent}cc`, transform: 'rotate(-4deg)'}} />
            <div style={{fontFamily: s.fonts.body, fontWeight: 800, fontSize: 32, color: s.palette.accent2, marginBottom: 6}}>{kicker}</div>
            {reveal(s.palette.textOnSurface)}
          </div>
        </div>
      );
    case 'serif':
      return (
        <div style={wrap}>
          <div style={{display: 'flex', alignItems: 'center', gap: 16, opacity: enter}}>
            <div style={{fontFamily: s.fonts.display, fontStyle: 'italic', fontWeight: 700, fontSize: 36, color: s.palette.accent}}>{kicker}</div>
            <div style={{flex: 1, height: 2, background: s.palette.accent, transform: `scaleX(${enter})`, transformOrigin: 'left center'}} />
          </div>
          {reveal(s.palette.text, {textShadow: '0 4px 24px rgba(0,0,0,0.55)', letterSpacing: '-0.01em'})}
        </div>
      );
    case 'board': {
      // bảng giờ bay: mỗi chữ một ô lật xuống lần lượt, từ khóa ô màu
      const lines = display.split('\n');
      const longest = Math.max(...lines.map((l) => l.length));
      const tile = Math.min(size * 0.66, 940 / Math.max(1, longest) - 4);
      let k = 0;
      return (
        <div style={{...wrap, gap: 10}}>
          <div style={{alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 14, background: s.palette.emphBg, color: '#fff', fontFamily: s.fonts.body, fontWeight: 800, fontSize: 28, letterSpacing: '0.16em', textTransform: 'uppercase', padding: '6px 18px 8px', borderRadius: 6, transform: `translateX(${interpolate(enter, [0, 1], [-320, 0])}px)`}}>
            <span>✈</span>
            {kicker}
          </div>
          <div style={{alignSelf: 'flex-start', background: 'rgba(8,10,14,0.92)', borderRadius: 14, padding: '14px 14px 12px', display: 'flex', flexDirection: 'column', gap: 6, boxShadow: '0 20px 50px rgba(0,0,0,0.45)'}}>
            {lines.map((line, li) => {
              const words = line.split(' ');
              return (
                <div key={li} style={{display: 'flex', gap: 4}}>
                  {words.map((w, wi) => {
                    const lit = hiWords.some((h) => h.split(' ').includes(w));
                    return (
                      <React.Fragment key={wi}>
                        {wi > 0 ? <div style={{width: tile * 0.45}} /> : null}
                        {[...w].map((ch, ci) => {
                          const at = 3 + k++ * 0.8;
                          const flip = interpolate(frame, [at, at + 6], [-90, 0], {...clamp, easing: Easing.out(Easing.back(1.6))});
                          return (
                            <div
                              key={ci}
                              style={{
                                width: tile,
                                height: tile * 1.42,
                                borderRadius: 6,
                                background: lit ? `linear-gradient(180deg, ${s.palette.emphBg} 49.5%, rgba(0,0,0,0.35) 50%, ${s.palette.emphBg} 50.5%)` : 'linear-gradient(180deg, #232833 49.5%, #000 50%, #1b1f28 50.5%)',
                                color: lit ? '#fff' : s.palette.text,
                                fontFamily: s.fonts.display,
                                fontWeight: s.fonts.displayWeight,
                                fontSize: tile * 1.18,
                                lineHeight: `${tile * 1.42}px`,
                                textAlign: 'center',
                                transform: `perspective(400px) rotateX(${flip}deg)`,
                                transformOrigin: 'center top',
                                opacity: flip <= -89 ? 0 : 1,
                              }}
                            >
                              {ch}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    case 'ledger':
      // mẩu biên lai: số mục in đơn cách màu đỏ, câu chính chữ mực, từ khóa đỏ, mép dưới xé răng cưa
      return (
        <div style={{...wrap, alignItems: 'flex-start'}}>
          <div style={{filter: 'drop-shadow(0 22px 40px rgba(0,0,0,0.5))', transform: `translateY(${interpolate(enter, [0, 1], [-50, 0])}px) rotate(-1.2deg)`, opacity: interpolate(enter, [0, 0.3], [0, 1], clamp)}}>
            <div style={{background: s.palette.surface, padding: '18px 32px 40px', clipPath: zigBottom(952)}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 14, fontFamily: monoFont(), fontWeight: 800, fontSize: 28, letterSpacing: '0.1em', textTransform: 'uppercase', color: s.palette.emphBg}}>
                <span>№</span>
                {kicker}
              </div>
              <div style={{borderTop: `3px dashed ${s.palette.textOnSurface}44`, margin: '10px 0 6px'}} />
              <MaskReveal
                text={display}
                at={3}
                size={size}
                weight={s.fonts.displayWeight}
                color={s.palette.textOnSurface}
                highlight={hiWords}
                highlightColor={s.palette.emphBg}
                stagger={2}
                style={{fontFamily: s.fonts.display, lineHeight: 1.06}}
              />
            </div>
          </div>
        </div>
      );
    case 'exam': {
      // dải giấy thi: lề đỏ đôi bên trái, nhãn câu hỏi trong ô hồng, câu chính mực chì, vệt dạ quang quét dưới câu
      const swipe = interpolate(frame, [10, 24], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
      return (
        <div style={{...wrap, alignItems: 'flex-start'}}>
          <div style={{position: 'relative', background: s.palette.surface, padding: '18px 34px 24px 58px', borderRadius: 8, boxShadow: '0 24px 54px rgba(0,0,0,0.45)', transform: `translateY(${interpolate(enter, [0, 1], [-44, 0])}px)`, opacity: interpolate(enter, [0, 0.3], [0, 1], clamp)}}>
            <div style={{position: 'absolute', left: 26, top: 0, bottom: 0, width: 4, background: s.palette.emphBg}} />
            <div style={{position: 'absolute', left: 34, top: 0, bottom: 0, width: 2, background: s.palette.emphBg}} />
            <div style={{display: 'inline-flex', alignItems: 'center', gap: 12, background: s.palette.emphBg, color: s.palette.emphText, fontFamily: s.fonts.body, fontWeight: 700, fontSize: 28, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '5px 16px 7px', borderRadius: 6, marginBottom: 10}}>
              <span style={{width: 18, height: 18, borderRadius: 9, background: s.palette.emphText}} />
              {kicker}
            </div>
            <div style={{position: 'relative'}}>
              <div style={{position: 'absolute', left: -10, right: -10, bottom: 6, height: '34%', background: `${s.palette.accent}cc`, transform: `scaleX(${swipe})`, transformOrigin: 'left center', borderRadius: 4}} />
              <MaskReveal
                text={display}
                at={3}
                size={size}
                weight={s.fonts.displayWeight}
                color={s.palette.textOnSurface}
                highlight={hiWords}
                highlightColor={s.palette.emphBg}
                stagger={2}
                style={{fontFamily: s.fonts.display, lineHeight: 1.04, position: 'relative'}}
              />
            </div>
          </div>
        </div>
      );
    }
    case 'stamp': {
      // dấu cao su đỏ đập xuống làm nhãn, câu chính mực xanh trên mẩu giấy kraft có viền sọc thư máy bay ở mép trên
      const slam = interpolate(frame, [0, 6], [1.7, 1], {...clamp, easing: Easing.in(Easing.quad)});
      const ink = interpolate(frame, [0, 3], [0, 1], clamp);
      const stripes = `repeating-linear-gradient(135deg, ${s.palette.accent2} 0 22px, ${s.palette.surface} 22px 34px, ${s.palette.textOnSurface} 34px 56px, ${s.palette.surface} 56px 68px)`;
      return (
        <div style={{...wrap, alignItems: 'flex-start'}}>
          <div style={{position: 'relative', background: s.palette.surface, borderRadius: 6, boxShadow: '0 24px 54px rgba(0,0,0,0.45)', overflow: 'visible', transform: `translateY(${interpolate(enter, [0, 1], [-40, 0])}px)`, opacity: interpolate(enter, [0, 0.3], [0, 1], clamp)}}>
            <div style={{height: 12, background: stripes, borderRadius: '6px 6px 0 0'}} />
            <div style={{padding: '18px 30px 20px'}}>
              <div style={{display: 'inline-block', marginBottom: 10, transform: `rotate(-3deg) scale(${slam})`, transformOrigin: 'left center', opacity: ink}}>
                <div style={{border: `5px solid ${s.palette.accent2}`, padding: 4, borderRadius: 6}}>
                  <div style={{border: `2px solid ${s.palette.accent2}`, borderRadius: 3, padding: '4px 16px 6px', fontFamily: s.fonts.body, fontWeight: 800, fontSize: 30, letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1.3, color: s.palette.accent2}}>{kicker}</div>
                </div>
              </div>
              <MaskReveal
                text={display}
                at={6}
                size={size}
                weight={s.fonts.displayWeight}
                color={s.palette.textOnSurface}
                highlight={hiWords}
                highlightColor={s.palette.accent2}
                stagger={2}
                style={{fontFamily: s.fonts.display, lineHeight: 1.22, rowGap: size * 0.14}}
              />
            </div>
          </div>
        </div>
      );
    }
    case 'entry': {
      // dòng giao dịch in vào sổ: cột mã bên trái, nội dung bên phải, vạch kẻ dưới; kicker là cột "loại giao dịch"
      const top = PAGE[s.broll]?.headlineTop ?? 1120;
      const ink = s.palette.textOnSurface;
      return (
        <div style={{position: 'absolute', top, left: PASSBOOK.margin + 30, right: 150, opacity: exit, display: 'flex', flexDirection: 'column', gap: 10}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 16, transform: `translateX(${interpolate(enter, [0, 1], [-40, 0])}px)`, opacity: interpolate(enter, [0, 0.4], [0, 1], clamp)}}>
            <div style={{fontFamily: monoFont(), fontWeight: 800, fontSize: 30, color: s.palette.surface, background: s.palette.accent2, padding: '4px 16px 6px', borderRadius: 4, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap'}}>{kicker}</div>
            <div style={{flex: 1, borderBottom: `3px dotted ${ink}66`}} />
          </div>
          <div style={{borderBottom: `4px solid ${ink}`, paddingBottom: 10}}>{reveal(ink, {lineHeight: 1.18, rowGap: size * 0.1})}</div>
        </div>
      );
    }
    case 'notify': {
      // thông báo đẩy của app trượt từ trên xuống, nằm đè lên thanh app
      const top = PAGE[s.broll]?.headlineTop ?? 150;
      const drop = interpolate(enter, [0, 1], [-260, 0]);
      return (
        <div style={{position: 'absolute', top, left: 40, right: 40, opacity: exit, transform: `translateY(${drop}px)`}}>
          <div style={{background: '#ffffff', borderRadius: 40, padding: '24px 30px 28px', boxShadow: '0 24px 70px rgba(15,28,63,0.28)', display: 'flex', gap: 22, alignItems: 'flex-start'}}>
            <div style={{flex: '0 0 auto', width: 76, height: 76, borderRadius: 22, background: s.palette.accent, color: '#fff', fontFamily: s.fonts.display, fontWeight: 800, fontSize: 44, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>₩</div>
            <div style={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6}}>
              <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: s.fonts.body, fontWeight: 800, fontSize: 28, color: '#6b7896'}}>
                <span style={{textTransform: 'uppercase', letterSpacing: '0.06em'}}>{kicker}</span>
                <span>bây giờ</span>
              </div>
              {reveal(s.palette.text, {lineHeight: 1.16, rowGap: size * 0.08})}
            </div>
          </div>
        </div>
      );
    }
    case 'seal': {
      // dấu cao su đỏ viền đôi đập xuống trên tờ hồ sơ, câu chính chữ serif mực xanh ngay dưới, không có thẻ nền
      const top = PAGE[s.broll]?.headlineTop ?? 230;
      const bottom = (PAGE[s.broll]?.captionTop ?? 700) - 24;
      const slam = interpolate(frame, [0, 6], [1.8, 1], {...clamp, easing: Easing.in(Easing.quad)});
      const ink = interpolate(frame, [0, 3], [0, 1], clamp);
      return (
        <div style={{position: 'absolute', top, left: 84, right: 84, height: bottom - top, opacity: exit, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'flex-start', gap: 18}}>
          <div style={{transform: `rotate(-4deg) scale(${slam})`, transformOrigin: 'left center', opacity: ink * 0.92, border: `5px solid ${s.palette.accent}`, padding: 4, borderRadius: 8}}>
            <div style={{border: `2px solid ${s.palette.accent}`, borderRadius: 4, padding: '4px 18px 6px', fontFamily: s.fonts.body, fontWeight: 900, fontSize: 30, letterSpacing: '0.14em', textTransform: 'uppercase', color: s.palette.accent, whiteSpace: 'nowrap'}}>{kicker}</div>
          </div>
          {reveal(s.palette.textOnSurface, {lineHeight: 1.12})}
        </div>
      );
    }
    case 'redpen': {
      // thẻ giấy trong vùng dưới ô chi tiết: kicker kiểu tiêu đề cột có chấm dẫn, câu chính mực, từ khóa bị khoanh/gạch bằng nét bút đỏ vẽ dần
      const top = PAGE[s.broll]?.headlineTop ?? PAYSLIP.low.top;
      const ink = s.palette.textOnSurface;
      const lines = display.split('\n');
      const hiSet = new Set(hiWords);
      const hiCount = lines.reduce((n, ln) => n + ln.split(' ').filter((w) => hiSet.has(w)).length, 0);
      let hiIdx = 0;
      let wIdx = 0;
      return (
        <div style={{position: 'absolute', top, left: 70, right: 150, opacity: exit, transform: `translateY(${interpolate(enter, [0, 1], [24, 0]) - 10 * (1 - exit)}px)`, filter: 'drop-shadow(0 16px 24px rgba(10,16,13,0.4))'}}>
          <div style={{background: s.palette.surface, borderRadius: 10, borderTop: `6px solid ${s.palette.accent2}`, padding: '14px 28px 20px', opacity: interpolate(enter, [0, 0.4], [0, 1], clamp)}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6}}>
              <span style={{fontFamily: s.fonts.body, fontWeight: 600, fontSize: 28, letterSpacing: '0.12em', textTransform: 'uppercase', color: `${ink}bb`, whiteSpace: 'nowrap'}}>{kicker}</span>
              <span style={{flex: 1, borderTop: `3px dotted ${ink}44`, transform: `scaleX(${interpolate(enter, [0, 1], [0, 1])})`, transformOrigin: 'left center'}} />
            </div>
            {lines.map((line, li) => (
              <div key={li} style={{display: 'flex', flexWrap: 'wrap', columnGap: size * 0.28, fontFamily: s.fonts.display, fontWeight: s.fonts.displayWeight, fontSize: size, lineHeight: 1.2, color: ink}}>
                {line.split(' ').map((w, wi) => {
                  const isHi = hiSet.has(w);
                  const wAt = 4 + wIdx++ * 2;
                  const wp = spring({frame: frame - wAt, fps, config: {damping: 16, stiffness: 200}});
                  const penAt = 12 + hiIdx++ * 9;
                  const pw = Math.max(40, w.length * size * 0.6);
                  const ph = size * 1.15;
                  const draw = isHi ? interpolate(frame, [penAt, penAt + 11], [0, 1], {...clamp, easing: Easing.inOut(Easing.quad)}) : 0;
                  const circle = hiCount === 1;
                  const d = circle
                    ? `M ${pw * 0.1} ${ph * 0.62} C ${pw * 0.02} ${ph * 0.15}, ${pw * 0.45} ${-ph * 0.02}, ${pw * 0.78} ${ph * 0.08} C ${pw * 1.05} ${ph * 0.2}, ${pw * 1.04} ${ph * 0.8}, ${pw * 0.7} ${ph * 0.95} C ${pw * 0.4} ${ph * 1.06}, ${pw * -0.02} ${ph * 0.92}, ${pw * 0.04} ${ph * 0.42} C ${pw * 0.07} ${ph * 0.22}, ${pw * 0.2} ${ph * 0.1}, ${pw * 0.36} ${ph * 0.06}`
                    : `M ${pw * 0.0} ${ph * 0.92} C ${pw * 0.25} ${ph * 0.86}, ${pw * 0.55} ${ph * 0.97}, ${pw * 1.0} ${ph * 0.88}`;
                  return (
                    <span key={wi} style={{position: 'relative', display: 'inline-block', opacity: interpolate(wp, [0, 0.4], [0, 1], clamp), transform: `translateY(${interpolate(wp, [0, 1], [14, 0])}px)`}}>
                      {w}
                      {isHi ? (
                        <svg viewBox={`0 0 ${pw} ${ph}`} preserveAspectRatio="none" style={{position: 'absolute', left: circle ? -14 : -4, top: circle ? 0 : 2, width: circle ? 'calc(100% + 28px)' : 'calc(100% + 8px)', height: '100%', overflow: 'visible', pointerEvents: 'none'}}>
                          <path d={d} pathLength={1} fill="none" stroke={s.palette.accent} strokeWidth={circle ? 6 : 8} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={1} strokeDashoffset={1 - draw} />
                        </svg>
                      ) : null}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      );
    }
    case 'menuboard': {
      // bảng menu gỗ treo trong ngăn dưới của khay: dòng tên món + chấm dẫn + ô giá màu nhấn; câu chính chữ kem trên gỗ
      const top = PAGE[s.broll]?.headlineTop ?? 1122;
      const swing = spring({frame, fps: FPS, config: {damping: 9, stiffness: 160}});
      const wood = 'repeating-linear-gradient(178deg, rgba(0,0,0,0.05) 0 3px, rgba(255,255,255,0.03) 3px 9px), linear-gradient(180deg, #7a4a24 0%, #5c3518 100%)';
      return (
        <div style={{position: 'absolute', top, left: 70, right: 150, opacity: exit, transform: `rotate(${interpolate(swing, [0, 1], [-4, 0])}deg) translateY(${interpolate(enter, [0, 1], [-30, 0])}px)`, transformOrigin: '50% 0%', filter: 'drop-shadow(0 18px 26px rgba(40,25,10,0.45))'}}>
          <div style={{background: wood, borderRadius: 14, border: '6px solid #4a2a12', padding: '16px 26px 22px', display: 'flex', flexDirection: 'column', gap: 8}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 14, opacity: interpolate(enter, [0, 0.4], [0, 1], clamp)}}>
              <span style={{fontFamily: s.fonts.body, fontWeight: 700, fontSize: 30, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#f3dcb4', whiteSpace: 'nowrap'}}>{kicker}</span>
              <span style={{flex: 1, borderTop: '4px dotted #f3dcb466'}} />
              <span style={{fontFamily: s.fonts.display, fontSize: 30, color: '#4a2a12', background: '#f3dcb4', borderRadius: 8, padding: '2px 14px 4px', transform: `scale(${interpolate(frame, [6, 12], [1.4, 1], {...clamp, easing: Easing.in(Easing.quad)})})`}}>₩</span>
            </div>
            {reveal('#fffaf0', {lineHeight: 1.14, rowGap: size * 0.08})}
          </div>
        </div>
      );
    }
    case 'timecard': {
      // thẻ chấm công cắm vào máy: trượt xuống từ mép trên ô kính, dải đầu thẻ màu nhấn đóng "cạch", lỗ đục bên trái, cột ô giờ bên phải
      const top = PAGE[s.broll]?.headlineTop ?? 336;
      const drop = interpolate(enter, [0, 1], [-120, 0]);
      const punch = interpolate(frame, [4, 9], [1.35, 1], {...clamp, easing: Easing.in(Easing.quad)});
      const ink = s.palette.textOnSurface;
      return (
        <div style={{position: 'absolute', top, left: 70, right: 150, opacity: exit, transform: `translateY(${drop}px)`, filter: 'drop-shadow(0 22px 36px rgba(0,0,0,0.5))'}}>
          <div style={{position: 'relative', background: s.palette.surface, borderRadius: 10, overflow: 'hidden', clipPath: interpolate(enter, [0, 1], [0, 100]) < 100 ? `inset(0 0 ${100 - interpolate(enter, [0, 1], [0, 100])}% 0)` : undefined}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 16, background: s.palette.accent, padding: '10px 26px 12px', transform: `scale(${punch})`, transformOrigin: 'left center'}}>
              <div style={{width: 22, height: 22, borderRadius: 11, background: s.palette.bg}} />
              <div style={{fontFamily: s.fonts.body, fontWeight: 800, fontSize: 30, letterSpacing: '0.12em', textTransform: 'uppercase', color: s.palette.bg, whiteSpace: 'nowrap'}}>{kicker}</div>
            </div>
            <div style={{display: 'flex'}}>
              <div style={{flex: 1, minWidth: 0, padding: '18px 26px 24px', backgroundImage: `repeating-linear-gradient(180deg, transparent 0 ${Math.round(size * 1.12) - 2}px, ${ink}14 ${Math.round(size * 1.12) - 2}px ${Math.round(size * 1.12)}px)`}}>{reveal(ink, {lineHeight: 1.12, rowGap: size * 0.06})}</div>
              <div style={{flex: '0 0 auto', width: 58, borderLeft: `3px solid ${ink}22`, display: 'flex', flexDirection: 'column'}}>
                {[0, 1, 2, 3].map((k) => (
                  <div key={k} style={{flex: 1, borderBottom: k < 3 ? `2px solid ${ink}18` : 'none', background: k === 1 ? `${s.palette.emphBg}${frame > 9 ? 'dd' : '00'}` : 'transparent'}} />
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }
    case 'dymo': {
      // dải công tắc trên cùng: kicker là băng Dymo nhỏ, câu chính chữ display, từ khóa nằm trên băng Dymo vàng, dập từng chữ; ra nhanh lên trên
      const t = CONSOLE.top;
      const lines = display.split('\n');
      const fit = Math.min(size, Math.floor((t.height - 48 - 56 - 14) / (lines.length * 1.3)), fitDisplay(s, lines, 820, size));
      const hiSet = new Set(hiWords);
      const slideK = interpolate(enter, [0, 1], [-420, 0]);
      let hiIdx = 0;
      let wIdx = 0;
      const emboss = '1px 1px 0 rgba(255,255,255,0.5), -1px -1px 0 rgba(0,0,0,0.28)';
      return (
        <div style={{...consolePlateStyle(s), opacity: exit, transform: `translateY(${-30 * (1 - exit)}px)`, padding: '20px 30px 22px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12, overflow: 'hidden'}}>
          <Sfx at={10} name={s.sfx.headline} volume={0.14} />
          <div style={{transform: `translateX(${slideK}px)`, opacity: interpolate(enter, [0, 0.3], [0, 1], clamp), background: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), ${s.palette.accent2}`, color: s.palette.text, fontFamily: s.fonts.body, fontWeight: 700, fontSize: 28, lineHeight: 1.3, letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap', padding: '2px 40px 4px 16px', clipPath: 'polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%)', textShadow: '1px 1px 0 rgba(0,0,0,0.5)'}}>{kicker}</div>
          {lines.map((line, li) => (
            <div key={li} style={{display: 'flex', flexWrap: 'nowrap', alignItems: 'center', columnGap: fit * 0.26, fontFamily: s.fonts.display, fontWeight: s.fonts.displayWeight, fontSize: fit, lineHeight: 1.3, color: s.palette.text, whiteSpace: 'nowrap'}}>
              {line.split(' ').map((w, wi) => {
                const isHi = hiSet.has(w);
                const wAt = 4 + wIdx++ * 2;
                const wp = spring({frame: frame - wAt, fps, config: {damping: 16, stiffness: 200}});
                if (!isHi) return <span key={wi} style={{display: 'inline-block', opacity: interpolate(wp, [0, 0.4], [0, 1], clamp), transform: `translateY(${interpolate(wp, [0, 1], [12, 0])}px)`}}>{w}</span>;
                const k = hiIdx++;
                const at = 8 + k * 8;
                const grow = interpolate(frame, [at, at + 7], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
                return (
                  <span key={wi} style={{position: 'relative', display: 'inline-block', color: s.palette.chipText, textShadow: emboss, padding: '0 14px', transform: `rotate(${k % 2 ? 1 : -1}deg)`}}>
                    <span style={{position: 'absolute', inset: '2px 0 4px 0', background: `linear-gradient(180deg, rgba(255,255,255,0.3) 0, transparent 12%, transparent 86%, rgba(0,0,0,0.18) 100%), ${s.palette.chipBg}`, clipPath: 'polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%)', transform: `scaleX(${grow})`, transformOrigin: 'left center', boxShadow: '0 5px 8px rgba(0,0,0,0.45)'}} />
                    <span style={{position: 'relative', display: 'inline-flex'}}>
                      {Array.from(w).map((ch, ci) => {
                        const c = interpolate(frame, [at + 2 + ci * 2, at + 5 + ci * 2], [0, 1], clamp);
                        return <span key={ci} style={{display: 'inline-block', opacity: c, transform: `scale(${interpolate(c, [0, 1], [1.4, 1])})`}}>{ch}</span>;
                      })}
                    </span>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      );
    }
    case 'foldertab': {
      // bìa hồ sơ kraft nhô tai trong LIGHTBOX.tab: kicker trên tai, câu chính display mực tối, từ khóa có nét dạ quang quét dưới chữ; vào trượt lên 40 px + mờ→rõ, chữ lệch nhịp, ra nhanh xuống dưới
      const t = LIGHTBOX.tab;
      const lines = display.split('\n');
      const fit = Math.min(size, Math.floor((t.height - FOLDER_EAR - 30) / (lines.length * 1.2)), fitDisplay(s, lines, t.width - 60, size));
      let wIdx = 0;
      let hiIdx = 0;
      return (
        <FolderShell
          s={s}
          ear={kicker}
          style={{opacity: interpolate(enter, [0, 0.4], [0, 1], clamp) * exit, transform: `translateY(${interpolate(enter, [0, 1], [40, 0]) + 40 * (1 - exit)}px)`, filter: 'drop-shadow(0 16px 22px rgba(0,0,0,0.38))'}}
        >
          <Sfx at={4} name={s.sfx.headline} volume={0.14} />
          {lines.map((line, li) => {
            const items: {text: string; hi: boolean; gap: boolean}[] = [];
            let gap = false;
            for (const seg of hiSegments(line, hiWords)) {
              if (seg.hi) {
                items.push({text: seg.text, hi: true, gap});
                gap = false;
                continue;
              }
              seg.text.split(' ').forEach((wd, j) => {
                if (j > 0) gap = true;
                if (wd) {
                  items.push({text: wd, hi: false, gap});
                  gap = false;
                }
              });
            }
            return (
              <div key={li} style={{display: 'flex', flexWrap: 'nowrap', fontFamily: s.fonts.display, fontWeight: s.fonts.displayWeight, fontSize: fit, lineHeight: 1.2, color: s.palette.textOnSurface, whiteSpace: 'nowrap'}}>
                {items.map((it, k) => {
                  const wp = spring({frame: frame - (4 + wIdx++ * 2), fps, config: {damping: 16, stiffness: 200}});
                  const grow = it.hi ? interpolate(frame, [14 + hiIdx * 8, 24 + hiIdx++ * 8], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)}) : 0;
                  const body = it.hi ? (
                    <span style={{position: 'relative', display: 'inline-block'}}>
                      <span style={{position: 'absolute', left: -4, right: -4, bottom: '6%', height: '45%', background: `${s.palette.accent}cc`, transform: `scaleX(${grow})`, transformOrigin: 'left center'}} />
                      <span style={{position: 'relative'}}>{it.text}</span>
                    </span>
                  ) : it.text;
                  return (
                    <span key={k} style={{display: 'inline-block', marginLeft: it.gap ? fit * 0.26 : 0, opacity: interpolate(wp, [0, 0.4], [0, 1], clamp), transform: `translateY(${interpolate(wp, [0, 1], [12, 0])}px)`}}>{body}</span>
                  );
                })}
              </div>
            );
          })}
        </FolderShell>
      );
    }
    case 'formfield': {
      // ô điền biểu mẫu trong CITATION.head: nhãn in sẵn (mờ→rõ 6 khung), câu chính hiện lệch nhịp từng dòng như điền tay, từ khóa bị khoanh/gạch đỏ (tối đa 2 nét); ra nhanh 6 khung
      const h = CITATION.head;
      const lines = display.split('\n');
      const fit = Math.min(size, Math.floor((h.height - 110) / (lines.length * 1.12)), fitDisplay(s, lines, 820, size));
      const fadeIn = interpolate(frame, [0, 6], [0, 1], clamp);
      const out6 = interpolate(frame, [duration - 6, duration], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
      let marks = 0;
      return (
        <div style={{position: 'absolute', top: PAGE[s.broll]?.headlineTop ?? h.top, left: h.left, width: h.width, minWidth: h.width, height: h.height, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '14px 20px 18px', background: s.palette.surface, border: `2px solid ${s.palette.text}40`, opacity: fadeIn * (1 - out6), transform: `translateY(${-12 * out6}px)`}}>
          <Sfx at={2} name={s.sfx.headline} volume={0.14} />
          <div style={{fontFamily: plexMono(), fontWeight: 500, fontSize: 30, letterSpacing: '0.06em', textTransform: 'uppercase', color: s.palette.text, opacity: 0.7, paddingBottom: 6, borderBottom: `2px solid ${s.palette.text}59`, whiteSpace: 'nowrap'}}>MỤC · {kicker}</div>
          {lines.map((line, li) => {
            const at = 4 + li * 5;
            const k = interpolate(frame, [at, at + 10], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
            return (
              <div key={li} style={{marginTop: li === 0 ? 10 : 0, fontFamily: s.fonts.display, fontWeight: s.fonts.displayWeight, fontSize: fit, lineHeight: 1.12, color: s.palette.text, whiteSpace: 'pre', opacity: k, transform: `translateY(${(1 - k) * 16}px)`}}>
                {hiSegments(line, hiWords).reduce<{text: string; hi: boolean}[]>((acc, seg) => {
                  // hai từ khóa liền nhau (cách một dấu cách) gộp thành một nét để các vòng khoanh không chồng lên nhau
                  const prev = acc[acc.length - 1];
                  const before = acc[acc.length - 2];
                  if (seg.hi && prev && prev.text === ' ' && before?.hi) acc.splice(acc.length - 2, 2, {text: `${before.text} ${seg.text}`, hi: true});
                  else acc.push(seg);
                  return acc;
                }, []).map((seg, si) => {
                  if (!seg.hi || marks >= 2) return <React.Fragment key={si}>{seg.text}</React.Fragment>;
                  const m = marks++;
                  return seg.text.length <= 8
                    ? <MarkerCircle key={si} at={at + 10 + m * 6} color={s.palette.accent} seed={5 + m}>{seg.text}</MarkerCircle>
                    : <UnderlineMark key={si} at={at + 10 + m * 6} color={s.palette.accent}>{seg.text}</UnderlineMark>;
                })}
              </div>
            );
          })}
        </div>
      );
    }
    case 'bib': {
      // số áo thi đấu trong TRACK.bib: kicker trên dải tài trợ, câu chính display mực than, từ khóa có nét dạ quang quét dưới chữ (tối đa 2 nét);
      // vào rơi xuống 40 px + xoay −3°→0 + mờ→rõ, ghim bật lần lượt, dòng chữ lệch nhịp; ra nhanh lên trên; đứng lâu thì xoay ±0,6°
      const b = TRACK.bib;
      const lines = display.split('\n');
      const fit = Math.min(size, Math.floor((b.height - BIB_STRIP - 50) / (lines.length * 1.14)), fitDisplay(s, lines, 860, size));
      const sway = Math.sin(Math.max(0, frame - 60) / 30) * 0.6 * interpolate(frame, [60, 80], [0, 1], clamp);
      let marks = 0;
      return (
        <div style={{position: 'absolute', left: b.left, top: b.top, opacity: interpolate(enter, [0, 0.35], [0, 1], clamp) * exit, transform: `translateY(${interpolate(enter, [0, 1], [-40, 0]) - 36 * (1 - exit)}px) rotate(${interpolate(enter, [0, 1], [-3, 0]) + sway}deg)`}}>
          <Sfx at={3} name={s.sfx.headline} volume={0.14} />
          <BibShell s={s} kicker={kicker} width={b.width} height={b.height} pins={[0, 1, 2, 3].map((k) => spring({frame: frame - (5 + k * 3), fps, config: {damping: 9, stiffness: 240}}))}>
            <div style={{position: 'absolute', left: 40, right: 40, top: BIB_STRIP, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'}}>
              {lines.map((line, li) => {
                const lp = spring({frame: frame - (4 + li * 4), fps, config: {damping: 16, stiffness: 200}});
                return (
                  <div key={li} style={{fontFamily: s.fonts.display, fontWeight: s.fonts.displayWeight, fontSize: fit, lineHeight: 1.14, color: s.palette.textOnSurface, whiteSpace: 'pre', opacity: interpolate(lp, [0, 0.4], [0, 1], clamp), transform: `translateY(${interpolate(lp, [0, 1], [14, 0])}px)`}}>
                    {hiSegments(line, hiWords).map((seg, si) => {
                      if (!seg.hi || marks >= 2) return <React.Fragment key={si}>{seg.text}</React.Fragment>;
                      const m = marks++;
                      return <MarkerHighlight key={si} at={12 + m * 8} color={`${s.palette.accent}e6`} seed={4 + m}>{seg.text}</MarkerHighlight>;
                    })}
                  </div>
                );
              })}
            </div>
          </BibShell>
        </div>
      );
    }
    case 'splitflap': {
      // bảng giờ tàu lật chữ trong PLATFORM.board: kicker là số hiệu chuyến (nền accent), mỗi ký tự một ô lật tối có vạch giữa ô, từ khóa màu accent2;
      // vào: ô lật 2–3 ký tự ngẫu nhiên rồi dừng, lệch nhịp trái sang phải (≤ 14 khung), một tiếng cho cả câu; ra: lật xuống trong 6 khung
      const b = PLATFORM.board;
      let rows = display.split('\n');
      if (rows.length === 1 && rows[0].includes(' ') && flapWidth(flapChars(rows[0], hiWords), Math.min(size, 60)) > BOARD_TEXT_WIDTH) {
        const words = rows[0].split(' ');
        let best = 1;
        let gap = Infinity;
        for (let k = 1; k < words.length; k++) {
          const diff = Math.abs(words.slice(0, k).join(' ').length - words.slice(k).join(' ').length);
          if (diff < gap) {
            gap = diff;
            best = k;
          }
        }
        rows = [words.slice(0, best).join(' '), words.slice(best).join(' ')];
      }
      const rowChars = rows.map((r) => flapChars(r, hiWords));
      const maxH = b.height - 76 - 18;
      let fs = Math.min(size, 120);
      while (fs > 36 && (Math.max(...rowChars.map((c) => flapWidth(c, fs))) > BOARD_TEXT_WIDTH || rows.length * Math.round(fs * 1.35) + (rows.length - 1) * 5 > maxH)) fs -= 2;
      const total = rowChars.reduce((a, c) => a + c.length, 0);
      const flapExit = interpolate(frame, [duration - 6, duration], [1, 0], {...clamp, easing: Easing.in(Easing.quad)});
      let base = 0;
      return (
        <>
          <Sfx at={3} name={s.sfx.headline} volume={0.14} />
          <PlatformBoard s={s} style={{opacity: flapExit}}>
            <div style={{position: 'absolute', inset: 0, transform: `scaleY(${0.6 + 0.4 * flapExit})`, transformOrigin: 'top'}}>
              <div style={{position: 'absolute', left: BOARD_PAD, top: 16, background: s.palette.accent, color: s.palette.emphText, fontFamily: s.fonts.body, fontWeight: 800, fontSize: 30, lineHeight: 1.2, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '5px 16px 7px', whiteSpace: 'nowrap', opacity: interpolate(enter, [0, 0.4], [0, 1], clamp), transform: `translateX(${interpolate(enter, [0, 1], [-30, 0])}px)`}}>{kicker}</div>
              <div style={{position: 'absolute', left: BOARD_PAD, top: 76, display: 'flex', flexDirection: 'column', gap: 5}}>
                {rowChars.map((chars, ri) => {
                  const at = base;
                  base += chars.length;
                  return <FlapLine key={ri} chars={chars} fs={fs} s={s} color={s.palette.textOnSurface} hiColor={s.palette.accent2} frame={frame} anim={{at: 3, base: at, total}} />;
                })}
              </div>
            </div>
          </PlatformBoard>
        </>
      );
    }
    case 'kinetic': {
      // chữ khổng lồ trên nền đen phim, nhãn đỏ cắt chéo ở trên; chữ lớn dần nhẹ suốt thời gian hiện
      const top = PAGE[s.broll]?.headlineTop ?? 250;
      const push = interpolate(frame, [0, duration], [1, 1.05], clamp);
      return (
        <div style={{position: 'absolute', top, left: 56, right: 150, height: FILM.strip.top - top - 30, opacity: exit, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 14}}>
          <div style={{alignSelf: 'flex-start', fontFamily: s.fonts.body, fontWeight: 900, fontSize: 32, color: s.palette.chipText, background: s.palette.chipBg, padding: '6px 18px 8px', letterSpacing: '0.1em', textTransform: 'uppercase', transform: `skewX(-8deg) translateX(${interpolate(enter, [0, 1], [-200, 0])}px)`}}>{kicker}</div>
          <div style={{transform: `scale(${push})`, transformOrigin: 'left bottom'}}>{reveal(s.palette.text, {lineHeight: 1.0, rowGap: size * 0.06})}</div>
        </div>
      );
    }
    case 'kicker':
    default:
      return (
        <div style={wrap}>
          <div style={{display: 'flex', alignItems: 'center', gap: 18, opacity: enter, transform: `translateX(${interpolate(enter, [0, 1], [-30, 0])}px)`, fontFamily: s.fonts.body, fontWeight: 700, fontSize: 30, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.88)'}}>
            <div style={{width: interpolate(enter, [0, 1], [0, 56]), height: 4, background: s.palette.accent2, borderRadius: 2}} />
            {kicker}
          </div>
          {reveal(s.palette.text, {textShadow: s.transition === 'glitch' ? `0 0 24px ${s.palette.accent}88` : '0 4px 24px rgba(0,0,0,0.55)'})}
        </div>
      );
  }
};
