import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/vue'
import { RouterLinkStub } from '@vue/test-utils'
import PostCard from '../PostCard.vue'
import { posts } from '../../lib/api'
import type { Post } from '../../lib/types'

vi.mock('../../lib/api', () => ({
  posts: {
    toggleLike: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))

const mockedPosts = vi.mocked(posts, { deep: true })

const basePost: Post = {
  id: 1,
  userId: 10,
  username: 'alice',
  body: 'hello world',
  imageUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  likeCount: 2,
  commentCount: 3,
  liked: false,
}

function renderCard(props: { post?: Post; currentUser?: { id: number; username: string } } = {}) {
  return render(PostCard, {
    props: { post: basePost, currentUser: { id: 10, username: 'alice' }, ...props },
    global: { stubs: { RouterLink: RouterLinkStub } },
  })
}

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PostCard', () => {
  it('renders the post body, author, and counts', () => {
    // コメント数のリンクはRouterLinkStubがhrefを付与しないため、jsdom上でaria roleが
    // "link"にならない(role/labelクエリの対象外)。テキストで取得する。
    const { getByText, getByRole } = renderCard()

    expect(getByText('hello world')).toBeInTheDocument()
    expect(getByText('alice')).toBeInTheDocument()
    expect(getByRole('button', { name: 'いいね' })).toHaveTextContent('2')
    expect(getByText('💬 3')).toBeInTheDocument()
  })

  it('shows the image when imageUrl is present', () => {
    const { getByRole } = renderCard({ post: { ...basePost, imageUrl: '/uploads/cat.jpg' } })

    expect(getByRole('img', { name: '投稿画像' })).toHaveAttribute('src', '/uploads/cat.jpg')
  })

  it('does not render an image when imageUrl is absent', () => {
    const { queryByRole } = renderCard()

    expect(queryByRole('img', { name: '投稿画像' })).not.toBeInTheDocument()
  })

  it('shows edit/delete controls only for the post owner', () => {
    const owner = renderCard({ currentUser: { id: 10, username: 'alice' } })
    expect(owner.getByRole('button', { name: '編集' })).toBeInTheDocument()
    expect(owner.getByRole('button', { name: '削除' })).toBeInTheDocument()
    cleanup()

    const stranger = renderCard({ currentUser: { id: 99, username: 'bob' } })
    expect(stranger.queryByRole('button', { name: '編集' })).not.toBeInTheDocument()
  })

  it('shows the filled heart and updated count after liking', async () => {
    mockedPosts.toggleLike.mockResolvedValueOnce({ liked: true, likeCount: 3 })
    const { getByRole, findByRole } = renderCard()

    await fireEvent.click(getByRole('button', { name: 'いいね' }))

    expect(mockedPosts.toggleLike).toHaveBeenCalledWith(1)
    expect(await findByRole('button', { name: 'いいねを解除' })).toHaveTextContent('3')
  })

  it('flips liked/likeCount immediately, before the server responds', async () => {
    let resolveToggle!: (result: { liked: boolean; likeCount: number }) => void
    mockedPosts.toggleLike.mockReturnValueOnce(new Promise((resolve) => (resolveToggle = resolve)))
    const { getByRole } = renderCard()

    await fireEvent.click(getByRole('button', { name: 'いいね' }))

    expect(getByRole('button', { name: 'いいねを解除' })).toHaveTextContent('3')

    resolveToggle({ liked: true, likeCount: 3 })
    await flushPromises()
  })

  it('reverts liked/likeCount and emits an error event when liking fails', async () => {
    mockedPosts.toggleLike.mockRejectedValueOnce(new Error('like failed'))
    const { getByRole, emitted } = renderCard()

    await fireEvent.click(getByRole('button', { name: 'いいね' }))
    await flushPromises()

    expect(emitted().error).toEqual([['like failed']])
    expect(getByRole('button', { name: 'いいね' })).toHaveTextContent('2')
  })

  it('enters edit mode, saves, and emits updated', async () => {
    const updatedPost = { ...basePost, body: 'edited body' }
    mockedPosts.update.mockResolvedValueOnce(updatedPost)
    const { getByRole, emitted } = renderCard()

    await fireEvent.click(getByRole('button', { name: '編集' }))
    await fireEvent.update(getByRole('textbox'), 'edited body')
    await fireEvent.click(getByRole('button', { name: '保存' }))
    await flushPromises()

    expect(mockedPosts.update).toHaveBeenCalledWith(1, { body: 'edited body' })
    expect(emitted().updated).toEqual([[updatedPost]])
  })

  it('cancel exits edit mode without saving', async () => {
    const { getByRole, queryByRole } = renderCard()

    await fireEvent.click(getByRole('button', { name: '編集' }))
    expect(getByRole('textbox')).toBeInTheDocument()

    await fireEvent.click(getByRole('button', { name: 'キャンセル' }))

    expect(queryByRole('textbox')).not.toBeInTheDocument()
    expect(mockedPosts.update).not.toHaveBeenCalled()
  })

  it('deletes the post after confirmation and emits deleted', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true))
    mockedPosts.remove.mockResolvedValueOnce(undefined)
    const { getByRole, emitted } = renderCard()

    await fireEvent.click(getByRole('button', { name: '削除' }))
    await flushPromises()

    expect(mockedPosts.remove).toHaveBeenCalledWith(1)
    expect(emitted().deleted).toEqual([[1]])
  })

  it('does not delete when the confirmation is declined', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false))
    const { getByRole, emitted } = renderCard()

    await fireEvent.click(getByRole('button', { name: '削除' }))
    await flushPromises()

    expect(mockedPosts.remove).not.toHaveBeenCalled()
    expect(emitted().deleted).toBeUndefined()
  })
})
