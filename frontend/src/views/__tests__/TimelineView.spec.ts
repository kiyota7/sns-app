import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/vue'
import { RouterLinkStub } from '@vue/test-utils'
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

function renderView() {
  return render(TimelineView, {
    global: { stubs: { RouterLink: RouterLinkStub, PostCard: true } },
  })
}

describe('TimelineView', () => {
  it('loads the全体 timeline on mount', async () => {
    mockedPosts.list.mockResolvedValueOnce([{ id: 1, body: 'hello' } as unknown as Post])
    renderView()
    await flushPromises()

    expect(mockedPosts.list).toHaveBeenCalledWith({})
  })

  it('shows the empty state when there are no posts', async () => {
    mockedPosts.list.mockResolvedValueOnce([])
    const { findByText } = renderView()

    expect(await findByText('まだ投稿がありません。')).toBeInTheDocument()
  })

  it('switches to the following tab and requests scope=following', async () => {
    mockedPosts.list.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    const { getByRole, findByText } = renderView()
    await flushPromises()

    await fireEvent.click(getByRole('button', { name: 'フォロー中' }))

    expect(mockedPosts.list).toHaveBeenLastCalledWith({ scope: 'following' })
    // <br>で分割されているため、部分一致(exact: false)で取得する。
    expect(await findByText('フォロー中の利用者の投稿がありません。', { exact: false })).toBeInTheDocument()
  })

  it('redirects to login when the timeline request expires auth', async () => {
    mockedPosts.list.mockRejectedValueOnce(new AuthExpiredError())
    renderView()
    await flushPromises()

    expect(push).toHaveBeenCalledWith({ name: 'login' })
  })

  it('composes a new post and prepends it to the "all" timeline', async () => {
    mockedPosts.list.mockResolvedValueOnce([])
    const { getByPlaceholderText, getByRole, container } = renderView()
    await flushPromises()

    const newPost = { id: 99, body: 'my new post' } as unknown as Post
    mockedPosts.create.mockResolvedValueOnce(newPost)

    await fireEvent.update(getByPlaceholderText('いまどうしてる?'), 'my new post')
    await fireEvent.click(getByRole('button', { name: '投稿' }))
    await flushPromises()

    expect(mockedPosts.create).toHaveBeenCalledWith({ body: 'my new post', image: null })
    // PostCardはstub化しているためロール/ラベルを持たず、生成されたstub要素の個数で確認する。
    expect(container.querySelectorAll('post-card-stub')).toHaveLength(1)
  })

  it('does not submit an empty post', async () => {
    mockedPosts.list.mockResolvedValueOnce([])
    const { getByRole } = renderView()
    await flushPromises()

    await fireEvent.click(getByRole('button', { name: '投稿' }))
    await flushPromises()

    expect(mockedPosts.create).not.toHaveBeenCalled()
  })

  it('logs out and navigates to login', async () => {
    mockedPosts.list.mockResolvedValueOnce([])
    const { getByRole } = renderView()
    await flushPromises()

    await fireEvent.click(getByRole('button', { name: 'ログアウト' }))
    await flushPromises()

    expect(mockedAuth.logout).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith({ name: 'login' })
  })
})
