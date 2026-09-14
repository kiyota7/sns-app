import { defineConfig, devices } from '@playwright/test'

// このファイルはローカル実行専用。BASE_URLは環境変数での上書きを一切許可しない
// (perf-tests/config/environment.ts の assertLocalOnly() と同じ考え方 — 本番を
// 指す設定そのものを存在させないことで、誤って本番に対して実行するリスクを
// 構造的に無くしている)。
const FRONTEND_URL = 'http://localhost:5173'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // SQLiteは単一ライターのため(perf-tests/scenarios/write-contention.ts で
  // 実測済み)、各テストが実際にユーザー登録・投稿を行うE2Eをデフォルトの
  // CPUコア数ぶん並列実行すると、書き込みロック競合によるテストの
  // flaky化を招きやすい。ここでは並列度を意図的に抑えている。
  // 詳細は e2e/README.md の「並列実行とSQLiteの書き込み競合について」を参照。
  workers: 2,
  // retriesはCI環境のための一般的な緩衝材ではなく、上記の書き込み競合を
  // 吸収するための意図的な措置。retryが発生した場合は本当に競合だったのか、
  // 実際のバグなのかをtraceで確認すること。
  retries: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e/playwright-report', open: 'never' }],
  ],
  outputDir: 'e2e/test-results',
  use: {
    baseURL: FRONTEND_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // フロントエンドの開発サーバーのみ自動起動する。バックエンド(Spring Boot)は
  // 起動に時間がかかるうえ、perf-tests と同じく「開発者が先に自分で起動する」
  // という規約に揃えている。バックエンドが起動していない場合は
  // e2e/global-setup.ts が分かりやすいメッセージで即座に停止する。
  webServer: {
    command: 'npm run dev',
    url: FRONTEND_URL,
    reuseExistingServer: true,
    timeout: 30_000,
  },
  globalSetup: './e2e/global-setup.ts',
})
