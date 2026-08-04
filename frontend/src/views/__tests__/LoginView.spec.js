import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { RouterLinkStub } from '@vue/test-utils'
import LoginView from '../LoginView.vue'
import { auth } from '../../lib/api'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('../../lib/api', () => ({
  auth: { login: vi.fn() },
}))

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
    auth.login.mockResolvedValueOnce({ user: { id: 1, username: 'alice' } })
    const wrapper = mountView()

    await wrapper.find('#login-email').setValue('alice@example.com')
    await wrapper.find('#login-password').setValue('password123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(auth.login).toHaveBeenCalledWith({ email: 'alice@example.com', password: 'password123' })
    expect(push).toHaveBeenCalledWith({ name: 'timeline' })
  })

  it('shows the error message and does not navigate on failure', async () => {
    auth.login.mockRejectedValueOnce(new Error('メールアドレスまたはパスワードが正しくありません。'))
    const wrapper = mountView()

    await wrapper.find('#login-email').setValue('alice@example.com')
    await wrapper.find('#login-password').setValue('wrong-password')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(push).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('メールアドレスまたはパスワードが正しくありません。')
  })

  it('disables the submit button while submitting', async () => {
    let resolveLogin
    auth.login.mockReturnValueOnce(new Promise((resolve) => (resolveLogin = resolve)))
    const wrapper = mountView()

    await wrapper.find('#login-email').setValue('alice@example.com')
    await wrapper.find('#login-password').setValue('password123')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.find('button[type=submit]').attributes('disabled')).toBeDefined()

    resolveLogin({ user: { id: 1 } })
    await flushPromises()
  })
})
