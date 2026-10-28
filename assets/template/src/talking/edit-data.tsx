import {loadFont} from '@remotion/fonts';
import React, {createContext, useContext} from 'react';
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';
import {createEditCore, EditJson, FootageName} from './edit-core';

export {FPS, END_CARD_FRAMES} from './edit-core';
export type {Clip, CaptionWord, CaptionPage, EditJson} from './edit-core';

export type EditData = ReturnType<typeof createEditData>;

export const createEditData = (edit: EditJson) => ({
  ...createEditCore(edit),
  footage: (name: FootageName) => staticFile(`footage/${edit.slug}-${name}`),
});

const EditContext = createContext<EditData | null>(null);

export const EditProvider: React.FC<{data: EditData; children: React.ReactNode}> = ({data, children}) => (
  <EditContext.Provider value={data}>{children}</EditContext.Provider>
);

export const useEdit = () => {
  const data = useContext(EditContext);
  if (!data) throw new Error('useEdit phải nằm trong EditProvider');
  return data;
};

export const KOREAN_FONT = '"Noto Sans KR Black", "Be Vietnam Pro", sans-serif';

const handle = delayRender('Nạp font Noto Sans KR');
loadFont({family: 'Noto Sans KR Black', url: staticFile('fonts/NotoSansKR-Black.otf'), weight: '900'})
  .then(() => continueRender(handle))
  .catch((err) => cancelRender(err));
