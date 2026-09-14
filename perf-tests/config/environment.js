// 全スクリプト共通の環境設定。BASE_URL / VUS / DURATION 等はすべて
// 環境変数(-e または k6 run 実行時のシェル変数)で上書きできる既定値。
//
// 重要: このファイルは「ローカル環境にしか向けない」ための安全弁を持つ。
// perf-tests は本番(EC2)・ステージング環境を一切対象にしない前提のため、
// BASE_URL が localhost / 127.0.0.1 以外を指している場合は
// assertLocalOnly() が例外を投げて実行を止める。
// 各シナリオ・シードスクリプトの setup() で必ず呼び出すこと。

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

const ALLOWED_HOST_PREFIXES = ['http://localhost', 'http://127.0.0.1'];

export function assertLocalOnly() {
  const isAllowed = ALLOWED_HOST_PREFIXES.some((prefix) => BASE_URL.startsWith(prefix));
  if (!isAllowed) {
    throw new Error(
      `[perf-tests] BASE_URL="${BASE_URL}" is not localhost/127.0.0.1. ` +
        'This test suite must never be pointed at production or any remote environment. ' +
        'Start the backend locally (mvn spring-boot:run) and unset/fix BASE_URL.'
    );
  }
}

// シナリオ共通のデフォルト(各シナリオファイル側で ENV による個別上書きも可能)
export const DEFAULT_VUS = Number(__ENV.VUS) || undefined; // undefined なら各シナリオの既定値を使う
export const DEFAULT_DURATION = __ENV.DURATION || undefined;

// シード済みテストユーザーの共通パスワード(テスト専用の固定値。本物の秘密情報ではない)
export const SEED_PASSWORD = 'Password123!';
