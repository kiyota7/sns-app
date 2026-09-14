// 各テストが使い捨てのユーザーを自前で作成するための、一意な識別子生成。
//
// これにより、シードデータやDBリセットが一切不要になる(perf-tests/seed/とは
// 異なるアプローチ)。時刻+ランダム値の組み合わせで、並列実行(workers: 2)や
// 繰り返し実行でも衝突しない値を作る。

let counter = 0

function uniqueSuffix(): string {
  counter += 1
  return `${Date.now().toString(36)}${counter}${Math.random().toString(36).slice(2, 6)}`
}

// バックエンドのusernameはmaxlength 50。接頭辞を短くし、余裕を持たせる。
export function uniqueUsername(prefix = 'e2e'): string {
  return `${prefix}_${uniqueSuffix()}`.slice(0, 50)
}

export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}_${uniqueSuffix()}@e2e.test`
}

// パスワードはbackendのバリデーション(8〜100文字)を満たす固定値。
// テスト専用の使い捨てアカウント用であり、実運用の秘密情報ではない。
export const TEST_PASSWORD = 'Password123!'
