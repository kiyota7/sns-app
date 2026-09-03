import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/vue'
import { RouterLinkStub } from '@vue/test-utils'
import RegisterView from '../RegisterView.vue'
import { auth } from '../../lib/api'
import type { StoredAuth } from '../../lib/types'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('../../lib/api', () => ({
  auth: { register: vi.fn() },
}))

const mockedAuth = vi.mocked(auth, { deep: true })

const REGISTERED_AUTH: StoredAuth = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  user: { id: 1, username: 'alice', email: 'alice@example.com', bio: null },
}

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve))
}

beforeEach(() => {
  vi.clearAllMocks()
})

function renderView() {
  return render(RegisterView, { global: { stubs: { RouterLink: RouterLinkStub } } })
}

describe('RegisterView', () => {
  it('registers with the entered fields and navigates to the timeline', async () => {
    mockedAuth.register.mockResolvedValueOnce(REGISTERED_AUTH)
    const { getByLabelText, getByRole } = renderView()

    await fireEvent.update(getByLabelText('ユーザー名'), 'alice')
    await fireEvent.update(getByLabelText('メールアドレス'), 'alice@example.com')
    await fireEvent.update(getByLabelText('パスワード'), 'password123')
    await fireEvent.click(getByRole('button', { name: '登録する' }))
    await flushPromises()

    expect(mockedAuth.register).toHaveBeenCalledWith({
      username: 'alice',
      email: 'alice@example.com',
      password: 'password123',
    })
    expect(push).toHaveBeenCalledWith({ name: 'timeline' })
  })

  it('shows the error message on duplicate username and does not navigate', async () => {
    mockedAuth.register.mockRejectedValueOnce(new Error('そのユーザー名は既に使われています。'))
    const { getByLabelText, getByRole, findByText } = renderView()

    await fireEvent.update(getByLabelText('ユーザー名'), 'alice')
    await fireEvent.update(getByLabelText('メールアドレス'), 'alice@example.com')
    await fireEvent.update(getByLabelText('パスワード'), 'password123')
    await fireEvent.click(getByRole('button', { name: '登録する' }))

    expect(await findByText('そのユーザー名は既に使われています。')).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })
})
