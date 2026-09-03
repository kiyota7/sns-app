import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent } from 'vue'
import { render, fireEvent } from '@testing-library/vue'
import { RouterLinkStub } from '@vue/test-utils'
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

// 実際のPostCardの代わりに、deletedイベントをボタン操作で発火できる最小限のstubを使う。
// (VTUの自動stub(true)はコンポーネントのemitをテストから直接呼び出す手段を持たないため)
const PostCardStub = defineComponent({
  props: ['post', 'currentUser'],
  emits: ['deleted'],
  template: '<button type="button" @click="$emit(\'deleted\', post.id)">投稿を削除(stub)</button>',
})

beforeEach(() => {
  vi.clearAllMocks()
  mockedAuth.getUser.mockReturnValue(ALICE)
})

function renderView() {
  return render(PostDetailView, {
    global: { stubs: { RouterLink: RouterLinkStub, PostCard: PostCardStub } },
  })
}

describe('PostDetailView', () => {
  it('loads the post and its comments on mount', async () => {
    mockedPosts.getById.mockResolvedValueOnce(post)
    mockedComments.list.mockResolvedValueOnce([
      { id: 1, postId: 7, userId: 2, username: 'bob', body: 'nice!', createdAt: post.createdAt },
    ])
    const { findByText } = renderView()

    expect(await findByText('nice!')).toBeInTheDocument()
    expect(mockedPosts.getById).toHaveBeenCalledWith('7')
    expect(mockedComments.list).toHaveBeenCalledWith('7')
  })

  it('shows the empty state when there are no comments', async () => {
    mockedPosts.getById.mockResolvedValueOnce(post)
    mockedComments.list.mockResolvedValueOnce([])
    const { findByText } = renderView()

    expect(await findByText('まだコメントがありません。')).toBeInTheDocument()
  })

  it('submits a new comment and prepends it to the list', async () => {
    mockedPosts.getById.mockResolvedValueOnce(post)
    mockedComments.list.mockResolvedValueOnce([])
    const { getByPlaceholderText, getByRole, findByText } = renderView()
    await findByText('まだコメントがありません。')

    const newComment = { id: 2, postId: 7, userId: 1, username: 'alice', body: 'my comment', createdAt: post.createdAt }
    mockedComments.create.mockResolvedValueOnce(newComment)

    const commentInput = getByPlaceholderText('コメントを入力')
    await fireEvent.update(commentInput, 'my comment')
    await fireEvent.click(getByRole('button', { name: '送信' }))

    expect(await findByText('my comment')).toBeInTheDocument()
    expect(mockedComments.create).toHaveBeenCalledWith('7', { body: 'my comment' })
    expect((commentInput as HTMLInputElement).value).toBe('')
  })

  it('redirects to login when the initial load expires auth', async () => {
    mockedPosts.getById.mockRejectedValueOnce(new AuthExpiredError())
    mockedComments.list.mockResolvedValueOnce([])
    renderView()

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith({ name: 'login' }))
  })

  it('navigates back to the timeline when the post is deleted', async () => {
    mockedPosts.getById.mockResolvedValueOnce(post)
    mockedComments.list.mockResolvedValueOnce([])
    const { findByRole } = renderView()

    await fireEvent.click(await findByRole('button', { name: '投稿を削除(stub)' }))

    expect(push).toHaveBeenCalledWith({ name: 'timeline' })
  })
})
