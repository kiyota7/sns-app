// 全specの実行前に一度だけ走るセットアップ。
//
// 目的1: バックエンドの疎通確認。バックエンド(Spring Boot、ポート8080)は
// このE2Eスイートからは自動起動しない(perf-testsと同じ方針 — 起動に時間が
// かかるため、開発者が事前に自分で起動する)。起動し忘れたまま実行すると
// 全specが個別にタイムアウトして原因が分かりにくくなるため、ここで一度だけ
// 疎通確認し、失敗時は次に何をすればよいか分かるメッセージで即座に止める。
//
// 目的2: このスイートが対象とするURLがlocalhostであることの自己チェック。
// baseURL/backend URLはどちらもハードコードされた定数であり実際には
// 変更しようがないが、perf-tests/config/environment.ts の assertLocalOnly()
// と同じ考え方を明文化しておく(将来誰かがURLを変数化しようとしたときの
// 「ここにガードがある」という目印にもなる)。
const BACKEND_URL = 'http://localhost:8080'
const FRONTEND_URL = 'http://localhost:5173'

function assertLocalOnly(url: string): void {
  if (!url.startsWith('http://localhost') && !url.startsWith('http://127.0.0.1')) {
    throw new Error(`[e2e] "${url}" is not localhost. This suite must never target a remote environment.`)
  }
}

export default async function globalSetup(): Promise<void> {
  assertLocalOnly(BACKEND_URL)
  assertLocalOnly(FRONTEND_URL)

  try {
    // 未認証で呼べる /api/auth/me は401を返すが、それ自体が「バックエンドが
    // 起動している」ことの証拠になる。接続自体が失敗する場合とを区別する。
    await fetch(`${BACKEND_URL}/api/auth/me`)
  } catch {
    throw new Error(
      '[e2e] バックエンド(http://localhost:8080)に接続できませんでした。\n' +
        '  先に `cd backend && mvn spring-boot:run` でバックエンドを起動してください' +
        '(詳細は docs/ローカル開発環境セットアップ.md、または start-dev-servers skill を参照)。'
    )
  }
}
