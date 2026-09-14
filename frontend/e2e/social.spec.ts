// 別ユーザーからの操作(いいね・コメント・フォロー)が、本人側の画面に
// 正しく反映されるかを2つの独立したブラウザコンテキストで確認する。
//
// これはコンポーネントテストでは原理的に検証できない領域。Vitestのテストは
// 1つのVueコンポーネントインスタンスをモックAPI相手にレンダリングするだけで、
// 「別のユーザーが操作した結果が、実際のDBを介して自分の画面に反映されるか」
// という、このアプリが「SNS」である以上最も重要なクロスユーザーの整合性は
// そもそもテストの対象になり得ない。
import { test, expect, type Browser } from '@playwright/test'
import { registerAndLogin } from './helpers/auth.ts'
import { createPost } from './helpers/posts.ts'

async function newAuthedPage(browser: Browser) {
  const context = await browser.newContext()
  const page = await context.newPage()
  const user = await registerAndLogin(page)
  return { context, page, user }
}

test('別ユーザーのいいね・コメントが、投稿者側のリロード後に反映される', async ({ browser }) => {
  const userA = await newAuthedPage(browser)
  const userB = await newAuthedPage(browser)

  const body = `E2Eソーシャル投稿 ${Date.now()}`
  await userA.page.goto('/timeline')
  await createPost(userA.page, { body })

  // userBが全体タイムラインからuserAの投稿を見つけていいね・コメントする。
  await userB.page.goto('/timeline')
  const cardOnB = userB.page.locator('.post-card').filter({ hasText: body })
  await expect(cardOnB).toBeVisible()
  await cardOnB.getByRole('button', { name: 'いいね' }).click()
  await expect(cardOnB.getByRole('button', { name: 'いいねを解除' })).toBeVisible()

  await cardOnB.getByRole('link', { name: 'コメント一覧を見る' }).click()
  const commentBody = `userBからのコメント ${Date.now()}`
  await userB.page.getByPlaceholder('コメントを入力').fill(commentBody)
  await userB.page.getByRole('button', { name: '送信' }).click()
  await expect(userB.page.getByText(commentBody)).toBeVisible()

  // userA側でリロードして、いいね数・コメントが実際に反映されているか確認する。
  // ハート記号(♥/♡)は「閲覧者自身がいいね済みか」を表すため、userA自身は
  // いいねしていない以上♡のままになる(件数だけがuserBの操作を反映して増える)。
  await userA.page.reload()
  const cardOnA = userA.page.locator('.post-card').filter({ hasText: body })
  await expect(cardOnA).toContainText('♡ 1')

  await cardOnA.getByRole('link', { name: 'コメント一覧を見る' }).click()
  await expect(userA.page.getByText(commentBody)).toBeVisible()

  await userA.context.close()
  await userB.context.close()
})

test('検索からフォローすると、タイムラインの「フォロー中」タブに相手の投稿が現れる', async ({ browser }) => {
  const userA = await newAuthedPage(browser)
  const userB = await newAuthedPage(browser)

  const body = `userBの投稿 ${Date.now()}`
  await userB.page.goto('/timeline')
  await createPost(userB.page, { body })

  await userA.page.goto('/search')
  const resultRow = userA.page.locator('.search-result-row').filter({ hasText: userB.user.username })
  await expect(resultRow).toBeVisible()
  await resultRow.getByRole('button', { name: 'フォローする' }).click()
  await expect(resultRow.getByRole('button', { name: 'フォロー中' })).toBeVisible()

  await userA.page.goto('/timeline')
  await userA.page.getByRole('button', { name: 'フォロー中' }).click()
  await expect(userA.page.locator('.post-card').filter({ hasText: body })).toBeVisible()

  await userA.context.close()
  await userB.context.close()
})

test('投稿の作者リンクから、実際のプロフィールページへ遷移できる', async ({ browser }) => {
  const userA = await newAuthedPage(browser)
  const userB = await newAuthedPage(browser)

  const body = `プロフィール遷移確認用投稿 ${Date.now()}`
  await userB.page.goto('/timeline')
  await createPost(userB.page, { body })

  await userA.page.goto('/timeline')
  const card = userA.page.locator('.post-card').filter({ hasText: body })
  await expect(card).toBeVisible()
  await card.getByRole('link', { name: userB.user.username }).click()

  await expect(userA.page).toHaveURL(new RegExp(`/users/${userB.user.id}$`))
  await expect(userA.page.locator('.profile-username')).toHaveText(userB.user.username)

  await userA.context.close()
  await userB.context.close()
})
