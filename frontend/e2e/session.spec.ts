// セッションの永続化・失効まわりを、実際のページリロードを介して確認する。
// VitestのTimelineView.spec.ts等はvue-routerをモック化しているため、
// 「SPA内のナビゲーション」ではなく「ブラウザの実際のリロード」を経ても
// 状態が正しく維持される/失われるかは、この層でしか検証できない。
import { test, expect } from '@playwright/test'
import { registerAndLogin } from './helpers/auth.ts'

test('実際にページをリロードしても、ログイン状態は維持される', async ({ page }) => {
  await registerAndLogin(page)
  await expect(page).toHaveURL(/\/timeline$/)

  await page.reload()

  await expect(page).toHaveURL(/\/timeline$/)
  await expect(page.getByPlaceholder('いまどうしてる?')).toBeVisible()
  const stored = await page.evaluate(() => localStorage.getItem('sns-auth'))
  expect(stored).not.toBeNull()
})

test('localStorageのセッション情報を消してリロードすると、ログイン画面へリダイレクトされる', async ({ page }) => {
  await registerAndLogin(page)

  await page.evaluate(() => localStorage.removeItem('sns-auth'))
  await page.reload()

  await expect(page).toHaveURL('http://localhost:5173/')
})

test('ログアウト後に保護ルートへ直接アクセスするとログイン画面へリダイレクトされ、再ログインで復帰できる', async ({
  page,
}) => {
  const user = await registerAndLogin(page)
  await page.getByRole('button', { name: 'ログアウト' }).click()
  await expect(page).toHaveURL('http://localhost:5173/')

  await page.goto('/timeline')
  await expect(page).toHaveURL('http://localhost:5173/')

  await page.getByLabel('メールアドレス').fill(user.email)
  await page.getByLabel('パスワード').fill(user.password)
  await page.getByRole('button', { name: 'ログイン' }).click()

  await expect(page).toHaveURL(/\/timeline$/)
})
