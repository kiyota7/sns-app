import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, RouterLinkStub, flushPromises } from '@vue/test-utils'
import PostDetailView from '../PostDetailView.vue'
import { auth, posts, comments, AuthExpiredError } from '../../lib/api'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: '7' } }),
  useRouter: () => ({ push }),
}))

vi.mock('../../lib/api', async () => {
  class AuthExpiredError extends Error {}
  return {
    auth: { getUser: vi.fn() },
    posts: { getById: vi.fn() },
    comments: { list: vi.fn(), create: vi.fn() },
    AuthExpiredError,
  }
})

const post = {
  id: 7,
  userId: 1,
  username: 'alice',
  body: 'a post',
  imageUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  likeCount: 0,
  commentCount: 1,
  liked: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.getUser.mockReturnValue({ id: 1, username: 'alice' })
})

function mountView() {
  return mount(PostDetailView, {
    global: { stubs: { RouterLink: RouterLinkStub, PostCard: true } },
  })
}

describe('PostDetailView', () => {
  it('loads the post and its comments on mount', async () => {
    posts.getById.mockResolvedValueOnce(post)
    comments.list.mockResolvedValueOnce([{ id: 1, username: 'bob', body: 'nice!', createdAt: post.createdAt }])
    const wrapper = mountView()
    await flushPromises()

    expect(posts.getById).toHaveBeenCalledWith('7')
    expect(comments.list).toHaveBeenCalledWith('7')
    expect(wrapper.text()).toContain('nice!')
  })

  it('shows the empty state when there are no comments', async () => {
    posts.getById.mockResolvedValueOnce(post)
    comments.list.mockResolvedValueOnce([])
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('まだコメントがありません。')
  })

  it('submits a new comment and prepends it to the list', async () => {
    posts.getById.mockResolvedValueOnce(post)
    comments.list.mockResolvedValueOnce([])
    const wrapper = mountView()
    await flushPromises()

    const newComment = { id: 2, username: 'alice', body: 'my comment', createdAt: post.createdAt }
    comments.create.mockResolvedValueOnce(newComment)

    await wrapper.find('.comment-form input').setValue('my comment')
    await wrapper.find('.comment-form').trigger('submit.prevent')
    await flushPromises()

    expect(comments.create).toHaveBeenCalledWith('7', { body: 'my comment' })
    expect(wrapper.text()).toContain('my comment')
    expect(wrapper.find('.comment-form input').element.value).toBe('')
  })

  it('redirects to login when the initial load expires auth', async () => {
    posts.getById.mockRejectedValueOnce(new AuthExpiredError())
    comments.list.mockResolvedValueOnce([])
    mountView()
    await flushPromises()

    expect(push).toHaveBeenCalledWith({ name: 'login' })
  })

  it('navigates back to the timeline when the post is deleted', async () => {
    posts.getById.mockResolvedValueOnce(post)
    comments.list.mockResolvedValueOnce([])
    const wrapper = mountView()
    await flushPromises()

    await wrapper.findComponent({ name: 'PostCard' }).vm.$emit('deleted', 7)

    expect(push).toHaveBeenCalledWith({ name: 'timeline' })
  })
})
