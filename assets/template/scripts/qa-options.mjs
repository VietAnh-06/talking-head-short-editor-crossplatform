export const parseOptions = (args) => {
  const opt = {};
  for (const arg of args) {
    const match = /^--(frames|every|variant|scale)=(.+)$/.exec(arg);
    if (!match || match[1] in opt) throw new Error(`Tham số không hợp lệ hoặc bị lặp: ${arg}`);
    opt[match[1]] = match[2];
  }
  if (opt.frames && opt.every) throw new Error('Chọn --frames hoặc --every');
  const variant = opt.variant ?? 'both';
  if (!['full', 'bare', 'both'].includes(variant)) throw new Error('--variant phải là full, bare hoặc both');
  const scale = Number(opt.scale ?? 0.5);
  const every = Number(opt.every ?? 15);
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('--scale phải là số dương hữu hạn');
  if (!Number.isSafeInteger(every) || every <= 0) throw new Error('--every phải là số nguyên dương');
  const explicitFrames = opt.frames?.split(',').map((f) => f.trim() === '' ? NaN : Number(f));
  if (explicitFrames?.some((f) => !Number.isSafeInteger(f) || f < 0)) throw new Error('--frames cần các số nguyên không âm');
  return {variants: variant === 'both' ? ['full', 'bare'] : [variant], scale, every, explicitFrames};
};

export const selectFrames = (duration, {every, explicitFrames}) => {
  if (!Number.isSafeInteger(duration) || duration <= 0) throw new Error('Composition không có khung hợp lệ');
  if (explicitFrames) {
    if (explicitFrames.some((f) => f >= duration)) throw new Error('--frames vượt thời lượng composition');
    return [...new Set(explicitFrames)].sort((a, b) => a - b);
  }
  return [...new Set([...Array.from({length: Math.ceil(duration / every)}, (_, i) => i * every), duration - 1])];
};
