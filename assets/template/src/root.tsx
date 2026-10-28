import React from 'react';
import {Composition, Still} from 'remotion';
import {VIDEOS} from './videos/registry';
import type {StyleId} from './talking/style';
import './theme';

export const RemotionRoot: React.FC = () => (
  <>
    {VIDEOS.map((v) => (
      <Composition key={v.id} id={v.id} component={v.component} durationInFrames={v.data.totalFrames} fps={30} width={1080} height={1920} defaultProps={{style: v.style}} />
    ))}
    {VIDEOS.filter((v) => v.poster).map((v) => (
      <Still key={`${v.id}Poster`} id={`${v.id}Poster`} component={v.poster as React.FC<{style?: StyleId}>} width={1080} height={1920} defaultProps={{style: v.style}} />
    ))}
  </>
);
