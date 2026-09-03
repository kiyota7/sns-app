import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, RouterLinkStub, flushPromises } from '@vue/test-utils'
import PostDetailView from '../PostDetailView.vue'
import { auth, posts, comments, AuthExpiredError } from '../../lib/api'
import type { Post, User } from '../../lib/types'

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

const mockedAuth = vi.mocked(auth, { deep: true })
const mockedPosts = vi.mocked(posts, { deep: true })
const mockedComments = vi.mocked(comments, { deep: true })

const ALICE: User = { id: 1, username: 'alice', email: 'alice@example.com', bio: null }

const post: Post = {
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
  mockedAuth.getUser.mockReturnValue(ALICE)
})

function mountView() {
  return mount(PostDetailView, {
    global: { stubs: { RouterLink: RouterLinkStub, PostCard: true } },
  })
}

describe('PostDetailView', () => {
  it('loads the post and its comments on mount', async () => {
    mockedPosts.getById.mockResolvedValueOnce(post)
    mockedComments.list.mockResolvedValueOnce([
      { id: 1, postId: 7, userId: 2, username: 'bob', body: 'nice!', createdAt: post.createdAt },
    ])
    const wrapper = mountView()
    await flushPromises()

    expect(mockedPosts.getById).toHaveBeenCalledWith('7')
    expect(mockedComments.list).toHaveBeenCalledWith('7')
    expect(wrapper.text()).toContain('nice!')
  })

  it('shows the empty state when there are no comments', async () => {
    mockedPosts.getById.mockResolvedValueOnce(post)
    mockedComments.list.mockResolvedValueOnce([])
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('まだコメントがありません。')
  })

  it('submits a new comment and prepends it to the list', async () => {
    mockedPosts.getById.mockResolvedValueOnce(post)
    mockedComments.list.mockResolvedValueOnce([])
    const wrapper = mountView()
    await flushPromises()

    const newComment = { id: 2, postId: 7, userId: 1, username: 'alice', body: 'my comment', createdAt: post.createdAt }
    mockedComments.create.mockResolvedValueOnce(newComment)

    await wrapper.find('.comment-form input').setValue('my comment')
    await wrapper.find('.comment-form').trigger('submit.prevent')
    await flushPromises()

    expect(mockedComments.create).toHaveBeenCalledWith('7', { body: 'my comment' })
    expect(wrapper.text()).toContain('my comment')
    expect((wrapper.find('.comment-form input').element as HTMLInputElement).value).toBe('')
  })

  it('redirects to login when the initial load expires auth', async () => {
    mockedPosts.getById.mockRejectedValueOnce(new AuthExpiredError())
    mockedComments.list.mockResolvedValueOnce([])
    mountView()
    await flushPromises()

    expect(push).toHaveBeenCalledWith({ name: 'login' })
  })

  it('navigates back to the timeline when the post is deleted', async () => {
    mockedPosts.getById.mockResolvedValueOnce(post)
    mockedComments.list.mockResolvedValueOnce([])
    const wrapper = mountView()
    await flushPromises()

    await wrapper.findComponent({ name: 'PostCard' }).vm.$emit('deleted', 7)

    expect(push).toHaveBeenCalledWith({ name: 'timeline' })
  })
})
