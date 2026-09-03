import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import TimelineView from '../TimelineView.vue'
import { auth, posts, AuthExpiredError } from '../../lib/api'
import type { Post, User } from '../../lib/types'

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

const mockedAuth = vi.mocked(auth, { deep: true })
const mockedPosts = vi.mocked(posts, { deep: true })

const ALICE: User = { id: 1, username: 'alice', email: 'alice@example.com', bio: null }

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedAuth.getUser.mockReturnValue(ALICE)
})

function mountView() {
  return mount(TimelineView, {
    global: { stubs: { RouterLink: RouterLinkStub, PostCard: true } },
  })
}

describe('TimelineView', () => {
  it('loads the全体 timeline on mount', async () => {
    mockedPosts.list.mockResolvedValueOnce([{ id: 1, body: 'hello' } as unknown as Post])
    mountView()
    await flushPromises()

    expect(mockedPosts.list).toHaveBeenCalledWith({})
  })

  it('shows the empty state when there are no posts', async () => {
    mockedPosts.list.mockResolvedValueOnce([])
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('まだ投稿がありません。')
  })

  it('switches to the following tab and requests scope=following', async () => {
    mockedPosts.list.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    const wrapper = mountView()
    await flushPromises()

    const followingTab = wrapper.findAll('.tab-btn').find((b) => b.text() === 'フォロー中')
    await followingTab!.trigger('click')
    await flushPromises()

    expect(mockedPosts.list).toHaveBeenLastCalledWith({ scope: 'following' })
    expect(wrapper.text()).toContain('フォロー中の利用者の投稿がありません。')
  })

  it('redirects to login when the timeline request expires auth', async () => {
    mockedPosts.list.mockRejectedValueOnce(new AuthExpiredError())
    mountView()
    await flushPromises()

    expect(push).toHaveBeenCalledWith({ name: 'login' })
  })

  it('composes a new post and prepends it to the "all" timeline', async () => {
    mockedPosts.list.mockResolvedValueOnce([])
    const wrapper = mountView()
    await flushPromises()

    const newPost = { id: 99, body: 'my new post' } as unknown as Post
    mockedPosts.create.mockResolvedValueOnce(newPost)

    await wrapper.find('textarea').setValue('my new post')
    await wrapper.find('form.post-form').trigger('submit.prevent')
    await flushPromises()

    expect(mockedPosts.create).toHaveBeenCalledWith({ body: 'my new post', image: null })
    expect(wrapper.findAllComponents({ name: 'PostCard' })).toHaveLength(1)
  })

  it('does not submit an empty post', async () => {
    mockedPosts.list.mockResolvedValueOnce([])
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('form.post-form').trigger('submit.prevent')
    await flushPromises()

    expect(mockedPosts.create).not.toHaveBeenCalled()
  })

  it('logs out and navigates to login', async () => {
    mockedPosts.list.mockResolvedValueOnce([])
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('button.btn-outline').trigger('click')
    await flushPromises()

    expect(mockedAuth.logout).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith({ name: 'login' })
  })
})
