import type React from 'react';
import type {EditData} from '../talking/edit-data';
import type {StyleId} from '../talking/style';
// new-video.py thêm import ngay dưới dòng này
// @imports

// poster: ảnh bìa thiết kế riêng (Still <id>Poster), xuất bằng npx remotion still src/index.ts <id>Poster out/final/<slug>-cover.jpg
export type VideoEntry = {id: string; component: React.FC<{style?: StyleId}>; data: EditData; style: StyleId; poster?: React.FC<{style?: StyleId}>};

export const VIDEOS: VideoEntry[] = [
  // new-video.py thêm video ngay trên dòng này
  // @entries
];
