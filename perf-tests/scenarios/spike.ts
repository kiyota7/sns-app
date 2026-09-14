// spike.ts: 将来実装用のスタブ(未実装)。
//
// 構想: baseline-read.ts と同じ読み取りミックスを使い、VUを短時間で
// 急増・急減させる(例: 5→50VUを10秒でランプアップし、10秒保持し、
// 10秒でランプダウン)ことで、バースト後にJVM/Hikariプールがどれくらいの
// 速さで回復するかを見る。t3.microのCPUクレジット消費との関係も
// 観察したい場合はCloudWatch側のメトリクスと突き合わせる想定。
//
// 現時点では優先度が低いため未実装。実装する場合は baseline-read.ts の
// リクエストミックス(browseTimelineAll等)を再利用すること。
import { assertLocalOnly } from '../config/environment.ts';

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: Number(__ENV.PEAK_VUS) || 50 },
        { duration: '10s', target: Number(__ENV.PEAK_VUS) || 50 },
        { duration: '10s', target: 0 },
      ],
    },
  },
};

export function setup(): void {
  assertLocalOnly();
}

export default function (): void {
  throw new Error('[perf-tests] spike.ts is a stub — not implemented yet. See file header for the intended design.');
}
