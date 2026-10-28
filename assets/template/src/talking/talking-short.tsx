import React from 'react';
import {AbsoluteFill, getInputProps, interpolate, Sequence, staticFile} from 'remotion';
import {Audio} from '@remotion/media';
import {Grain} from '../components/cinematic';
import {BeatSpec, BeatsProvider, BrollLayer, PageBackdrop, resolveBeats, SPLIT, useBeats} from './broll';
import {EditData, EditProvider, END_CARD_FRAMES} from './edit-data';
import {EndCard} from './end-card';
import {FootageTrack, VoiceTrack} from './footage-track';
import {CommentCard} from './overlays-common';
import {CoverCard, CoverSpec} from './cover';
import {ViralCaptions} from './viral-captions';
import {getStyle, PAGE, StyleId, StyleProvider, useStyle} from './style';
import {useCurrentFrame} from 'remotion';

type Props = {
  data: EditData;
  commentHeader: [string, string];
  endCard: React.ComponentProps<typeof EndCard>;
  // Nhịp hình: thầy toàn khung hay cảnh minh họa, neo theo cụm từ trong phụ đề
  beats: BeatSpec[];
  // Style hình ảnh (src/talking/style.tsx): mỗi video nên chọn một style khác video trước
  style?: StyleId;
  // Đồ họa riêng của từng video (vẽ dưới lớp phụ đề)
  children?: React.ReactNode;
  // Khung bìa ở khung 0 (ảnh đại diện): nên có cho mọi video, nhất là bản giọng máy mở bằng B-roll trên nền tối
  cover?: CoverSpec;
};

// Khung chung cho short talking head: footage đã cắt + grade, đồ họa, phụ đề viral, màn kết, nhạc
export const TalkingShort: React.FC<Props> = ({data, commentHeader, endCard, beats, style = 'clean-explainer', children, cover}) => {
  const st = getStyle(style);
  const {speechFrames, totalFrames} = data;
  // Kiểm mức SFX: --props='{"stem":"sfx"}' tắt giọng và nhạc, chỉ còn SFX + âm nền
  const sfxOnly = (getInputProps() as {stem?: string}).stem === 'sfx';
  // QA che mặt: --props='{"qa":"bare"}' chỉ còn footage người nói + màu (ẩn B-roll, tiêu đề, đồ họa, phụ đề, thẻ, màn kết):
  // khung B-roll ra đen nên face-check chỉ dò mặt người nói, không dò người trong B-roll
  const bare = (getInputProps() as {qa?: string}).qa === 'bare';
  // Nhạc nền rất nhỏ dưới lời thầy, lên to ở màn kết; lặp vì file nhạc 60 s ngắn hơn video 80 s (canh-009 mất nhạc màn kết). 0,55 ở màn kết: 0,3 cũ làm màn kết thấp hơn phần thoại ~10 LU
  // (clip-12: −24,2 so với −13,9 LUFS), nghe như tiếng sụt; verify-final.py cảnh báo khi lệch > 8 LU
  // Audio có loop gọi volume theo khung trong vòng lặp, nên tính theo khung tuyệt đối của video
  const now = useCurrentFrame();
  const musicVolume = (f: number) =>
    interpolate(f, [0, speechFrames - 10, speechFrames + 6, totalFrames - 25, totalFrames], [0.07, 0.07, 0.55, 0.55, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  return (
    <EditProvider data={data}>
      <StyleProvider id={style}>
      <BeatsProvider beats={resolveBeats(data, beats)}>
      <AbsoluteFill style={{backgroundColor: '#000'}}>
        <FootageTrack />
        <AbsoluteFill style={{background: 'radial-gradient(ellipse 90% 75% at 50% 45%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.35) 100%)'}} />
        <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.25) 22%, rgba(0,0,0,0) 34%, rgba(0,0,0,0) 58%, rgba(0,0,0,0.35) 80%, rgba(0,0,0,0) 100%)'}} />
        {PAGE[st.broll] && !bare ? <PageBackdrop /> : null}
        {bare ? null : <BrollLayer />}
        {st.broll === 'split' && !bare ? <SplitPanel /> : null}
        {bare ? null : (
          <>
            <CommentCard header={commentHeader} />
            {children}
            <CaptionsForLayout />
            <Sequence from={speechFrames} durationInFrames={END_CARD_FRAMES}>
              <EndCard {...endCard} />
            </Sequence>
            {cover ? <CoverCard {...cover} /> : null}
          </>
        )}
        <AbsoluteFill style={{background: st.grade.tint, pointerEvents: 'none'}} />
        <AbsoluteFill style={{background: `radial-gradient(ellipse 85% 70% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,${st.grade.vignette}) 100%)`, pointerEvents: 'none'}} />
        <Grain opacity={st.grade.grain} />
        {sfxOnly ? null : <VoiceTrack />}
        {sfxOnly ? null : <Audio src={staticFile(`audio/${st.music}`)} volume={() => musicVolume(now)} loop />}
      </AbsoluteFill>
      </BeatsProvider>
      </StyleProvider>
    </EditProvider>
  );
};

// Bố cục chia đôi: khi chiếu B-roll, thầy hiện ở bảng dưới, cắt quanh khuôn mặt
const SplitPanel: React.FC = () => {
  const frame = useCurrentFrame();
  const {isBroll} = useBeats();
  if (!isBroll(frame)) return null;
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: SPLIT.seam + 3, bottom: 0, overflow: 'hidden'}}>
      <FootageTrack panel />
      {/* dải tối ở đường nối để phụ đề đọc được trên nền tường sáng */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 260, background: 'linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.45) 60%, rgba(0,0,0,0) 100%)'}} />
    </div>
  );
};

// Phụ đề ở đường nối khi chia đôi (tránh che mặt thầy), còn lại ở dưới thẻ hình
const CaptionsForLayout: React.FC = () => {
  const frame = useCurrentFrame();
  const {isBroll} = useBeats();
  const st = useStyle();
  return <ViralCaptions top={st.broll === 'split' && isBroll(frame) ? SPLIT.seam + 40 : PAGE[st.broll]?.captionTop ?? 1418} />;
};
