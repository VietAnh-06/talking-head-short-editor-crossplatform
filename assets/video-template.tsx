import React from 'react';
import edit from '../../talking/edits/__SLUG__.json';
import {BeatSpec, Headline} from '../../talking/broll';
import {createEditData, EditJson} from '../../talking/edit-data';
import {StyleId} from '../../talking/style';
import {TalkingShort} from '../../talking/talking-short';

export const __CONST__ = createEditData(edit as EditJson);
const {cue, findPhrase} = __CONST__;
const f = (phrase: string, after = 0) => Math.round((findPhrase(phrase, after) - 0.12) * 30);

// Nhịp hình neo theo cụm từ trong phụ đề (chữ thường, bỏ dấu câu). Mỗi cảnh B-roll: clip Mixkit đã tải,
// nhãn gọi tên cái đang thấy, tiếng hit/âm nền khớp hình. Thầy chỉ hiện ở câu hỏi, đầu ý và lời khuyên.
const BEATS: BeatSpec[] = [
  {atSec: 0, kind: 'talk'},
  // {at: 'cụm từ trong phụ đề', kind: 'broll', clip: 'mixkit-46626', label: 'Rửa bát', hit: 'plates', amb: 'sink-water'},
];

export const __COMPONENT__: React.FC<{style?: StyleId}> = ({style}) => (
  <TalkingShort
    style={style}
    data={__CONST__}
    beats={BEATS}
    // Khung bìa ở khung 0 (ảnh đại diện, references/motion-design.md §Khung bìa): tiêu đề nói đúng câu hook
    cover={{kicker: 'Nhãn ngắn', title: 'Dòng một\nTỪ KHÓA', hi: ['TỪ', 'KHÓA'], sub: 'Một câu tóm lời hứa của video'}}
    commentHeader={['Câu hỏi gửi', 'Tên người trả lời']}
    endCard={{lines: ['Dòng 1', 'ĐIỂM NHẤN?', 'Dòng 3'], ask: 'Câu hỏi kéo bình luận', logos: [], footer: ['Lời mời theo dõi', 'Liên hệ / ưu đãi']}}
  >
    {/* Tiêu đề từng phần, ví dụ:
    <Headline from={cue('chapter1')} to={f('cụm từ kết thúc')} kicker="Ý #1" text={"Dòng một\nTỪ KHÓA"} hi={['TỪ', 'KHÓA']} /> */}
  </TalkingShort>
);

// Ảnh bìa thiết kế riêng, không cắt từ video (references/motion-design.md §Poster bìa). Thêm `poster: __COMPONENT__Poster`
// vào dòng của video trong src/videos/registry.tsx rồi: npx remotion still src/index.ts <Id>Poster out/final/__SLUG__-cover.jpg
// export const __COMPONENT__Poster: React.FC<{style?: StyleId}> = ({style}) => (
//   <CoverPoster style={style ?? 'clean-explainer'} brandName="Tên kênh" kicker="Nhãn ngắn" series="Chuỗi #1"
//     title={'Dòng một\nTỪ KHÓA'} hi={['TỪ', 'KHÓA']} sub="Một câu tóm lời hứa" image="img/__SLUG__-poster.jpg" stamp={['Mốc', 'chi tiết']} />
// );
