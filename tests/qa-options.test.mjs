import assert from 'node:assert/strict';
import test from 'node:test';
import {parseOptions, selectFrames} from '../assets/template/scripts/qa-options.mjs';

test('default sampling includes first and final frames even on short videos', () => {
  const options = parseOptions([]);
  assert.deepEqual(selectFrames(1, options), [0]);
  assert.deepEqual(selectFrames(10, options), [0, 9]);
  assert.deepEqual(selectFrames(31, options), [0, 15, 30]);
  assert.deepEqual(selectFrames(32, options), [0, 15, 30, 31]);
});

test('explicit frames are validated, sorted and deduplicated', () => {
  const options = parseOptions(['--frames=20,0,20,5', '--variant=bare', '--scale=0.75']);
  assert.deepEqual(selectFrames(21, options), [0, 5, 20]);
  assert.deepEqual(options.variants, ['bare']);
  assert.equal(options.scale, 0.75);
  assert.throws(() => selectFrames(20, options));
});

test('invalid inputs fail before launching bundle or browser', () => {
  for (const args of [['--every=0'], ['--every=-1'], ['--every=1.5'], ['--every=Infinity'],
    ['--scale=NaN'], ['--scale=0'], ['--frames=1,,2'], ['--frames=2.5'], ['--frames=-1'],
    ['--variant=unknown'], ['--frames=0', '--every=15'], ['--typo=1'], ['--every=1', '--every=2']]) {
    assert.throws(() => parseOptions(args), args.join(' '));
  }
});
