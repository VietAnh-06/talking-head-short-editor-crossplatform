import React from 'react';
import {AbsoluteFill, interpolate, OffthreadVideo, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {useBeats} from './broll';
import {Clip, EditData, useEdit} from './edit-data';

// Tâm khuôn mặt trong khung 1440x2560 (đo từ footage): phóng to quanh đây để mặt không trôi khỏi khung
const FACE_ORIGIN = '46% 44%';

// Nhịp punch-in: câu đắt phóng sát, đầu mỗi ý phóng vừa, các nhát cắt nhảy trong một ý xen kẽ hai cỡ
// để che bước nhảy của đầu và giữ mắt người xem luôn có thay đổi.
const zoomFor = (zoom: EditData['zoom'], clip: Clip, index: number): [number, number] => {
  if (zoom.tight?.includes(clip.section)) return [1.36, 1.42];
  if (zoom.wide?.includes(clip.section)) return [1.0, 1.04];
  if (zoom.push?.includes(clip.section)) return [1.02, 1.16];
  if (clip.piece === 0) return [1.2, 1.24];
  return index % 2 ? [1.0, 1.03] : [1.12, 1.15];
};

const ClipVideo: React.FC<{clip: Clip; index: number; panel: boolean}> = ({clip, index, panel}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const {zoom, footage} = useEdit();
  const {talkVisible, isBroll} = useBeats();
  // Chỉ giải mã video thầy khi cảnh thầy đang hiện: toàn khung khi thầy nói, bảng dưới khi chiếu B-roll chia đôi
  if (panel ? !isBroll(clip.atFrame + frame) : !talkVisible(clip.atFrame + frame)) return null;
  if (panel) {
    return (
      <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#000'}}>
        <OffthreadVideo src={footage('graded.mp4')} trimBefore={clip.inFrame} muted style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 36%'}} />
      </AbsoluteFill>
    );
  }
  const [from, to] = zoomFor(zoom, clip, index);
  const scale = interpolate(frame, [0, durationInFrames], [from, to], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#000'}}>
      <OffthreadVideo
        src={footage('graded.mp4')}
        trimBefore={clip.inFrame}
        muted
        style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})`, transformOrigin: FACE_ORIGIN}}
      />
    </AbsoluteFill>
  );
};

export const FootageTrack: React.FC<{panel?: boolean}> = ({panel = false}) => {
  const {clips} = useEdit();
  return (
    <>
      {clips.map((clip, i) => (
        <Sequence key={`${clip.section}-${clip.piece}`} from={clip.atFrame} durationInFrames={clip.outFrame - clip.inFrame}>
          <ClipVideo clip={clip} index={i} panel={panel} />
        </Sequence>
      ))}
    </>
  );
};

// Giọng thầy chạy liên tục, tách khỏi hình để hình có thể đổi chế độ mà tiếng không bị ngắt
// Giọng đã ghép sẵn theo EDL (build-talking-edit.py → <slug>-edit-voice.wav), fade 12 ms ở mỗi mép cắt, chính xác tới mẫu.
// Phát từng đoạn rời từ voice.wav thì bật/tắt tiếng đột ngột ở mép (volume chỉ đổi theo khung 33 ms).
export const VoiceTrack: React.FC = () => {
  const {footage, speechFrames} = useEdit();
  return (
    <Sequence from={0} durationInFrames={speechFrames} layout="none">
      <Audio src={footage('edit-voice.wav')} />
    </Sequence>
  );
};
