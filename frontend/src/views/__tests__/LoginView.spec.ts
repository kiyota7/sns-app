import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
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

function mountView() {
  return mount(LoginView, { global: { stubs: { RouterLink: RouterLinkStub } } })
}

describe('LoginView', () => {
  it('logs in with the entered email/password and navigates to the timeline', async () => {
    mockedAuth.login.mockResolvedValueOnce(LOGGED_IN_AUTH)
    const wrapper = mountView()

    await wrapper.find('#login-email').setValue('alice@example.com')
    await wrapper.find('#login-password').setValue('password123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(mockedAuth.login).toHaveBeenCalledWith({ email: 'alice@example.com', password: 'password123' })
    expect(push).toHaveBeenCalledWith({ name: 'timeline' })
  })

  it('shows the error message and does not navigate on failure', async () => {
    mockedAuth.login.mockRejectedValueOnce(new Error('メールアドレスまたはパスワードが正しくありません。'))
    const wrapper = mountView()

    await wrapper.find('#login-email').setValue('alice@example.com')
    await wrapper.find('#login-password').setValue('wrong-password')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(push).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('メールアドレスまたはパスワードが正しくありません。')
  })

  it('disables the submit button while submitting', async () => {
    let resolveLogin!: (value: StoredAuth) => void
    mockedAuth.login.mockReturnValueOnce(new Promise((resolve) => (resolveLogin = resolve)))
    const wrapper = mountView()

    await wrapper.find('#login-email').setValue('alice@example.com')
    await wrapper.find('#login-password').setValue('password123')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.find('button[type=submit]').attributes('disabled')).toBeDefined()

    resolveLogin(LOGGED_IN_AUTH)
    await flushPromises()
  })
})
