import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, RouterLinkStub, flushPromises } from '@vue/test-utils'
import ProfileView from '../ProfileView.vue'
import { auth, users, AuthExpiredError } from '../../lib/api'
import type { Profile, User } from '../../lib/types'

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

const mockedAuth = vi.mocked(auth, { deep: true })
const mockedUsers = vi.mocked(users, { deep: true })

const ALICE: User = { id: 1, username: 'alice', email: 'alice@example.com', bio: null }

const otherUserProfile: Profile = {
  id: 2,
  username: 'bob',
  bio: 'hi, I am bob',
  avatarUrl: null,
  followerCount: 0,
  followingCount: 0,
  following: false,
}

const selfProfile: Profile = {
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
  mockedAuth.getUser.mockReturnValue(ALICE)
  mockedUsers.getPosts.mockResolvedValue([])
})

function mountView() {
  return mount(ProfileView, {
    global: { stubs: { RouterLink: RouterLinkStub, PostCard: true } },
  })
}

describe('ProfileView (viewing another user)', () => {
  it('shows the follow button and hides the edit button', async () => {
    mockedUsers.getProfile.mockResolvedValueOnce(otherUserProfile)
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('bob')
    expect(wrapper.text()).toContain('フォローする')
    expect(wrapper.text()).not.toContain('プロフィールを編集')
  })

  it('toggles follow state when the follow button is clicked', async () => {
    mockedUsers.getProfile.mockResolvedValueOnce(otherUserProfile)
    mockedUsers.toggleFollow.mockResolvedValueOnce({ following: true, followerCount: 1 })
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.profile-actions button').trigger('click')
    await flushPromises()

    expect(mockedUsers.toggleFollow).toHaveBeenCalledWith(2)
    expect(wrapper.text()).toContain('フォロー解除')
  })

  it('redirects to login when the profile request expires auth', async () => {
    mockedUsers.getProfile.mockRejectedValueOnce(new AuthExpiredError())
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
    mockedUsers.getProfile.mockResolvedValueOnce(selfProfile)
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('プロフィールを編集')
    expect(wrapper.text()).not.toContain('フォローする')
  })

  it('reveals the edit form with username/bio fields when clicked', async () => {
    mockedUsers.getProfile.mockResolvedValueOnce(selfProfile)
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.profile-actions button').trigger('click')

    expect(wrapper.find('#edit-username').exists()).toBe(true)
    expect(wrapper.find('#edit-bio').exists()).toBe(true)
  })

  it('saves the edited profile and refreshes the current user via auth.me', async () => {
    mockedUsers.getProfile.mockResolvedValueOnce(selfProfile)
    mockedUsers.updateProfile.mockResolvedValueOnce({ ...selfProfile, username: 'alice2', bio: 'updated bio' })
    mockedAuth.me.mockResolvedValueOnce({ ...ALICE, username: 'alice2' })
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.profile-actions button').trigger('click')
    await wrapper.find('#edit-username').setValue('alice2')
    await wrapper.find('#edit-bio').setValue('updated bio')
    await wrapper.find('form.profile-edit-form').trigger('submit.prevent')
    await flushPromises()

    expect(mockedUsers.updateProfile).toHaveBeenCalledWith({ username: 'alice2', bio: 'updated bio', avatar: null })
    expect(mockedAuth.me).toHaveBeenCalled()
    expect(wrapper.text()).toContain('alice2')
  })

  it('cancel exits edit mode without saving', async () => {
    mockedUsers.getProfile.mockResolvedValueOnce(selfProfile)
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.profile-actions button').trigger('click')
    const cancelButton = wrapper.findAll('button').find((b) => b.text() === 'キャンセル')
    await cancelButton!.trigger('click')

    expect(wrapper.find('#edit-username').exists()).toBe(false)
    expect(mockedUsers.updateProfile).not.toHaveBeenCalled()
  })
})
