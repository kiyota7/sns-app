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

function post(id: number, body: string): Post {
  return { ...({ id, body } as unknown as Post) }
}

// TimelineViewが末尾のセンチネル要素を監視するのに使うIntersectionObserverを差し替え、
// テストから交差(スクロールで末尾に到達した状態)を意図的に発火できるようにする。
class FakeIntersectionObserver implements IntersectionObserver {
  static instances: FakeIntersectionObserver[] = []
  readonly root: Element | Document | null = null
  readonly rootMargin: string = ''
  readonly thresholds: ReadonlyArray<number> = []
  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instances.push(this)
  }
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = (): IntersectionObserverEntry[] => []
  intersect() {
    this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedAuth.getUser.mockReturnValue(ALICE)
  FakeIntersectionObserver.instances = []
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
})

function renderView() {
  return render(TimelineView, {
    global: { stubs: { RouterLink: RouterLinkStub, PostCard: true } },
  })
}

describe('TimelineView', () => {
  it('loads the全体 timeline on mount', async () => {
    mockedPosts.list.mockResolvedValueOnce({ items: [post(1, 'hello')], hasMore: false })
    renderView()
    await flushPromises()

    expect(mockedPosts.list).toHaveBeenCalledWith({ scope: undefined, limit: 20 })
  })

  it('shows the empty state when there are no posts', async () => {
    mockedPosts.list.mockResolvedValueOnce({ items: [], hasMore: false })
    const { findByText } = renderView()

    expect(await findByText('まだ投稿がありません。')).toBeInTheDocument()
  })

  it('switches to the following tab and requests scope=following', async () => {
    mockedPosts.list
      .mockResolvedValueOnce({ items: [], hasMore: false })
      .mockResolvedValueOnce({ items: [], hasMore: false })
    const { getByRole, findByText } = renderView()
    await flushPromises()

    await fireEvent.click(getByRole('button', { name: 'フォロー中' }))

    expect(mockedPosts.list).toHaveBeenLastCalledWith({ scope: 'following', limit: 20 })
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
    mockedPosts.list.mockResolvedValueOnce({ items: [], hasMore: false })
    const { getByPlaceholderText, getByRole, container } = renderView()
    await flushPromises()

    const newPost = post(99, 'my new post')
    mockedPosts.create.mockResolvedValueOnce(newPost)

    await fireEvent.update(getByPlaceholderText('いまどうしてる?'), 'my new post')
    await fireEvent.click(getByRole('button', { name: '投稿' }))
    await flushPromises()

    expect(mockedPosts.create).toHaveBeenCalledWith({ body: 'my new post', image: null })
    // PostCardはstub化しているためロール/ラベルを持たず、生成されたstub要素の個数で確認する。
    expect(container.querySelectorAll('post-card-stub')).toHaveLength(1)
  })

  it('does not submit an empty post', async () => {
    mockedPosts.list.mockResolvedValueOnce({ items: [], hasMore: false })
    const { getByRole } = renderView()
    await flushPromises()

    await fireEvent.click(getByRole('button', { name: '投稿' }))
    await flushPromises()

    expect(mockedPosts.create).not.toHaveBeenCalled()
  })

  it('logs out and navigates to login', async () => {
    mockedPosts.list.mockResolvedValueOnce({ items: [], hasMore: false })
    const { getByRole } = renderView()
    await flushPromises()

    await fireEvent.click(getByRole('button', { name: 'ログアウト' }))
    await flushPromises()

    expect(mockedAuth.logout).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith({ name: 'login' })
  })

  it('loads the next page (using the last post id as cursor) when scrolled to the bottom', async () => {
    mockedPosts.list.mockResolvedValueOnce({ items: [post(2, 'second'), post(1, 'first')], hasMore: true })
    const { container } = renderView()
    await flushPromises()

    mockedPosts.list.mockResolvedValueOnce({ items: [post(0, 'zeroth')], hasMore: false })
    FakeIntersectionObserver.instances[0]!.intersect()
    await flushPromises()

    expect(mockedPosts.list).toHaveBeenLastCalledWith({ scope: undefined, cursor: 1, limit: 20 })
    expect(container.querySelectorAll('post-card-stub')).toHaveLength(3)
  })

  it('does not request another page once hasMore is false', async () => {
    mockedPosts.list.mockResolvedValueOnce({ items: [post(1, 'only post')], hasMore: false })
    renderView()
    await flushPromises()

    FakeIntersectionObserver.instances[0]!.intersect()
    await flushPromises()

    expect(mockedPosts.list).toHaveBeenCalledTimes(1)
  })
})
