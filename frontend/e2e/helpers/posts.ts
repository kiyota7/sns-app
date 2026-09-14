import type { Page } from '@playwright/test'

// TimelineView.vue の投稿フォームで本文(+任意で画像)を入力し「投稿」を押す。
// 画像添付欄は data-testid が無く <label>画像添付<input type=file /></label>
// という実装(input が label に包まれているため getByLabel が効く)。
export async function createPost(page: Page, options: { body: string; imagePath?: string }): Promise<void> {
  await page.getByPlaceholder('いまどうしてる?').fill(options.body)
  if (options.imagePath) {
    await page.getByLabel('画像添付').setInputFiles(options.imagePath)
  }
  await page.getByRole('button', { name: '投稿' }).click()
}

// TimelineView.vue の無限スクロールは、一覧末尾にある空のセンチネルdivを
// IntersectionObserverで監視して次ページを読み込む(「もっと見る」ボタンは無い)。
// センチネルは `<div ref="sentinel"></div>` として .page 直下の最後の要素なので、
// 直下最後の div として一意に特定できる。
export async function scrollSentinelIntoView(page: Page): Promise<void> {
  await page.locator('.page > div:last-child').scrollIntoViewIfNeeded()
}

// PostCard.vue の削除ボタンはネイティブの confirm() ダイアログを挟む
// (`この投稿を削除しますか?`)。ダイアログは同期的に発生するため、
// トリガーとなるクリックより前に一度きりのハンドラを登録しておく。
export function acceptNextDialog(page: Page): void {
  page.once('dialog', (dialog) => {
    void dialog.accept()
  })
}
