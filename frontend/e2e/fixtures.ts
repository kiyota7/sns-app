import { test as base } from '@playwright/test'
import { registerAndLogin, type RegisteredUser } from './helpers/auth.ts'

interface Fixtures {
  // 実際に /signup を通ってログイン済みの状態で始まる page。
  // ほとんどのシナリオはこれを使い、「どうやってログインしたか」を
  // 各specで毎回書かない。
  authedPage: { page: import('@playwright/test').Page; user: RegisteredUser }
}

export const test = base.extend<Fixtures>({
  authedPage: async ({ page }, use) => {
    const user = await registerAndLogin(page)
    await use({ page, user })
  },
})

export { expect } from '@playwright/test'
