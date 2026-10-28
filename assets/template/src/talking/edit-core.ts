import type library from './sfx-library.json';

// Phần thuần của dữ liệu edit (không phụ thuộc Remotion/React): trang phụ đề, khung có giọng, nhịp hình.
// Dùng chung cho bản dựng Remotion (edit-data.tsx, broll.tsx) và bản dựng Revideo (revideo/).

export type SfxName = keyof typeof library;

export const FPS = 30;
export const END_CARD_FRAMES = 110;

export type Clip = {section: string; piece: number; inFrame: number; outFrame: number; atFrame: number};
export type CaptionWord = {text: string; start: number; end: number; emph: boolean; sentenceStart: boolean};
export type CaptionPage = {words: CaptionWord[]; startFrame: number; endFrame: number};
export type EditJson = {
  slug: string;
  zoom: {tight?: string[]; wide?: string[]; push?: string[]};
  clips: Clip[];
  cues: Record<string, number>;
  captions: CaptionWord[];
};

export type EditCore = ReturnType<typeof createEditCore>;
export type FootageName = 'graded.mp4' | 'voice.wav' | 'edit-voice.wav' | 'last-frame.jpg';

export const createEditCore = (edit: EditJson) => {
  const last = edit.clips[edit.clips.length - 1];
  const speechFrames = last.atFrame + last.outFrame - last.inFrame;
  const words = edit.captions;
  const cue = (key: string) => {
    if (!(key in edit.cues)) throw new Error(`Thiếu mốc "${key}" trong edit ${edit.slug}`);
    return Math.round(edit.cues[key] * FPS);
  };
  // Cụm không được tách qua hai trang vì đổi nghĩa khi đọc rời ("tháng | 9 năm sau" đọc thành "chín năm sau"):
  // chữ dẫn + số (tháng 9, kỳ 111, cấp 3, TOPIK II), số + đơn vị (3 tháng, 15 phút), "năm" + sau/ngoái/nay
  const bare = (s: string) => s.toLowerCase().replace(/[.,?!:;]+$/, '');
  const isNum = (s: string) => /^[~≈]?[\d][\d.,/%–-]*$/.test(bare(s)) || /^(i|ii)$/.test(bare(s));
  const LEAD = new Set(['tháng', 'năm', 'kỳ', 'cấp', 'topik', 'ngày', 'lần', 'top']);
  const UNIT = new Set(['tháng', 'giờ', 'phút', 'tuần', 'ngày', 'nghìn', 'triệu', 'tỷ', 'won', 'đồng', 'chỗ', 'điểm', 'việc', 'lần', 'kỳ', 'người', 'tuổi', '%']);
  // từ ghép hai âm tiết hay gặp ở kênh giáo dục/du học: không ngắt giữa "đăng | ký", "Việt | Nam"
  const COMPOUND = new Set(
    ('đăng ký|việt nam|hàn quốc|hệ thống|khả năng|kết quả|thanh toán|thông tin|thông báo|chứng chỉ|học tiếng|nhập học|làm thêm|hồ sơ|' +
      'điểm thi|lệ phí|dự kiến|yêu cầu|chuẩn bị|tài khoản|ví dụ|cuối cùng|bổ sung|xin phép|du học|đại học|học bổng|chi phí|' +
      'sinh viên|học sinh|ngân hàng|tài chính|gia hạn|cư trú|visa d-2|visa d-4|phỏng vấn|bố mẹ|tiền nhà|ký túc|trung tâm|hạn cuối|' +
      'ngày thi|kỳ thi|đề thi|bài thi|phần viết|phần nghe|phần đọc|tiếp theo|năm nay|năm sau|năm ngoái|đúng hạn|thường nhận|' +
      'ảnh thẻ|thẻ thanh|kỳ tháng|thi topik|được cấp|lên cấp|một ví|ví dụ|nộp hồ|làm thêm|xin visa').split('|'),
  );
  const bound = (a: string, b: string) =>
    COMPOUND.has(`${bare(a)} ${bare(b)}`) || (LEAD.has(bare(a)) && isNum(b)) || (isNum(a) && UNIT.has(bare(b))) || (bare(a) === 'năm' && ['sau', 'ngoái', 'nay', 'trước'].includes(bare(b)));
  // Trang phụ đề: ghép cụm từ khóa thành một khối không tách được, rồi xếp tối đa 3 khối / 18 ký tự
  // mỗi trang; luôn ngắt ở đầu câu, sau dấu câu và khi nghỉ > 0.3 s.
  const buildPages = (): CaptionPage[] => {
    const units: CaptionWord[][] = [];
    words.forEach((w, i) => {
      const prev = words[i - 1];
      const open = prev && !w.sentenceStart && !/[.,?!:]$/.test(prev.text);
      const joins = open && ((prev.emph && w.emph) || bound(prev.text, w.text));
      if (joins) units[units.length - 1].push(w);
      else units.push([w]);
    });
    const text = (u: CaptionWord[]) => u.map((w) => w.text).join(' ');
    const pages: CaptionWord[][] = [];
    let cur: CaptionWord[][] = [];
    units.forEach((u, i) => {
      const prev = units[i - 1]?.[units[i - 1].length - 1];
      const len = cur.map(text).join(' ').length + 1 + text(u).length;
      const breakHere =
        cur.length > 0 &&
        (u[0].sentenceStart || cur.length >= 3 || len > 18 || /[.,?!:]$/.test(prev.text) || u[0].start - prev.end > 0.3);
      if (breakHere) {
        pages.push(cur.flat());
        cur = [];
      }
      cur.push(u);
    });
    if (cur.length) pages.push(cur.flat());
    // trang một chữ (đuôi câu "QUỐC.", "KÝ", "3,") đọc như chữ mồ côi: gộp vào trang trước nếu là đuôi câu,
    // không thì vào trang sau; giữ dưới 24 ký tự để không tràn khung
    const fits = (a: CaptionWord[], b: CaptionWord[]) => [...a, ...b].map((w) => w.text).join(' ').length <= 24;
    // trang chỉ là một cụm gắn liền ở cuối câu ("VÍ DỤ.", "CẤP 2.") cũng là mồ côi: gộp như trang một chữ
    const unitOf = (p: CaptionWord[]) => p.every((w, k) => k === 0 || bound(p[k - 1].text, w.text));
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      if (!(p.length === 1 || (p.length <= 3 && unitOf(p) && /[.?!]$/.test(p[p.length - 1].text))) || p.some((w) => w.emph)) continue;
      const prev = pages[i - 1];
      const next = pages[i + 1];
      if (prev && !p[0].sentenceStart && fits(prev, p) && p[0].start - prev[prev.length - 1].end < 0.6) {
        prev.push(...p);
        pages.splice(i--, 1);
      } else if (next && !next[0].sentenceStart && fits(p, next) && next[0].start - p[0].end < 0.6) {
        next.unshift(...p);
        pages.splice(i--, 1);
      }
    }
    return pages.map((ws, i) => {
      const next = pages[i + 1];
      const end = Math.min(ws[ws.length - 1].end + 0.35, next ? next[0].start : Infinity);
      return {words: ws, startFrame: Math.round(ws[0].start * FPS), endFrame: Math.round(end * FPS)};
    });
  };
  // Khung nào thầy đang nói (theo mốc từng từ của phụ đề): dùng để hạ SFX dưới giọng
  const voiced = new Uint8Array(speechFrames + 1);
  for (const w of words) {
    for (let f = Math.max(0, Math.floor((w.start - 0.04) * FPS)); f <= Math.min(speechFrames, Math.ceil((w.end + 0.06) * FPS)); f++) voiced[f] = 1;
  }
  return {
    slug: edit.slug,
    voiceAt: (frame: number) => frame >= 0 && frame <= speechFrames && voiced[frame] === 1,
    zoom: edit.zoom,
    clips: edit.clips,
    speechFrames,
    totalFrames: speechFrames + END_CARD_FRAMES,
    cue,
    pages: buildPages(),
    // Từ thuộc khoảng [fromSec, toSec): bắt cả từ bắt đầu sớm một chút, bỏ đuôi của câu trước
    // Mốc (giây) của cụm từ trong phụ đề, tìm từ afterSec: neo cảnh minh họa vào đúng lúc thầy nói tới
    findPhrase: (phrase: string, afterSec = 0) => {
      const norm = (t: string) => t.toLowerCase().replace(/[.,?!:]/g, '');
      const toks = phrase.split(' ').map(norm);
      for (let i = 0; i <= words.length - toks.length; i++) {
        if (words[i].start < afterSec - 0.01) continue;
        if (toks.every((t, k) => norm(words[i + k].text) === t)) return words[i].start;
      }
      throw new Error(`Không thấy "${phrase}" sau ${afterSec}s trong phụ đề ${edit.slug}`);
    },
    wordsBetween: (fromSec: number, toSec: number) => words.filter((w) => w.start >= fromSec - 0.35 && w.end > fromSec + 0.05 && w.start < toSec),
  };
};

