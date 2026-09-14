// ユーザー検索ページ固有の挙動(初期表示・絞り込み・空結果・フォロー状態の
// 画面遷移後の保持)を確認する。social.spec.tsで検索→フォロー自体は
// カバーしているため、ここでは検索ビュー自体の細かい振る舞いに絞る。
import { test, expect } from '@playwright/test'
import { registerAndLogin } from './helpers/auth.ts'
import { uniqueUsername } from './helpers/users.ts'

test('検索ページは空クエリで全ユーザーを表示し、クエリで絞り込める', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  await registerAndLogin(page)

  // 検索対象として見つけやすい、他と衝突しにくいユーザー名を持つ別アカウントを用意する。
  const targetContext = await browser.newContext()
  const targetPage = await targetContext.newPage()
  const targetUsername = uniqueUsername('findme')
  await registerAndLogin(targetPage, { username: targetUsername })

  await page.goto('/search')
  await expect(page.getByPlaceholder('ユーザー名で検索')).toBeVisible()
  // 空クエリでマウント時に一覧が取得されるため、初期表示で少なくとも1件は表示される。
  await expect(page.locator('.search-result-row').first()).toBeVisible()

  await page.getByPlaceholder('ユーザー名で検索').fill(targetUsername)
  await page.getByRole('button', { name: '検索' }).click()

  await expect(page.locator('.search-result-row').filter({ hasText: targetUsername })).toBeVisible()
  await expect(page.locator('.search-result-row')).toHaveCount(1)

  await context.close()
  await targetContext.close()
})

test('該当しない検索キーワードでは空状態が表示される', async ({ page }) => {
  await registerAndLogin(page)
  await page.goto('/search')

  const nonexistent = `no-such-user-${crypto.randomUUID()}`
  await page.getByPlaceholder('ユーザー名で検索').fill(nonexistent)
  await page.getByRole('button', { name: '検索' }).click()

  await expect(page.getByText('該当する利用者が見つかりません。')).toBeVisible()
})

test('検索結果からのフォロー状態は、画面を移動して戻っても保持されている', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  await registerAndLogin(page)

  const targetContext = await browser.newContext()
  const targetPage = await targetContext.newPage()
  const targetUsername = uniqueUsername('followme')
  await registerAndLogin(targetPage, { username: targetUsername })

  await page.goto('/search')
  await page.getByPlaceholder('ユーザー名で検索').fill(targetUsername)
  await page.getByRole('button', { name: '検索' }).click()

  const row = page.locator('.search-result-row').filter({ hasText: targetUsername })
  await row.getByRole('button', { name: 'フォローする' }).click()
  await expect(row.getByRole('button', { name: 'フォロー中' })).toBeVisible()

  await page.goto('/timeline')
  await page.goto('/search')
  await page.getByPlaceholder('ユーザー名で検索').fill(targetUsername)
  await page.getByRole('button', { name: '検索' }).click()

  const rowAfter = page.locator('.search-result-row').filter({ hasText: targetUsername })
  await expect(rowAfter.getByRole('button', { name: 'フォロー中' })).toBeVisible()

  await context.close()
  await targetContext.close()
})
