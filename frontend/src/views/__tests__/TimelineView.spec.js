import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import TimelineView from '../TimelineView.vue'
import { auth, posts, AuthExpiredError } from '../../lib/api'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('../../lib/api', async () => {
  class AuthExpiredError extends Error {}
  return {
    auth: { getUser: vi.fn(() => ({ id: 1, username: 'alice' })), logout: vi.fn() },
    posts: { list: vi.fn(), create: vi.fn() },
    AuthExpiredError,
  }
})

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve))
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.getUser.mockReturnValue({ id: 1, username: 'alice' })
})

function mountView() {
  return mount(TimelineView, {
    global: { stubs: { RouterLink: RouterLinkStub, PostCard: true } },
  })
}

describe('TimelineView', () => {
  it('loads the全体 timeline on mount', async () => {
    posts.list.mockResolvedValueOnce([{ id: 1, body: 'hello' }])
    mountView()
    await flushPromises()

    expect(posts.list).toHaveBeenCalledWith({})
  })

  it('shows the empty state when there are no posts', async () => {
    posts.list.mockResolvedValueOnce([])
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('まだ投稿がありません。')
  })

  it('switches to the following tab and requests scope=following', async () => {
    posts.list.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    const wrapper = mountView()
    await flushPromises()

    const followingTab = wrapper.findAll('.tab-btn').find((b) => b.text() === 'フォロー中')
    await followingTab.trigger('click')
    await flushPromises()

    expect(posts.list).toHaveBeenLastCalledWith({ scope: 'following' })
    expect(wrapper.text()).toContain('フォロー中の利用者の投稿がありません。')
  })

  it('redirects to login when the timeline request expires auth', async () => {
    posts.list.mockRejectedValueOnce(new AuthExpiredError())
    mountView()
    await flushPromises()

    expect(push).toHaveBeenCalledWith({ name: 'login' })
  })

  it('composes a new post and prepends it to the "all" timeline', async () => {
    posts.list.mockResolvedValueOnce([])
    const wrapper = mountView()
    await flushPromises()

    const newPost = { id: 99, body: 'my new post' }
    posts.create.mockResolvedValueOnce(newPost)

    await wrapper.find('textarea').setValue('my new post')
    await wrapper.find('form.post-form').trigger('submit.prevent')
    await flushPromises()

    expect(posts.create).toHaveBeenCalledWith({ body: 'my new post', image: null })
    expect(wrapper.findAllComponents({ name: 'PostCard' })).toHaveLength(1)
  })

  it('does not submit an empty post', async () => {
    posts.list.mockResolvedValueOnce([])
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('form.post-form').trigger('submit.prevent')
    await flushPromises()

    expect(posts.create).not.toHaveBeenCalled()
  })

  it('logs out and navigates to login', async () => {
    posts.list.mockResolvedValueOnce([])
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('button.btn-outline').trigger('click')
    await flushPromises()

    expect(auth.logout).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith({ name: 'login' })
  })
})