// Một nhịp hình: thầy toàn khung ("talk") hoặc cảnh minh họa ("broll") neo vào cụm từ trong phụ đề
export type Beat =
  | {kind: 'talk'}
  | {
      kind: 'broll';
      clip: string; // tên file trong public/broll, không đuôi (mixkit-46626)
      label?: string; // nhãn trên thẻ hình: gọi tên cái đang thấy
      startSec?: number; // bắt đầu từ giây nào của clip
      focusX?: number; // tâm khung cắt ngang (%)
      hit?: SfxName | SfxName[]; // tiếng gắn với hình lúc cảnh bật (bát đĩa, đồng xu...)
      amb?: SfxName; // âm nền của cảnh
      ambVolume?: number;
      silent?: boolean; // tắt tiếng chuyển cảnh khi cảnh bật đúng phụ âm đầu câu (whoosh che chữ)
      // cắt thẳng sang cảnh người nói, không chuyển cảnh mờ/quét: footage dưới lớp B-roll lúc đó là đoạn chỉ có giọng
      // (máy quay chĩa nhầm chỗ) nên chuyển cảnh sẽ lộ nó ra (clip-12: 0,4 s mặt tường trước CTA)
      hardOut?: boolean;
      cut?: boolean; // vào bằng cắt thẳng từ cảnh trước, không chuyển cảnh, không tiếng chuyển cảnh
    };
