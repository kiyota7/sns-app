// 投稿の作成・閲覧・コメント・画像アップロード・編集・削除が、実バックエンドを
// 通して一連の流れとして正しく動くことを確認する。
//
// 特に「編集/削除がリロード後も反映されているか」は、Vitestの
// PostCard.spec.ts(楽観的UI更新のロジックだけをモックAPIで検証)では
// 原理的に検証できない領域(ローカルの見た目が変わっただけで、実際は
// サーバーに保存されていない、というバグをここで検出できる)。
import { test, expect } from './fixtures.ts'
import { createPost, acceptNextDialog } from './helpers/posts.ts'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TEST_IMAGE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'test-image.png')

test('投稿を作成すると一覧に反映され、詳細ページでコメントできる', async ({ authedPage }) => {
  const { page } = authedPage
  const body = `E2E投稿本文 ${Date.now()}`

  await page.goto('/timeline')
  await createPost(page, { body })
  await expect(page.locator('.post-card').filter({ hasText: body })).toBeVisible()

  await page.locator('.post-card').filter({ hasText: body }).getByRole('link', { name: 'コメント一覧を見る' }).click()
  await expect(page).toHaveURL(/\/posts\/\d+$/)
  await expect(page.locator('.post-card')).toContainText(body)
  await expect(page.getByText('まだコメントがありません。')).toBeVisible()

  const commentBody = `E2Eコメント ${Date.now()}`
  await page.getByPlaceholder('コメントを入力').fill(commentBody)
  await page.getByRole('button', { name: '送信' }).click()

  await expect(page.getByText(commentBody)).toBeVisible()
  await expect(page.getByText('まだコメントがありません。')).not.toBeVisible()
})

test('画像付きで投稿すると、実際にmultipartで送信され一覧に画像が表示される', async ({ authedPage }) => {
  const { page } = authedPage
  const body = `E2E画像投稿 ${Date.now()}`

  await page.goto('/timeline')
  await page.getByPlaceholder('いまどうしてる?').fill(body)
  await page.getByLabel('画像添付').setInputFiles(TEST_IMAGE)

  // 送信前にプレビューが表示されることを確認。
  await expect(page.getByAltText('添付画像プレビュー')).toBeVisible()

  const [request] = await Promise.all([
    page.waitForRequest((req) => req.url().includes('/api/posts') && req.method() === 'POST'),
    page.getByRole('button', { name: '投稿' }).click(),
  ])
  expect(request.headers()['content-type']).toContain('multipart/form-data')

  const createdCard = page.locator('.post-card').filter({ hasText: body })
  await expect(createdCard).toBeVisible()
  await expect(createdCard.getByAltText('投稿画像')).toBeVisible()
  await expect(createdCard.getByAltText('投稿画像')).toHaveAttribute('src', /\/uploads\//)
})

test('投稿を編集すると、リロード後も編集内容が保持されている(サーバーに永続化されている)', async ({ authedPage }) => {
  const { page } = authedPage
  const originalBody = `E2E編集前 ${Date.now()}`
  const updatedBody = `E2E編集後 ${Date.now()}`

  await page.goto('/timeline')
  await createPost(page, { body: originalBody })

  const card = page.locator('.post-card').filter({ hasText: originalBody })
  await card.getByRole('button', { name: '編集' }).click()

  // 編集モードに入るとPostCardのテンプレートが切り替わり、本文(originalBody)は
  // テキストとして描画されなくなる(textareaのvalueとしてのみ存在する)ため、
  // hasTextフィルタ済みの`card`ロケーターはこの時点で再評価すると0件になる。
  // そのため以降はページ全体から編集用textarea/保存ボタンを直接探す
  // (編集中のPostCardはこのpage内に1つしか存在しないため一意に特定できる)。
  await page.locator('.edit-post-textarea').fill(updatedBody)
  await page.getByRole('button', { name: '保存' }).click()

  await expect(page.locator('.post-card').filter({ hasText: updatedBody })).toBeVisible()

  await page.reload()
  await expect(page.locator('.post-card').filter({ hasText: updatedBody })).toBeVisible()
  await expect(page.locator('.post-card').filter({ hasText: originalBody })).toHaveCount(0)
})

test('投稿を削除すると一覧から消え、リロード後も戻ってこない', async ({ authedPage }) => {
  const { page } = authedPage
  const body = `E2E削除対象 ${Date.now()}`

  await page.goto('/timeline')
  await createPost(page, { body })

  const card = page.locator('.post-card').filter({ hasText: body })
  await expect(card).toBeVisible()

  acceptNextDialog(page)
  await card.getByRole('button', { name: '削除' }).click()
  await expect(page.locator('.post-card').filter({ hasText: body })).toHaveCount(0)

  await page.reload()
  await expect(page.locator('.post-card').filter({ hasText: body })).toHaveCount(0)
})
