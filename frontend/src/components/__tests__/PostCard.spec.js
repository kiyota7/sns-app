import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import PostCard from '../PostCard.vue'
import { posts } from '../../lib/api'

vi.mock('../../lib/api', () => ({
  posts: {
    toggleLike: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))

const basePost = {
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

function mountCard(props = {}) {
  return mount(PostCard, {
    props: { post: basePost, currentUser: { id: 10, username: 'alice' }, ...props },
    global: { stubs: { RouterLink: RouterLinkStub } },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PostCard', () => {
  it('renders the post body, author, and counts', () => {
    const wrapper = mountCard()

    expect(wrapper.text()).toContain('hello world')
    expect(wrapper.text()).toContain('alice')
    expect(wrapper.text()).toContain('2')
    expect(wrapper.text()).toContain('3')
  })

  it('shows the image when imageUrl is present', () => {
    const wrapper = mountCard({ post: { ...basePost, imageUrl: '/uploads/cat.jpg' } })

    const img = wrapper.find('img.image-preview')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('/uploads/cat.jpg')
  })

  it('does not render an image when imageUrl is absent', () => {
    const wrapper = mountCard()

    expect(wrapper.find('img.image-preview').exists()).toBe(false)
  })

  it('shows edit/delete controls only for the post owner', () => {
    const ownerWrapper = mountCard({ currentUser: { id: 10, username: 'alice' } })
    expect(ownerWrapper.text()).toContain('編集')
    expect(ownerWrapper.text()).toContain('削除')

    const strangerWrapper = mountCard({ currentUser: { id: 99, username: 'bob' } })
    expect(strangerWrapper.text()).not.toContain('編集')
  })

  it('shows the filled heart and updated count after liking', async () => {
    posts.toggleLike.mockResolvedValueOnce({ liked: true, likeCount: 3 })
    const wrapper = mountCard()

    await wrapper.find('.action-btn').trigger('click')
    await flushPromises()

    expect(posts.toggleLike).toHaveBeenCalledWith(1)
    expect(wrapper.find('.action-btn').text()).toContain('♥')
    expect(wrapper.find('.action-btn').text()).toContain('3')
  })

  it('emits an error event when liking fails', async () => {
    posts.toggleLike.mockRejectedValueOnce(new Error('like failed'))
    const wrapper = mountCard()

    await wrapper.find('.action-btn').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('error')).toEqual([['like failed']])
  })

  it('enters edit mode, saves, and emits updated', async () => {
    const updatedPost = { ...basePost, body: 'edited body' }
    posts.update.mockResolvedValueOnce(updatedPost)
    const wrapper = mountCard()

    await wrapper.find('button.btn-small').trigger('click') // 編集
    const textarea = wrapper.find('textarea.edit-post-textarea')
    expect(textarea.exists()).toBe(true)
    await textarea.setValue('edited body')

    const saveButton = wrapper.findAll('button').find((b) => b.text() === '保存')
    await saveButton.trigger('click')
    await flushPromises()

    expect(posts.update).toHaveBeenCalledWith(1, { body: 'edited body' })
    expect(wrapper.emitted('updated')).toEqual([[updatedPost]])
  })

  it('cancel exits edit mode without saving', async () => {
    const wrapper = mountCard()

    await wrapper.find('button.btn-small').trigger('click') // 編集
    expect(wrapper.find('textarea.edit-post-textarea').exists()).toBe(true)

    const cancelButton = wrapper.findAll('button').find((b) => b.text() === 'キャンセル')
    await cancelButton.trigger('click')

    expect(wrapper.find('textarea.edit-post-textarea').exists()).toBe(false)
    expect(posts.update).not.toHaveBeenCalled()
  })

  it('deletes the post after confirmation and emits deleted', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true))
    posts.remove.mockResolvedValueOnce(undefined)
    const wrapper = mountCard()

    const deleteButton = wrapper.findAll('button').find((b) => b.text() === '削除')
    await deleteButton.trigger('click')
    await flushPromises()

    expect(posts.remove).toHaveBeenCalledWith(1)
    expect(wrapper.emitted('deleted')).toEqual([[1]])
  })

  it('does not delete when the confirmation is declined', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false))
    const wrapper = mountCard()

    const deleteButton = wrapper.findAll('button').find((b) => b.text() === '削除')
    await deleteButton.trigger('click')
    await flushPromises()

    expect(posts.remove).not.toHaveBeenCalled()
    expect(wrapper.emitted('deleted')).toBeUndefined()
  })
})

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve))
}