export type BeatSpec = Beat & ({at: string; after?: number} | {atSec: number});
export type ResolvedBeat = Beat & {from: number; to: number};

export const resolveBeats = (data: EditCore, specs: BeatSpec[]): ResolvedBeat[] => {
  let cursor = 0;
  const starts = specs.map((spec) => {
    const sec = 'atSec' in spec ? spec.atSec : data.findPhrase(spec.at, spec.after ?? cursor) - 0.12;
    cursor = Math.max(cursor, sec + 0.05);
    return Math.max(0, Math.round(sec * FPS));
  });
  return specs.map((spec, i) => ({...spec, from: starts[i], to: starts[i + 1] ?? data.speechFrames}));
};

// Số khung của một lần chuyển cảnh
export const TRANSITION = 9;

export type BeatsApi = {
  beats: ResolvedBeat[];
  isBroll: (frame: number) => boolean;
  // Cảnh thầy cần hiện: khi đang là nhịp "talk", hoặc trong lúc chuyển cảnh giữa thầy và minh họa
  talkVisible: (frame: number) => boolean;
  beatAt: (frame: number) => ResolvedBeat | undefined;
};

export const createBeatsApi = (beats: ResolvedBeat[]): BeatsApi => {
  const beatAt = (frame: number) => beats.find((b) => frame >= b.from && frame < b.to);
  const isBroll = (frame: number) => beatAt(frame)?.kind === 'broll';
  const talkVisible = (frame: number) => {
    const i = beats.findIndex((b) => frame >= b.from && frame < b.to);
    if (i < 0 || beats[i].kind === 'talk') return true;
    const fromTalk = i > 0 && beats[i - 1].kind === 'talk' && frame < beats[i].from + TRANSITION;
    const cur = beats[i];
    const toTalk = beats[i + 1]?.kind === 'talk' && !(cur.kind === 'broll' && cur.hardOut) && frame >= cur.to - TRANSITION;
    return fromTalk || toTalk;
  };
  return {beats, beatAt, isBroll, talkVisible};
};
