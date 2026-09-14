// 実際の登録・ログイン・ログアウトのUI操作が、実バックエンドを通して
// 正しくつながることを確認する。Vitestの LoginView/RegisterView の
// テストは lib/api.ts をモック化しているため、実際のAPIレスポンス・
// localStorageへの永続化・実際のルーティングまでは検証できていない。
import { test, expect } from '@playwright/test'
import { uniqueEmail, uniqueUsername, TEST_PASSWORD } from './helpers/users.ts'

test('新規登録すると実際にtimelineへ遷移し、セッションが永続化される', async ({ page }) => {
  const username = uniqueUsername()
  const email = uniqueEmail()

  await page.goto('/')
  await page.getByRole('link', { name: '新規登録' }).click()
  await expect(page).toHaveURL(/\/signup$/)

  await page.getByLabel('ユーザー名').fill(username)
  await page.getByLabel('メールアドレス').fill(email)
  await page.getByLabel('パスワード').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: '登録する' }).click()

  await page.waitForURL('**/timeline')
  await expect(page.getByPlaceholder('いまどうしてる?')).toBeVisible()

  const stored = await page.evaluate(() => localStorage.getItem('sns-auth'))
  expect(stored).not.toBeNull()
  const parsed = JSON.parse(stored as string)
  expect(parsed.user.username).toBe(username)
  expect(parsed.accessToken).toBeTruthy()
  expect(parsed.refreshToken).toBeTruthy()
})

test('ログイン → ログアウト → 再ログインの一周', async ({ page }) => {
  const username = uniqueUsername()
  const email = uniqueEmail()

  // 前提となるアカウントを作る(このテストの主眼はログイン/ログアウトなので
  // 登録自体は auth.spec.ts の1本目で別途検証済み)。
  await page.goto('/signup')
  await page.getByLabel('ユーザー名').fill(username)
  await page.getByLabel('メールアドレス').fill(email)
  await page.getByLabel('パスワード').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: '登録する' }).click()
  await page.waitForURL('**/timeline')

  await page.getByRole('button', { name: 'ログアウト' }).click()
  await expect(page).toHaveURL('http://localhost:5173/')
  const clearedAuth = await page.evaluate(() => localStorage.getItem('sns-auth'))
  expect(clearedAuth).toBeNull()

  await page.getByLabel('メールアドレス').fill(email)
  await page.getByLabel('パスワード').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'ログイン' }).click()

  await page.waitForURL('**/timeline')
  await expect(page.getByPlaceholder('いまどうしてる?')).toBeVisible()
})

test('不正な認証情報では実際のバックエンドエラーが表示される', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('メールアドレス').fill(uniqueEmail('nonexistent'))
  await page.getByLabel('パスワード').fill('WrongPassword123!')
  await page.getByRole('button', { name: 'ログイン' }).click()

  await expect(page.locator('.error-message')).toHaveText('メールアドレスまたはパスワードが正しくありません。')
  await expect(page).toHaveURL('http://localhost:5173/')
})
