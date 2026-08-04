import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import RegisterView from '../RegisterView.vue'
import { auth } from '../../lib/api'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('../../lib/api', () => ({
  auth: { register: vi.fn() },
}))

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve))
}

beforeEach(() => {
  vi.clearAllMocks()
})

function mountView() {
  return mount(RegisterView, { global: { stubs: { RouterLink: RouterLinkStub } } })
}

describe('RegisterView', () => {
  it('registers with the entered fields and navigates to the timeline', async () => {
    auth.register.mockResolvedValueOnce({ user: { id: 1, username: 'alice' } })
    const wrapper = mountView()

    await wrapper.find('#signup-username').setValue('alice')
    await wrapper.find('#signup-email').setValue('alice@example.com')
    await wrapper.find('#signup-password').setValue('password123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(auth.register).toHaveBeenCalledWith({
      username: 'alice',
      email: 'alice@example.com',
      password: 'password123',
    })
    expect(push).toHaveBeenCalledWith({ name: 'timeline' })
  })

  it('shows the error message on duplicate username and does not navigate', async () => {
    auth.register.mockRejectedValueOnce(new Error('そのユーザー名は既に使われています。'))
    const wrapper = mountView()

    await wrapper.find('#signup-username').setValue('alice')
    await wrapper.find('#signup-email').setValue('alice@example.com')
    await wrapper.find('#signup-password').setValue('password123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(push).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('そのユーザー名は既に使われています。')
  })
})
