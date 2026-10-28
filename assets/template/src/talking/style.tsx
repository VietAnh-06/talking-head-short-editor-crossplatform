import React, {createContext, useContext} from 'react';
import {loadFont as loadAnton} from '@remotion/google-fonts/Anton';
import {loadFont as loadArchivo} from '@remotion/google-fonts/Archivo';
import {loadFont as loadBaloo} from '@remotion/google-fonts/Baloo2';
import {loadFont as loadBarlow} from '@remotion/google-fonts/Barlow';
import {loadFont as loadAlfaSlab} from '@remotion/google-fonts/AlfaSlabOne';
import {loadFont as loadBitter} from '@remotion/google-fonts/Bitter';
import {loadFont as loadBigShoulders} from '@remotion/google-fonts/BigShoulders';
import {loadFont as loadBricolage} from '@remotion/google-fonts/BricolageGrotesque';
import {loadFont as loadPlexSans} from '@remotion/google-fonts/IBMPlexSans';
import {loadFont as loadLexend} from '@remotion/google-fonts/Lexend';
import {loadFont as loadMontserrat} from '@remotion/google-fonts/Montserrat';
import {loadFont as loadOswald} from '@remotion/google-fonts/Oswald';
import {loadFont as loadPlayfair} from '@remotion/google-fonts/PlayfairDisplay';
import {loadFont as loadSairaCondensed} from '@remotion/google-fonts/SairaCondensed';
import {loadFont as loadRobotoSlab} from '@remotion/google-fonts/RobotoSlab';
import {loadFont as loadMulish} from '@remotion/google-fonts/Mulish';
import {loadFont as loadManrope} from '@remotion/google-fonts/Manrope';
import {loadFont as loadNunito} from '@remotion/google-fonts/Nunito';
import {loadFont as loadInter} from '@remotion/google-fonts/Inter';
import {loadFont as loadMerriweather} from '@remotion/google-fonts/Merriweather';
import {loadFont as loadWorkSans} from '@remotion/google-fonts/WorkSans';
import {loadFont as loadBungee} from '@remotion/google-fonts/Bungee';
import {loadFont as loadKanit} from '@remotion/google-fonts/Kanit';
import {loadFont as loadPaytone} from '@remotion/google-fonts/PaytoneOne';
import {loadFont as loadQuicksand} from '@remotion/google-fonts/Quicksand';
import {loadFont as loadChakraPetch} from '@remotion/google-fonts/ChakraPetch';
import {loadFont as loadSignika} from '@remotion/google-fonts/Signika';
import {loadFont as loadExo2} from '@remotion/google-fonts/Exo2';
import {loadFont as loadSarabun} from '@remotion/google-fonts/Sarabun';
import {loadFont as loadUnbounded} from '@remotion/google-fonts/Unbounded';
import {loadFont as loadSpaceGrotesk} from '@remotion/google-fonts/SpaceGrotesk';
import {loadFont as loadRobotoCondensed} from '@remotion/google-fonts/RobotoCondensed';
import {loadFont as loadPublicSans} from '@remotion/google-fonts/PublicSans';
import {loadFont as loadAnybody} from '@remotion/google-fonts/Anybody';
import {loadFont as loadEpilogue} from '@remotion/google-fonts/Epilogue';
import {loadFont as loadFiraSansCondensed} from '@remotion/google-fonts/FiraSansCondensed';
import {loadFont as loadOverpass} from '@remotion/google-fonts/Overpass';
import {FONT as BE_VIETNAM} from '../theme';
import type {SfxName} from './sfx';

// Một "style" quyết định toàn bộ màu sắc của video: bảng màu, font, kiểu phụ đề, bố cục B-roll,
// chuyển cảnh, tiêu đề, tông màu, nhạc nền và bộ SFX. Đổi style là đổi cả "giọng" hình ảnh.
export type CaptionStyle = 'pill' | 'box' | 'bounce' | 'underline' | 'glow' | 'ink' | 'chat' | 'block' | 'typed';
export type BrollLayout = 'card' | 'fullbleed' | 'polaroid' | 'split' | 'ticket' | 'receipt' | 'omr' | 'envelope' | 'passbook' | 'phone' | 'film' | 'dossier' | 'storefront' | 'tray' | 'payslip' | 'console' | 'lightbox' | 'citation' | 'track' | 'platform';
export type TransitionStyle = 'zoomwhip' | 'flash' | 'slide' | 'soft' | 'glitch' | 'stripe' | 'tear' | 'bubble' | 'postmark' | 'print' | 'swipe' | 'advance' | 'clockwipe' | 'checker' | 'lightleak' | 'shutter' | 'crt' | 'backlight' | 'policeline' | 'photofinish' | 'screendoor';
export type HeadlineStyle = 'kicker' | 'boxed' | 'tape' | 'serif' | 'board' | 'ledger' | 'exam' | 'stamp' | 'entry' | 'notify' | 'kinetic' | 'seal' | 'timecard' | 'menuboard' | 'redpen' | 'dymo' | 'foldertab' | 'formfield' | 'bib' | 'splitflap';

