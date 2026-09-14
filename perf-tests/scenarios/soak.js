// soak.js: 将来実装用のスタブ(未実装)。
//
// 構想: baseline-read.js の読み取りミックスを、低VU数(5程度)で30分以上
// 継続実行し、メモリリーク・コネクションリーク・SQLiteファイルの
// 肥大化などの長時間実行特有の問題を検知する。
//
// このアプリは本番も含めステージング環境が無く長時間の負荷試験を
// 安全に流せる場所が限られるため、現時点では優先度低として未実装。
// 実装する場合は baseline-read.js のリクエストミックスを再利用し、
// duration を長めに設定すること。
import { assertLocalOnly, BASE_URL } from '../config/environment.js';

export const options = {
  vus: Number(__ENV.VUS) || 5,
  duration: __ENV.DURATION || '30m',
};

export default function () {
  assertLocalOnly();
  throw new Error('[perf-tests] soak.js is a stub — not implemented yet. See file header for the intended design.');
}
