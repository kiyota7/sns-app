import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, RouterLinkStub, flushPromises } from '@vue/test-utils'
import ProfileView from '../ProfileView.vue'
import { auth, users, AuthExpiredError } from '../../lib/api'

const push = vi.fn()
let mockRouteId = '2'

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: mockRouteId } }),
  useRouter: () => ({ push }),
}))

vi.mock('../../lib/api', async () => {
  class AuthExpiredError extends Error {}
  return {
    auth: { getUser: vi.fn(), me: vi.fn(), logout: vi.fn() },
    users: { getProfile: vi.fn(), getPosts: vi.fn(), updateProfile: vi.fn(), toggleFollow: vi.fn() },
    AuthExpiredError,
  }
})

const otherUserProfile = {
  id: 2,
  username: 'bob',
  bio: 'hi, I am bob',
  avatarUrl: null,
  followerCount: 0,
  followingCount: 0,
  following: false,
}

const selfProfile = {
  id: 1,
  username: 'alice',
  bio: null,
  avatarUrl: null,
  followerCount: 0,
  followingCount: 0,
  following: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRouteId = '2'
  auth.getUser.mockReturnValue({ id: 1, username: 'alice' })
  users.getPosts.mockResolvedValue([])
})

function mountView() {
  return mount(ProfileView, {
    global: { stubs: { RouterLink: RouterLinkStub, PostCard: true } },
  })
}

describe('ProfileView (viewing another user)', () => {
  it('shows the follow button and hides the edit button', async () => {
    users.getProfile.mockResolvedValueOnce(otherUserProfile)
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('bob')
    expect(wrapper.text()).toContain('フォローする')
    expect(wrapper.text()).not.toContain('プロフィールを編集')
  })

  it('toggles follow state when the follow button is clicked', async () => {
    users.getProfile.mockResolvedValueOnce(otherUserProfile)
    users.toggleFollow.mockResolvedValueOnce({ following: true, followerCount: 1 })
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.profile-actions button').trigger('click')
    await flushPromises()

    expect(users.toggleFollow).toHaveBeenCalledWith(2)
    expect(wrapper.text()).toContain('フォロー解除')
  })

  it('redirects to login when the profile request expires auth', async () => {
    users.getProfile.mockRejectedValueOnce(new AuthExpiredError())
    mountView()
    await flushPromises()

    expect(push).toHaveBeenCalledWith({ name: 'login' })
  })
})

describe('ProfileView (viewing own profile)', () => {
  beforeEach(() => {
    mockRouteId = '1'
  })

  it('shows an edit button instead of a follow button', async () => {
    users.getProfile.mockResolvedValueOnce(selfProfile)
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('プロフィールを編集')
    expect(wrapper.text()).not.toContain('フォローする')
  })

  it('reveals the edit form with username/bio fields when clicked', async () => {
    users.getProfile.mockResolvedValueOnce(selfProfile)
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.profile-actions button').trigger('click')

    expect(wrapper.find('#edit-username').exists()).toBe(true)
    expect(wrapper.find('#edit-bio').exists()).toBe(true)
  })

  it('saves the edited profile and refreshes the current user via auth.me', async () => {
    users.getProfile.mockResolvedValueOnce(selfProfile)
    users.updateProfile.mockResolvedValueOnce({ ...selfProfile, username: 'alice2', bio: 'updated bio' })
    auth.me.mockResolvedValueOnce({ id: 1, username: 'alice2' })
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.profile-actions button').trigger('click')
    await wrapper.find('#edit-username').setValue('alice2')
    await wrapper.find('#edit-bio').setValue('updated bio')
    await wrapper.find('form.profile-edit-form').trigger('submit.prevent')
    await flushPromises()

    expect(users.updateProfile).toHaveBeenCalledWith({ username: 'alice2', bio: 'updated bio', avatar: null })
    expect(auth.me).toHaveBeenCalled()
    expect(wrapper.text()).toContain('alice2')
  })

  it('cancel exits edit mode without saving', async () => {
    users.getProfile.mockResolvedValueOnce(selfProfile)
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.profile-actions button').trigger('click')
    const cancelButton = wrapper.findAll('button').find((b) => b.text() === 'キャンセル')
    await cancelButton.trigger('click')

    expect(wrapper.find('#edit-username').exists()).toBe(false)
    expect(users.updateProfile).not.toHaveBeenCalled()
  })
})
