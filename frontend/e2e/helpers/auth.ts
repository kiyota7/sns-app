import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { uniqueEmail, uniqueUsername, TEST_PASSWORD } from './users.ts'

export interface RegisteredUser {
  id: number
  username: string
  email: string
  password: string
}

// frontend/src/lib/types.ts の StoredAuth と揃えた形。
interface StoredAuth {
  accessToken: string
  refreshToken: string
  user: { id: number; username: string; email: string; bio: string | null }
}

const STORAGE_KEY = 'sns-auth'

async function readStoredAuth(page: Page): Promise<StoredAuth | null> {
  const raw = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)
  return raw ? (JSON.parse(raw) as StoredAuth) : null
}

// 実際に /signup フォームを操作してユーザーを新規登録し、/timeline への
// 遷移を待つ。ほとんどのシナリオはこれで「実登録経由でログイン済みの状態」を
// 作る(seedAuthLocalStorage はUIを介さない高速な代替手段だが、使用は
// navigation.spec.ts 等の一部に限定する)。
export async function registerAndLogin(page: Page, overrides?: { username?: string; email?: string }): Promise<RegisteredUser> {
  const username = overrides?.username ?? uniqueUsername()
  const email = overrides?.email ?? uniqueEmail()
  const password = TEST_PASSWORD

  await page.goto('/signup')
  await page.getByLabel('ユーザー名').fill(username)
  await page.getByLabel('メールアドレス').fill(email)
  await page.getByLabel('パスワード').fill(password)
  await page.getByRole('button', { name: '登録する' }).click()

  await page.waitForURL('**/timeline')

  const stored = await readStoredAuth(page)
  if (!stored) {
    throw new Error('[e2e] registerAndLogin: registration succeeded but sns-auth was not found in localStorage')
  }

  return { id: stored.user.id, username, email, password }
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'ログアウト' }).click()
  await page.waitForURL((url) => url.pathname === '/')
  const stored = await readStoredAuth(page)
  expect(stored).toBeNull()
}

// UIのログインフォームを介さず、localStorageへ直接認証情報を書き込む
// 高速なセットアップ手段。localStorageはオリジン単位のため、書き込みの前に
// 一度そのオリジンへ遷移しておく必要がある。
export async function seedAuthLocalStorage(page: Page, auth: StoredAuth): Promise<void> {
  await page.goto('/')
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key: STORAGE_KEY, value: auth }
  )
}
