import {loadFont} from '@remotion/fonts';
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';

// Token lấy từ DESIGN.md của duhoc-hanquoc.edu.vn: đỏ chỉ dùng cho chỉ mảnh, không làm nền.
export const COLORS = {
  blue: '#1c75bc',
  blueDark: '#1561a0',
  blueDeep: '#0e4a7d',
  night: '#061a2e',
  tint: '#eef5fb',
  line: '#cfe2f3',
  red: '#ed1d24',
  ink: '#0f172a',
  inkSoft: '#334155',
  inkMuted: '#5b6b80',
  sky: '#8fd0ff',
  white: '#ffffff',
};

export const FONT = '"Be Vietnam Pro", system-ui, sans-serif';

export const SAFE = {
  top: 240,
  bottom: 420,
  side: 72,
};

const SUBSETS = {
  latin:
    'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  'latin-ext':
    'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF',
  vietnamese:
    'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB',
} as const;

const handle = delayRender('Nạp font Be Vietnam Pro');
Promise.all(
  [500, 600, 700, 800].flatMap((weight) =>
    (Object.keys(SUBSETS) as (keyof typeof SUBSETS)[]).map((subset) =>
      loadFont({
        family: 'Be Vietnam Pro',
        url: staticFile(`fonts/be-vietnam-pro-${weight}-${subset}.woff2`),
        weight: String(weight),
        unicodeRange: SUBSETS[subset],
      }),
    ),
  ),
)
  .then(() => continueRender(handle))
  .catch((err) => cancelRender(err));