export type StyleSpec = {
  id: StyleId;
  label: string;
  // displayEm: bề rộng trung bình một chữ hoa của font tiêu đề (em), để chữ to tự co vừa khung; mặc định 0,48 (font hẹp)
  fonts: {display: string; body: string; displayWeight: number; uppercaseDisplay: boolean; displayEm?: number};
  palette: {
    bg: string; // nền khi chiếu B-roll
    surface: string; // thẻ, hộp
    text: string;
    textOnSurface: string;
    accent: string; // từ khóa, nhãn
    accent2: string; // điểm nhấn phụ
    captionActive: string; // từ đang đọc
    emphBg: string; // nền cụm từ khóa đang đọc
    emphText: string;
    chipBg: string;
    chipText: string;
  };
  caption: CaptionStyle;
  broll: BrollLayout;
  transition: TransitionStyle;
  headline: HeadlineStyle;
  grade: {vignette: number; grain: number; tint: string}; // tint: lớp phủ màu toàn khung (rgba)
  music: string; // file trong public/audio
  sfx: {whip: SfxName[]; zoom: SfxName[]; pop: SfxName[]; headline: SfxName};
};

const STYLES = {
  'clean-explainer': {
    label: 'Explainer sạch, navy + vàng',
    fonts: {display: BE_VIETNAM, body: BE_VIETNAM, displayWeight: 900, uppercaseDisplay: false},
    palette: {
      bg: '#061a2e', surface: '#ffffff', text: '#ffffff', textOnSurface: '#0f172a', accent: '#FFD84D', accent2: '#ed1d24',
      captionActive: '#FFD84D', emphBg: '#1c75bc', emphText: '#ffffff', chipBg: '#FFD84D', chipText: '#0f172a',
    },
    caption: 'pill', broll: 'card', transition: 'zoomwhip', headline: 'kicker',
    grade: {vignette: 0, grain: 0.04, tint: 'rgba(0,0,0,0)'},
    music: 'music-bed.wav',
    sfx: {
      whip: ['whoosh-cinematic', 'swoosh-fast', 'sweep-air', 'whoosh-fast', 'sweep-small', 'swoosh-flying', 'sweep-fast', 'slide-tech'],
      zoom: ['zoom-impact', 'zoom-vacuum', 'swoosh-vacuum', 'impact-whoosh'],
      pop: ['pop-explainer', 'pop-dry', 'pop-bubble', 'pop-long', 'pop-hard', 'click-interface'],
      headline: 'bass-hit',
    },
  },
  'bold-news': {
    label: 'Bản tin mạnh, đen-trắng-đỏ',
    fonts: {display: '', body: '', displayWeight: 700, uppercaseDisplay: true},
    palette: {
      bg: '#0b0b0b', surface: '#ffffff', text: '#ffffff', textOnSurface: '#0b0b0b', accent: '#ff2d2d', accent2: '#ffffff',
      captionActive: '#ffffff', emphBg: '#ff2d2d', emphText: '#ffffff', chipBg: '#ff2d2d', chipText: '#ffffff',
    },
    caption: 'box', broll: 'fullbleed', transition: 'flash', headline: 'boxed',
    grade: {vignette: 0.25, grain: 0.03, tint: 'rgba(0,0,0,0.05)'},
    music: 'music-bed-news.wav',
    sfx: {
      whip: ['slide-tech', 'sweep-fast', 'swoosh-fast', 'sweep-small'],
      zoom: ['impact-whoosh', 'zoom-impact', 'bass-hit'],
      pop: ['click-interface', 'click-select', 'pop-hard'],
      headline: 'impact-deep',
    },
  },
  'warm-vlog': {
    label: 'Vlog ấm áp, kem + cam',
    fonts: {display: '', body: '', displayWeight: 800, uppercaseDisplay: false},
    palette: {
      bg: '#2b1a10', surface: '#fff6e8', text: '#ffffff', textOnSurface: '#3a2414', accent: '#ff9f43', accent2: '#ff6b6b',
      captionActive: '#ffd29a', emphBg: '#ff9f43', emphText: '#2b1a10', chipBg: '#ff6b6b', chipText: '#ffffff',
    },
    caption: 'bounce', broll: 'polaroid', transition: 'slide', headline: 'tape',
    grade: {vignette: 0.3, grain: 0.06, tint: 'rgba(255,170,90,0.07)'},
    music: 'music-bed-lofi.wav',
    sfx: {
      whip: ['sweep-air', 'swoosh-flying', 'sweep-small', 'whoosh-fast'],
      zoom: ['swoosh-vacuum', 'zoom-vacuum'],
      pop: ['pop-bubble', 'pop-cluster', 'pop-long', 'pop-explainer'],
      headline: 'pop-cluster',
    },
  },
  editorial: {
    label: 'Tạp chí, đen ngà + vàng gold',
    fonts: {display: '', body: '', displayWeight: 700, uppercaseDisplay: false},
    palette: {
      bg: '#111111', surface: '#f4efe6', text: '#f4efe6', textOnSurface: '#151515', accent: '#d4af37', accent2: '#f4efe6',
      captionActive: '#d4af37', emphBg: 'rgba(0,0,0,0)', emphText: '#d4af37', chipBg: '#f4efe6', chipText: '#151515',
    },
    caption: 'underline', broll: 'split', transition: 'soft', headline: 'serif',
    grade: {vignette: 0.4, grain: 0.05, tint: 'rgba(30,20,0,0.06)'},
    music: 'music-bed-piano.wav',
    sfx: {
      whip: ['sweep-air', 'swoosh-vacuum', 'sweep-small'],
      zoom: ['swoosh-vacuum', 'zoom-vacuum'],
      pop: ['click-select', 'page-turn', 'click-interface'],
      headline: 'page-turn',
    },
  },
  'tech-neon': {
    label: 'Công nghệ neon, cyan + hồng',
    fonts: {display: '', body: '', displayWeight: 800, uppercaseDisplay: true},
    palette: {
      bg: '#05040f', surface: '#0f0c24', text: '#eafcff', textOnSurface: '#eafcff', accent: '#22e4ff', accent2: '#ff3df2',
      captionActive: '#22e4ff', emphBg: '#ff3df2', emphText: '#ffffff', chipBg: '#22e4ff', chipText: '#05040f',
    },
    caption: 'glow', broll: 'card', transition: 'glitch', headline: 'kicker',
    grade: {vignette: 0.45, grain: 0.05, tint: 'rgba(60,0,120,0.08)'},
    music: 'music-bed-synth.wav',
    sfx: {
      whip: ['slide-tech', 'swoosh-fast', 'sweep-fast'],
      zoom: ['zoom-impact', 'bass-hit-future', 'impact-whoosh'],
      pop: ['click-interface', 'click-select', 'pop-hard', 'pop-dry'],
      headline: 'bass-hit-future',
    },
  },
  'seoul-pass': {
    label: 'Boarding pass du học Hàn, đỏ-xanh Thái Cực trên giấy ngà',
    fonts: {display: '', body: '', displayWeight: 800, uppercaseDisplay: true},
    palette: {
      bg: '#0e1420', surface: '#f6f1e7', text: '#ffffff', textOnSurface: '#111827', accent: '#ff5a64', accent2: '#2f7bff',
      captionActive: '#9cc8ff', emphBg: '#e8343f', emphText: '#ffffff', chipBg: '#2f7bff', chipText: '#ffffff',
    },
    caption: 'pill', broll: 'ticket', transition: 'stripe', headline: 'board',
    grade: {vignette: 0.22, grain: 0.03, tint: 'rgba(0,50,140,0.04)'},
    music: 'music-bed-kpop.wav',
    sfx: {
      whip: ['swoosh-flying', 'sweep-air', 'whoosh-fast', 'swoosh-fast', 'sweep-small'],
      zoom: ['zoom-impact', 'impact-whoosh', 'swoosh-vacuum'],
      pop: ['click-check', 'pop-dry', 'click-select', 'pop-explainer'],
      headline: 'slide-tech',
    },
  },
  'receipt-ledger': {
    label: 'Hóa đơn chi tiêu: giấy in nhiệt, mực đen, vàng cảnh báo, đỏ nợ, xanh lối ra',
    fonts: {display: '', body: '', displayWeight: 400, uppercaseDisplay: true},
    palette: {
      bg: '#17130e', surface: '#f4efe3', text: '#ffffff', textOnSurface: '#1a1714', accent: '#ffb300', accent2: '#22c55e',
      captionActive: '#ffb300', emphBg: '#e5322b', emphText: '#ffffff', chipBg: '#ffb300', chipText: '#1a1714',
    },
    caption: 'box', broll: 'receipt', transition: 'tear', headline: 'ledger',
    grade: {vignette: 0.32, grain: 0.05, tint: 'rgba(255,190,90,0.04)'},
    music: 'music-bed-ledger.wav',
    sfx: {
      whip: ['paper-slice', 'swoosh-fast', 'sweep-small', 'wind-swoosh', 'sweep-fast', 'page-turn'],
      zoom: ['impact-whoosh', 'zoom-impact'],
      pop: ['dot-print', 'click-select', 'atm-key', 'pop-dry'],
      headline: 'dot-print',
    },
  },
  'answer-sheet': {
    label: 'Phiếu trả lời trắc nghiệm: giấy hồng nhạt, mực chì, hồng sẫm ô tô, vàng chanh bút dạ quang',
    fonts: {display: '', body: '', displayWeight: 800, uppercaseDisplay: true},
    palette: {
      bg: '#1c1620', surface: '#fdf4f6', text: '#ffffff', textOnSurface: '#24212a', accent: '#e8f45a', accent2: '#d6336c',
      captionActive: '#e8f45a', emphBg: '#d6336c', emphText: '#ffffff', chipBg: '#e8f45a', chipText: '#24212a',
    },
    caption: 'pill', broll: 'omr', transition: 'bubble', headline: 'exam',
    grade: {vignette: 0.26, grain: 0.035, tint: 'rgba(214,51,108,0.035)'},
    music: 'music-bed-exam.wav',
    sfx: {
      whip: ['pencil', 'swoosh-fast', 'page-turn', 'sweep-small', 'sweep-air'],
      zoom: ['zoom-impact', 'impact-whoosh'],
      pop: ['click-check', 'pop-dry', 'click-select', 'pop-explainer'],
      headline: 'pencil',
    },
  },
  airmail: {
    label: 'Thư máy bay: giấy kraft, mực xanh bưu điện, đỏ dấu, viền sọc đỏ–xanh, vàng nhãn dán',
    fonts: {display: '', body: '', displayWeight: 400, uppercaseDisplay: true, displayEm: 0.7},
    palette: {
      bg: '#13233f', surface: '#f4ead6', text: '#ffffff', textOnSurface: '#1d3461', accent: '#ffc93c', accent2: '#c8102e',
      captionActive: '#ffc93c', emphBg: '#c8102e', emphText: '#ffffff', chipBg: '#1d3461', chipText: '#f4ead6',
    },
    caption: 'underline', broll: 'envelope', transition: 'postmark', headline: 'stamp',
    grade: {vignette: 0.22, grain: 0.04, tint: 'rgba(200,150,80,0.04)'},
    music: 'music-bed-airmail.wav',
    sfx: {
      whip: ['paper-slice', 'swoosh-flying', 'page-turn', 'sweep-air', 'wind-swoosh'],
      zoom: ['impact-whoosh', 'zoom-impact'],
      pop: ['pot-lid', 'click-check', 'pop-dry', 'typewriter-bell'],
      headline: 'factory-hit',
    },
  },
  passbook: {
    label: 'Sổ tiết kiệm: trang giấy kem kẻ dòng, mực xanh lá ngân hàng, vàng dạ quang, đỏ dấu; B-roll dải ngang tràn bề rộng ở trên, phụ đề mực tối giữa trang, tiêu đề là dòng giao dịch',
    fonts: {display: '', body: '', displayWeight: 800, uppercaseDisplay: false, displayEm: 0.52},
    palette: {
      bg: '#f4efe2', surface: '#fffdf6', text: '#1b2b26', textOnSurface: '#1b2b26', accent: '#c0392b', accent2: '#1f5c45',
      captionActive: '#1f5c45', emphBg: '#f6d55c', emphText: '#1b2b26', chipBg: '#1f5c45', chipText: '#f4efe2',
    },
    caption: 'ink', broll: 'passbook', transition: 'print', headline: 'entry',
    grade: {vignette: 0, grain: 0.025, tint: 'rgba(0,0,0,0)'},
    music: 'music-bed-passbook.wav',
    sfx: {
      whip: ['page-turn', 'paper-slice', 'sweep-small'],
      zoom: ['swoosh-vacuum'],
      pop: ['dot-print', 'atm-key', 'click-check', 'typewriter-bell'],
      headline: 'dot-print',
    },
  },
  phone: {
    label: 'App ngân hàng: nền xám xanh của app, thẻ trắng bo tròn, xanh dương nút bấm, xanh lá tiền vào, đỏ hồng tiền thiếu; B-roll là bài đăng trong app, phụ đề là bong bóng chat, tiêu đề là thông báo đẩy',
    fonts: {display: '', body: '', displayWeight: 800, uppercaseDisplay: false, displayEm: 0.56},
    palette: {
      bg: '#eef3fb', surface: '#ffffff', text: '#0f1c3f', textOnSurface: '#0f1c3f', accent: '#1d4ed8', accent2: '#16a34a',
      captionActive: '#1d4ed8', emphBg: '#1d4ed8', emphText: '#ffffff', chipBg: '#e0e9ff', chipText: '#1d4ed8',
    },
    caption: 'chat', broll: 'phone', transition: 'swipe', headline: 'notify',
    grade: {vignette: 0, grain: 0, tint: 'rgba(0,0,0,0)'},
    music: 'music-bed-app.wav',
    sfx: {
      whip: ['swoosh-fast', 'slide-tech', 'sweep-fast'],
      zoom: ['zoom-impact'],
      pop: ['coin-notify', 'click-interface', 'confirm', 'pop-bubble'],
      headline: 'coin-notify',
    },
  },
  film: {
    label: 'Dải phim điều tra: nền đen hạt phim, dải phim 35 mm có lỗ răng cưa chạy ngang giữa khung, chữ động khổng lồ vàng-trắng, đỏ cảnh báo',
    fonts: {display: '', body: '', displayWeight: 700, uppercaseDisplay: true, displayEm: 0.5},
    palette: {
      bg: '#111111', surface: '#f2e8cf', text: '#ffffff', textOnSurface: '#111111', accent: '#ffd400', accent2: '#ff3b30',
      captionActive: '#ffd400', emphBg: '#ffd400', emphText: '#111111', chipBg: '#f2e8cf', chipText: '#111111',
    },
    caption: 'block', broll: 'film', transition: 'advance', headline: 'kinetic',
    grade: {vignette: 0.35, grain: 0.08, tint: 'rgba(255,200,120,0.05)'},
    music: 'music-bed-noir.wav',
    sfx: {
      whip: ['whoosh-cinematic', 'swoosh-vacuum', 'sweep-air'],
      zoom: ['impact-trailer', 'impact-big'],
      pop: ['clock-tick', 'click-select', 'pop-hard'],
      headline: 'bass-hit-future',
    },
  },
  'ho-so': {
    label: 'Bìa hồ sơ visa: nền bìa giấy kraft, tờ hồ sơ kem, mực xanh đánh máy, đỏ con dấu; B-roll là ảnh kẹp ghim ở nửa dưới tờ hồ sơ, phụ đề đánh máy giữa trang, tiêu đề đóng dấu',
    fonts: {display: '', body: '', displayWeight: 900, uppercaseDisplay: false, displayEm: 0.6},
    palette: {
      bg: '#b98a52', surface: '#fbf6ea', text: '#1c2541', textOnSurface: '#1c2541', accent: '#c62828', accent2: '#1f5f8b',
      captionActive: '#c62828', emphBg: '#fde68a', emphText: '#1c2541', chipBg: '#c62828', chipText: '#fbf6ea',
    },
    caption: 'typed', broll: 'dossier', transition: 'slide', headline: 'seal',
    grade: {vignette: 0.12, grain: 0.03, tint: 'rgba(120,80,30,0.03)'},
    music: 'music-bed-piano.wav',
    sfx: {
      whip: ['paper-slice', 'page-turn', 'sweep-small'],
      zoom: ['swoosh-vacuum'],
      pop: ['click-check', 'pencil', 'typewriter-bell'],
      headline: 'pot-lid',
    },
  },
  'alba-night': {
    label: 'Ca làm thêm buổi tối: mặt tiền cửa hàng ban đêm, mái hiên sọc xanh bạc hà–kem, chữ biển hiệu vàng hổ phách; B-roll là ô kính cửa hàng tràn bề ngang y 310–1310, nhãn là tờ "tuyển làm thêm" có tua xé dán trên kính, tiêu đề là thẻ chấm công, chuyển cảnh cửa cuốn kéo lên',
    fonts: {display: '', body: '', displayWeight: 400, uppercaseDisplay: true, displayEm: 0.62},
    palette: {
      bg: '#0e1626', surface: '#fff6e3', text: '#fff6e3', textOnSurface: '#1b2233', accent: '#ffb627', accent2: '#2ec4a6',
      captionActive: '#ffb627', emphBg: '#ff5d73', emphText: '#ffffff', chipBg: '#2ec4a6', chipText: '#0e1626',
    },
    caption: 'glow', broll: 'storefront', transition: 'shutter', headline: 'timecard',
    grade: {vignette: 0.22, grain: 0.035, tint: 'rgba(255,170,60,0.03)'},
    music: 'music-bed-nightshift.wav',
    sfx: {
      whip: ['sweep-small', 'swoosh-fast', 'sweep-air'],
      zoom: ['swoosh-vacuum'],
      pop: ['click-select', 'pop-dry', 'click-check'],
      headline: 'confirm',
    },
  },
  sikpan: {
    label: 'Bữa ăn ở Hàn: khay cơm inox căng tin (식판) trên bàn gỗ sáng; B-roll nằm trong ngăn lớn của khay y 90–1070 (46 %), nhãn là phiếu ăn 식권 có mép răng cưa, tiêu đề là bảng menu gỗ có chấm dẫn tới giá, chuyển cảnh ô bàn cờ',
    fonts: {display: '', body: '', displayWeight: 400, uppercaseDisplay: false, displayEm: 0.56},
    palette: {
      bg: '#cfd5db', surface: '#fffaf0', text: '#22262b', textOnSurface: '#22262b', accent: '#e2412b', accent2: '#f2b632',
      captionActive: '#e2412b', emphBg: '#e2412b', emphText: '#fffaf0', chipBg: '#22262b', chipText: '#fffaf0',
    },
    caption: 'bounce', broll: 'tray', transition: 'checker', headline: 'menuboard',
    grade: {vignette: 0.06, grain: 0.025, tint: 'rgba(255,200,140,0.025)'},
    music: 'music-bed-sikdang.wav',
    sfx: {
      whip: ['sweep-small', 'swoosh-fast', 'sweep-air'],
      zoom: ['swoosh-vacuum'],
      pop: ['plates', 'click-select', 'pop-bubble'],
      headline: 'pot-lid',
    },
  },
  myeongse: {
    label: 'Phiếu lương Hàn (급여명세서) bị kiểm lại bằng bút đỏ: tờ phiếu giấy sáng trên mặt bàn văn phòng xám lục; B-roll là ô chi tiết giữa trên tờ (45 %), nhãn là dòng mục phiếu lương, tiêu đề là thẻ giấy có nét bút đỏ khoanh, chuyển cảnh kim đồng hồ quét',
    fonts: {display: '', body: '', displayWeight: 700, uppercaseDisplay: false, displayEm: 0.58},
    palette: {
      bg: '#2e3833', surface: '#fbfaf5', text: '#1f2522', textOnSurface: '#1f2522', accent: '#d7262e', accent2: '#1f5c4a',
      captionActive: '#d7262e', emphBg: '#ffe27a', emphText: '#1f2522', chipBg: '#efe9d8', chipText: '#1f2522',
    },
    caption: 'ink', broll: 'payslip', transition: 'clockwipe', headline: 'redpen',
    grade: {vignette: 0.1, grain: 0.03, tint: 'rgba(0,0,0,0)'},
    music: 'music-bed-myeongse.wav',
    sfx: {
      whip: ['paper-slice', 'sweep-small', 'swoosh-fast'],
      zoom: ['swoosh-vacuum'],
      pop: ['click-check', 'pencil', 'paper-slice'],
      headline: 'pencil',
    },
  },
  suseup: {
    label: 'Tủ điều khiển thép tối (수습 = thử việc): dải ba công tắc ở trên, màn hình giám sát có bezel đen ở nửa dưới (45 %) hiện B-roll, nhãn là băng Dymo vàng dập nổi dán góc màn hình, tiêu đề là băng Dymo trong dải công tắc, chuyển cảnh CRT tắt thành vạch sáng rồi bung ra',
    fonts: {display: '', body: '', displayWeight: 800, uppercaseDisplay: false, displayEm: 0.56},
    palette: {
      bg: '#15191c', surface: '#262d32', text: '#e8ecee', textOnSurface: '#e8ecee', accent: '#ff5a2e', accent2: '#35d07f',
      captionActive: '#ffd23f', emphBg: '#ff5a2e', emphText: '#15191c', chipBg: '#ffd23f', chipText: '#15191c',
    },
    caption: 'box', broll: 'console', transition: 'crt', headline: 'dymo',
    grade: {vignette: 0.12, grain: 0.03, tint: 'rgba(0,0,0,0)'},
    music: 'music-bed-suseup.wav',
    sfx: {
      whip: ['slide-tech', 'sweep-small', 'swoosh-fast'],
      zoom: ['swoosh-vacuum'],
      pop: ['click-select', 'atm-key', 'slide-tech'],
      headline: 'atm-key',
    },
  },
  simsa: {
    label: 'Bàn thẩm định hồ sơ có hộp đèn soi (심사 = thẩm định): thảm cắt xanh rêu kẻ ô, hộp đèn trắng ấm viền nhôm ở giữa (46 %) hiện B-roll, nhãn là thẻ phim vàng dán góc ô, tiêu đề là bìa hồ sơ kraft nhô tai, chuyển cảnh đèn nền chớp trắng rồi hiện ảnh mới',
    fonts: {display: '', body: '', displayWeight: 700, uppercaseDisplay: false, displayEm: 0.74},
    palette: {
      bg: '#1f5a45', surface: '#f7f6ef', text: '#f4f7f2', textOnSurface: '#17241f', accent: '#ff2e88', accent2: '#ffe14d',
      captionActive: '#ffe14d', emphBg: '#ff2e88', emphText: '#ffffff', chipBg: '#ffe14d', chipText: '#17241f',
    },
    caption: 'underline', broll: 'lightbox', transition: 'backlight', headline: 'foldertab',
    grade: {vignette: 0.1, grain: 0.03, tint: 'rgba(0,0,0,0)'},
    music: 'music-bed-simsa.wav',
    sfx: {
      whip: ['sweep-air', 'paper-slice', 'swoosh-fast'],
      zoom: ['zoom-vacuum'],
      pop: ['click-interface', 'page-turn', 'pencil'],
      headline: 'page-turn',
    },
  },
  danso: {
    label: 'Biên bản xử phạt tại hiện trường (단속 = truy quét): ảnh hiện trường tràn mép trên (47 %) với mép dưới xé răng cưa, tờ biên bản giấy than vàng nhạt dòng kẻ in sẵn ở dưới, nhãn là thẻ vật chứng vàng, tiêu đề là ô điền biểu mẫu có dấu khoanh đỏ, chuyển cảnh dải băng cảnh sát quét chéo',
    fonts: {display: '', body: '', displayWeight: 800, uppercaseDisplay: false, displayEm: 0.5},
    palette: {
      bg: '#efe6c4', surface: '#fbf7e9', text: '#1d2733', textOnSurface: '#1d2733', accent: '#d62828', accent2: '#1f4e9c',
      // phụ đề 'typed' tô nền từ khóa bằng emphBg và tô chữ đang đọc bằng captionActive: emphBg đỏ thì chữ đỏ biến mất trên nền đỏ
      captionActive: '#d62828', emphBg: '#ffd400', emphText: '#111111', chipBg: '#ffd400', chipText: '#111111',
    },
    caption: 'typed', broll: 'citation', transition: 'policeline', headline: 'formfield',
    grade: {vignette: 0.1, grain: 0.02, tint: 'rgba(0,0,0,0)'},
    music: 'music-bed-danso.wav',
    sfx: {
      whip: ['whoosh-fast', 'sweep-fast', 'impact-whoosh'],
      zoom: ['zoom-impact'],
      pop: ['pop-hard', 'click-check', 'dot-print'],
      headline: 'typing',
    },
  },
  yeokjeon: {
    label: 'Đường chạy điền kinh (역전 = vượt lên): mặt tartan đỏ cam có vạch làn trắng, số áo thi đấu ghim bốn góc cho tiêu đề, dải ảnh tràn bề ngang giữa trang (49 %) với vạch đích ca-rô ở mép trên, nhãn là cột đánh dấu làn, chuyển cảnh ảnh chụp đích (vạch quét trắng kèm vệt)',
    fonts: {display: '', body: '', displayWeight: 800, uppercaseDisplay: false, displayEm: 0.62},
    palette: {
      bg: '#c8472b', surface: '#fffaf0', text: '#ffffff', textOnSurface: '#14213d', accent: '#ffd60a', accent2: '#3a86ff',
      captionActive: '#ffd60a', emphBg: '#14213d', emphText: '#ffd60a', chipBg: '#ffd60a', chipText: '#14213d',
    },
    caption: 'pill', broll: 'track', transition: 'photofinish', headline: 'bib',
    grade: {vignette: 0.08, grain: 0.02, tint: 'rgba(0,0,0,0)'},
    music: 'music-bed-yeokjeon.wav',
    sfx: {
      whip: ['whoosh-fast', 'sweep-fast', 'swoosh-flying'],
      zoom: ['zoom-impact'],
      pop: ['pop-dry', 'click-check', 'pop-explainer'],
      headline: 'pop-hard',
    },
  },
  hwanseung: {
    label: 'Sân ga tàu điện ngầm Seoul (환승 = đổi tuyến): tường gạch men trắng với dải tuyến xanh, ô ảnh lớn sau cửa kính chắn tàu khung inox (45 %), bảng giờ tàu than lật chữ ở dưới, chuyển cảnh hai cánh cửa kính khép rồi mở',
    fonts: {display: '', body: '', displayWeight: 800, uppercaseDisplay: false, displayEm: 0.5},
    palette: {
      bg: '#eef0ec', surface: '#22262b', text: '#1b1f24', textOnSurface: '#f3f1e7', accent: '#00a84d', accent2: '#ffb81c',
      captionActive: '#00a84d', emphBg: '#00a84d', emphText: '#ffffff', chipBg: '#ffd23a', chipText: '#1b1f24',
    },
    caption: 'block', broll: 'platform', transition: 'screendoor', headline: 'splitflap',
    grade: {vignette: 0.08, grain: 0.02, tint: 'rgba(0,0,0,0)'},
    music: 'music-bed-hwanseung.wav',
    sfx: {
      whip: ['swoosh-flying', 'wind-swoosh', 'whoosh-cinematic'],
      zoom: ['bass-hit-future'],
      pop: ['click-check', 'confirm', 'pop-dry'],
      headline: 'dot-print',
    },
  },
} satisfies Record<string, Omit<StyleSpec, 'id'>>;

