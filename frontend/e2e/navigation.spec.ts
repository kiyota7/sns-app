// ルーター境界の挙動: 未ログイン状態での保護ルート直接アクセス、
// ブラウザの戻る/進むボタンとSPAルーターの整合性、存在しないIDへの
// アクセス時の実際の挙動(現状は専用の404ページが無く、各Viewが
// 通常のAPIエラーと同じ .error-message で表示する)を確認する。
import { test, expect } from '@playwright/test'
import { registerAndLogin } from './helpers/auth.ts'
import { createPost } from './helpers/posts.ts'

test.describe('未ログイン状態で保護ルートに直接アクセスするとログイン画面へリダイレクトされる', () => {
  for (const path of ['/timeline', '/posts/1', '/users/1', '/search']) {
    test(`${path} → /`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL('http://localhost:5173/')
      await expect(page.getByLabel('メールアドレス')).toBeVisible()
    })
  }
})

test('ブラウザの戻る/進むボタンがSPAルーターと正しく連動する', async ({ page }) => {
  await registerAndLogin(page)
  const body = `ナビゲーション確認用投稿 ${Date.now()}`
  await createPost(page, { body })

  // 詳細ページ→アプリ内の「戻る」ボタンでタイムラインへ。
  await page.locator('.post-card').filter({ hasText: body }).getByRole('link', { name: 'コメント一覧を見る' }).click()
  await expect(page).toHaveURL(/\/posts\/\d+$/)
  await page.getByRole('button', { name: '← 戻る' }).click()
  await expect(page).toHaveURL(/\/timeline$/)

  // 投稿者リンクでプロフィールへ → ブラウザの戻るボタン → 進むボタン。
  await page.locator('.post-card').filter({ hasText: body }).locator('.post-author').click()
  await expect(page).toHaveURL(/\/users\/\d+$/)

  await page.goBack()
  await expect(page).toHaveURL(/\/timeline$/)
  await expect(page.locator('.post-card').filter({ hasText: body })).toBeVisible()

  await page.goForward()
  await expect(page).toHaveURL(/\/users\/\d+$/)
  await expect(page.locator('.profile-username')).toBeVisible()
})

test('存在しない投稿idにアクセスしてもクラッシュせず、エラー表示から戻れる', async ({ page }) => {
  await registerAndLogin(page)

  const pageErrors: Error[] = []
  page.on('pageerror', (error) => pageErrors.push(error))

  await page.goto('/posts/999999999')
  await expect(page.locator('.error-message')).toBeVisible()
  await expect(page.getByRole('button', { name: '← 戻る' })).toBeVisible()
  await page.getByRole('button', { name: '← 戻る' }).click()
  await expect(page).toHaveURL(/\/timeline$/)

  expect(pageErrors).toHaveLength(0)
})

test('存在しないユーザーidにアクセスしてもクラッシュせず、エラー表示から戻れる', async ({ page }) => {
  await registerAndLogin(page)

  const pageErrors: Error[] = []
  page.on('pageerror', (error) => pageErrors.push(error))

  await page.goto('/users/999999999')
  await expect(page.locator('.error-message')).toBeVisible()
  await expect(page.getByRole('button', { name: '← 戻る' })).toBeVisible()
  await page.getByRole('button', { name: '← 戻る' }).click()
  await expect(page).toHaveURL(/\/timeline$/)

  expect(pageErrors).toHaveLength(0)
})
