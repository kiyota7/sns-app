// ブラウザパフォーマンス計測。位置づけは「記録専用」— expect().toBeLessThan()
// のような失敗しきい値は一切設けない。CIのような安定した実行環境が無く、
// 開発者個人のローカルマシン間でハードウェア差が大きいため、厳密な合否判定は
// 根拠が主観的になりやすい(perf-testsのk6スイートと同じ考え方)。
//
// 実行するとコンソールに一覧表を出し、e2e/results/run-<timestamp>.json にも
// 書き出す。変更の前後で2つのJSONを見比べて使うことを想定している。
//
// 注意: Navigation Timing(performance.getEntriesByType('navigation'))は
// 「実際のブラウザのページ読み込み」1回につき1エントリしか記録されない。
// SPA内の vue-router によるクライアントサイド遷移(リンククリック)は
// 新しいエントリを生まないため、ページごとのロード時間を計測したい箇所は
// あえて page.goto() による実ナビゲーション(ハードリロード相当)にしている。
import { test } from '@playwright/test'
import { registerAndLogin } from './helpers/auth.ts'
import { createPost, scrollSentinelIntoView } from './helpers/posts.ts'
import {
  captureNavigationTiming,
  capturePaintTiming,
  timeInteraction,
  writeRunReport,
  type NavigationTimingSample,
  type PaintTimingSample,
  type InteractionTimingSample,
} from './helpers/perf.ts'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TEST_IMAGE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'test-image.png')

test('ブラウザパフォーマンス計測(記録専用)', async ({ page }) => {
  test.slow() // 複数ページのロード計測+投稿作成を含むため、既定より長めのタイムアウトを許容する

  const navigation: NavigationTimingSample[] = []
  const paint: PaintTimingSample[] = []
  const interactions: InteractionTimingSample[] = []

  // --- 1. ログイン画面の初回ロード(未認証・冷えた状態) ---
  await page.goto('/')
  navigation.push(await captureNavigationTiming(page, 'login-page (cold)'))
  paint.push(await capturePaintTiming(page, 'login-page (cold)'))

  const user = await registerAndLogin(page)

  // --- 2. ログイン済み状態での /timeline への実ナビゲーション ---
  // (vue-routerのクライアントサイド遷移はNavigation Timingに載らないため、
  // 「ブックマークやリロードで直接 /timeline に来た場合」を模したハードナビゲーションで計測する)
  await page.goto('/timeline')
  navigation.push(await captureNavigationTiming(page, 'timeline-page (authenticated)'))
  paint.push(await capturePaintTiming(page, 'timeline-page (authenticated)'))

  // --- 3. 投稿作成(テキストのみ)の操作時間 ---
  const textOnlyBody = `perf計測-text-${Date.now()}`
  interactions.push(
    await timeInteraction('create-post (text only)', async () => {
      await createPost(page, { body: textOnlyBody })
      await page.locator('.post-card').filter({ hasText: textOnlyBody }).waitFor({ state: 'visible' })
    })
  )

  // --- 4. 投稿作成(画像あり)の操作時間(multipart送信のオーバーヘッドを切り分けて計測) ---
  const withImageBody = `perf計測-image-${Date.now()}`
  interactions.push(
    await timeInteraction('create-post (with image)', async () => {
      await createPost(page, { body: withImageBody, imagePath: TEST_IMAGE })
      await page.locator('.post-card').filter({ hasText: withImageBody }).waitFor({ state: 'visible' })
    })
  )

  // --- 5. 投稿詳細ページへの実ナビゲーション ---
  const detailPostId = await page
    .locator('.post-card')
    .filter({ hasText: textOnlyBody })
    .getByRole('link', { name: 'コメント一覧を見る' })
    .getAttribute('href')
  if (detailPostId) {
    await page.goto(detailPostId)
    navigation.push(await captureNavigationTiming(page, 'post-detail-page'))
    paint.push(await capturePaintTiming(page, 'post-detail-page'))
    await page.goto('/timeline')
  }

  // --- 6. 無限スクロールの操作時間 ---
  // 既存データ量に依存せず計測できるよう、PAGE_SIZE(20件)を確実に超える
  // 投稿をこのテスト内で作っておく。
  for (let i = 0; i < 21; i++) {
    await createPost(page, { body: `perf計測-scroll-filler-${i}-${Date.now()}` })
  }
  await page.goto('/timeline')
  await page.locator('.post-card').first().waitFor({ state: 'visible' })
  const initialCount = await page.locator('.post-card').count()
  interactions.push(
    await timeInteraction('infinite-scroll (next page)', async () => {
      await scrollSentinelIntoView(page)
      await page.waitForFunction(
        (prevCount) => document.querySelectorAll('.post-card').length > prevCount,
        initialCount,
        { timeout: 10_000 }
      )
    })
  )

  // --- 7. 検索クエリ入力→結果描画までの操作時間 ---
  // バックエンドの検索(UserMapper.xmlのsearch)は `AND users.id != #{currentUserId}`
  // で自分自身を検索結果から除外する。そのため自分のユーザー名で検索しても
  // 常に0件になってしまう。計測対象として、検索でヒットする別ユーザーを
  // 別コンテキストで用意しておく。
  const otherUserContext = await page.context().browser()!.newContext()
  const otherUserPage = await otherUserContext.newPage()
  const otherUser = await registerAndLogin(otherUserPage)
  await otherUserContext.close()

  await page.goto('/search')
  await page.locator('.search-result-row').first().waitFor({ state: 'visible' })
  interactions.push(
    await timeInteraction('search (query -> results rendered)', async () => {
      await page.getByPlaceholder('ユーザー名で検索').fill(otherUser.username)
      await page.getByRole('button', { name: '検索' }).click()
      await page.locator('.search-result-row').filter({ hasText: otherUser.username }).waitFor({ state: 'visible' })
    })
  )

  writeRunReport({ navigation, paint, interactions })
})