export type StyleId = keyof typeof STYLES;
export const STYLE_IDS = Object.keys(STYLES) as StyleId[];

// Font Google có subset tiếng Việt; chỉ nạp font của style đang dùng
const FONT_LOADERS: Record<StyleId, () => {display: string; body: string}> = {
  'clean-explainer': () => ({display: BE_VIETNAM, body: BE_VIETNAM}),
  'bold-news': () => ({
    display: loadOswald('normal', {weights: ['500', '700'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
    body: loadMontserrat('normal', {weights: ['700', '800', '900'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
  }),
  'warm-vlog': () => {
    const f = loadBaloo('normal', {weights: ['600', '700', '800'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily;
    return {display: f, body: f};
  },
  editorial: () => ({
    display: loadPlayfair('normal', {weights: ['700', '900'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
    body: loadLexend('normal', {weights: ['500', '700', '800'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
  }),
  'tech-neon': () => ({
    display: loadBricolage('normal', {weights: ['700', '800'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
    body: loadLexend('normal', {weights: ['600', '700', '800'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
  }),
  'seoul-pass': () => ({
    display: loadBigShoulders('normal', {weights: ['700', '800', '900'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
    body: loadArchivo('normal', {weights: ['600', '700', '800'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
  }),
  'receipt-ledger': () => ({
    display: loadAnton('normal', {weights: ['400'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
    body: loadBarlow('normal', {weights: ['600', '700', '800'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
  }),
  'answer-sheet': () => ({
    display: loadSairaCondensed('normal', {weights: ['700', '800'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
    body: loadPlexSans('normal', {weights: ['600', '700'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
  }),
  passbook: () => ({
    display: loadRobotoSlab('normal', {weights: ['700', '800'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
    body: loadMulish('normal', {weights: ['600', '700', '800', '900'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
  }),
  phone: () => ({
    display: loadManrope('normal', {weights: ['700', '800'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
    body: loadNunito('normal', {weights: ['600', '700', '800', '900'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
  }),
  film: () => ({
    display: loadOswald('normal', {weights: ['500', '700'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
    body: loadInter('normal', {weights: ['600', '700', '800', '900'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
  }),
  'ho-so': () => ({
    display: loadMerriweather('normal', {weights: ['700', '900'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
    body: loadWorkSans('normal', {weights: ['600', '700', '800', '900'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
  }),
  'alba-night': () => ({
    display: loadBungee('normal', {weights: ['400'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
    body: loadKanit('normal', {weights: ['500', '600', '700', '800'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
  }),
  sikpan: () => ({
    display: loadPaytone('normal', {weights: ['400'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
    body: loadQuicksand('normal', {weights: ['600', '700'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
  }),
  myeongse: () => ({
    display: loadChakraPetch('normal', {weights: ['700'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
    body: loadSignika('normal', {weights: ['400', '600'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
  }),
  suseup: () => ({
    display: loadExo2('normal', {weights: ['800'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
    body: loadSarabun('normal', {weights: ['400', '600', '700'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
  }),
  simsa: () => ({
    display: loadUnbounded('normal', {weights: ['700'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
    body: loadSpaceGrotesk('normal', {weights: ['500', '700'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
  }),
  danso: () => ({
    display: loadRobotoCondensed('normal', {weights: ['800'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
    body: loadPublicSans('normal', {weights: ['500', '700'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
  }),
  yeokjeon: () => ({
    display: loadAnybody('normal', {weights: ['800'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
    body: loadEpilogue('normal', {weights: ['500', '700'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
  }),
  hwanseung: () => ({
    display: loadFiraSansCondensed('normal', {weights: ['800'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
    body: loadOverpass('normal', {weights: ['600', '800'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
  }),
  airmail: () => ({
    display: loadAlfaSlab('normal', {weights: ['400'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
    body: loadBitter('normal', {weights: ['600', '700', '800'], subsets: ['latin', 'latin-ext', 'vietnamese']}).fontFamily,
  }),
};

// Bố cục toàn trang: vị trí phụ đề và tiêu đề khác hẳn bộ khung "nền mờ + thẻ giữa + phụ đề dưới" của các style cũ
export const PAGE: Partial<Record<BrollLayout, {captionTop: number; headlineTop: number; light: boolean; endTop?: number}>> = {
  passbook: {captionTop: 880, headlineTop: 1120, light: true},
  phone: {captionTop: 1040, headlineTop: 140, light: true},
  film: {captionTop: 1300, headlineTop: 250, light: false},
  dossier: {captionTop: 700, headlineTop: 230, light: true},
  storefront: {captionTop: 1372, headlineTop: 336, light: false},
  tray: {captionTop: 1440, headlineTop: 1122, light: true},
  payslip: {captionTop: 1436, headlineTop: 1140, light: true},
  console: {captionTop: 1452, headlineTop: 96, light: false, endTop: 560},
  lightbox: {captionTop: 1380, headlineTop: 96, light: false, endTop: 520},
  citation: {captionTop: 1400, headlineTop: 950, light: true, endTop: 980},
  track: {captionTop: 1520, headlineTop: 96, light: false, endTop: 600},
  platform: {captionTop: 1440, headlineTop: 1120, light: true, endTop: 300},
};

// Cỡ chữ (px) để dòng dài nhất vừa bề rộng width, không vượt cap
export const fitDisplay = (s: StyleSpec, lines: string[], width: number, cap: number) =>
  Math.min(cap, Math.floor(width / (Math.max(6, ...lines.map((l) => l.length)) * (s.fonts.displayEm ?? 0.48))));

const cache = new Map<StyleId, StyleSpec>();
export const getStyle = (id: StyleId): StyleSpec => {
  const hit = cache.get(id);
  if (hit) return hit;
  const base = STYLES[id];
  const fonts = FONT_LOADERS[id]();
  const spec: StyleSpec = {id, ...base, fonts: {...base.fonts, display: fonts.display, body: fonts.body}};
  cache.set(id, spec);
  return spec;
};

const StyleContext = createContext<StyleSpec | null>(null);

export const StyleProvider: React.FC<{id: StyleId; children: React.ReactNode}> = ({id, children}) => (
  <StyleContext.Provider value={getStyle(id)}>{children}</StyleContext.Provider>
);

export const useStyle = () => {
  const s = useContext(StyleContext);
  if (!s) throw new Error('useStyle phải nằm trong StyleProvider');
  return s;
};
