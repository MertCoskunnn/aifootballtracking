import test from 'node:test';
import assert from 'node:assert/strict';
import { ballFlight, MAX_MISS } from '../trajectory.js';

test('ballFlight: düz giden topu takip eder, yerdeki başka topu almaz', () => {
  const frames = [];
  for (let i = 0; i < 10; i++) frames.push({ balls: [{ x: 100 + i * 20, y: 300 - i * 10 }, { x: 150, y: 310 }] });
  const path = ballFlight(frames, 0, { x: 100, y: 300 }, 40);
  assert.equal(path.length, 10);
  assert.deepEqual(path.at(-1), { i: 9, x: 280, y: 210 });
});

test('ballFlight: kaçırılan kareleri atlar, uzak sıçramayı reddeder', () => {
  const frames = [{ balls: [] }, { balls: [] }, { balls: [{ x: 140, y: 100 }] }, { balls: [{ x: 900, y: 50 }] }];
  const path = ballFlight(frames, 0, { x: 100, y: 100 }, 30);
  assert.deepEqual(path.map((p) => p.i), [0, 2]);
});

test('ballFlight: MAX_MISS kare top yoksa yol biter', () => {
  const frames = [{ balls: [] }];
  for (let i = 0; i < MAX_MISS; i++) frames.push({ balls: [] });
  frames.push({ balls: [{ x: 100, y: 100 }] });
  assert.equal(ballFlight(frames, 0, { x: 100, y: 100 }, 30).length, 1);
});
