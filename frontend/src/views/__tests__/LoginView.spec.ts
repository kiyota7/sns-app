import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/vue'
import { RouterLinkStub } from '@vue/test-utils'
import LoginView from '../LoginView.vue'
import { auth } from '../../lib/api'
import type { StoredAuth } from '../../lib/types'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('../../lib/api', () => ({
  auth: { login: vi.fn() },
}))

const mockedAuth = vi.mocked(auth, { deep: true })

const LOGGED_IN_AUTH: StoredAuth = {
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
  return render(LoginView, { global: { stubs: { RouterLink: RouterLinkStub } } })
}

describe('LoginView', () => {
  it('logs in with the entered email/password and navigates to the timeline', async () => {
    mockedAuth.login.mockResolvedValueOnce(LOGGED_IN_AUTH)
    const { getByLabelText, getByRole } = renderView()

    await fireEvent.update(getByLabelText('メールアドレス'), 'alice@example.com')
    await fireEvent.update(getByLabelText('パスワード'), 'password123')
    await fireEvent.click(getByRole('button', { name: 'ログイン' }))
    await flushPromises()

    expect(mockedAuth.login).toHaveBeenCalledWith({ email: 'alice@example.com', password: 'password123' })
    expect(push).toHaveBeenCalledWith({ name: 'timeline' })
  })

  it('shows the error message and does not navigate on failure', async () => {
    mockedAuth.login.mockRejectedValueOnce(new Error('メールアドレスまたはパスワードが正しくありません。'))
    const { getByLabelText, getByRole, findByText } = renderView()

    await fireEvent.update(getByLabelText('メールアドレス'), 'alice@example.com')
    await fireEvent.update(getByLabelText('パスワード'), 'wrong-password')
    await fireEvent.click(getByRole('button', { name: 'ログイン' }))

    expect(await findByText('メールアドレスまたはパスワードが正しくありません。')).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })

  it('disables the submit button while submitting', async () => {
    let resolveLogin!: (value: StoredAuth) => void
    mockedAuth.login.mockReturnValueOnce(new Promise((resolve) => (resolveLogin = resolve)))
    const { getByLabelText, getByRole } = renderView()

    await fireEvent.update(getByLabelText('メールアドレス'), 'alice@example.com')
    await fireEvent.update(getByLabelText('パスワード'), 'password123')
    await fireEvent.click(getByRole('button', { name: 'ログイン' }))

    expect(getByRole('button', { name: 'ログイン' })).toBeDisabled()

    resolveLogin(LOGGED_IN_AUTH)
    await flushPromises()
  })
})
