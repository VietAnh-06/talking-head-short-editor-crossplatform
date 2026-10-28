import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setCodec('h264');
// AUDIO_ONLY=1: render chỉ âm thanh (--codec=wav) để kiểm SFX che chữ trước khi render hình; wav không nhận CRF
if (!process.env.AUDIO_ONLY) Config.setCrf(16);
Config.setPixelFormat('yuv420p');
Config.setConcurrency(8);
