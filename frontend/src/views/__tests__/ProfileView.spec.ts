import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/vue'
import { RouterLinkStub } from '@vue/test-utils'
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

function renderView() {
  return render(ProfileView, {
    global: { stubs: { RouterLink: RouterLinkStub, PostCard: true } },
  })
}

describe('ProfileView (viewing another user)', () => {
  it('shows the follow button and hides the edit button', async () => {
    mockedUsers.getProfile.mockResolvedValueOnce(otherUserProfile)
    const { findByText, getByRole, queryByRole } = renderView()

    expect(await findByText('bob')).toBeInTheDocument()
    expect(getByRole('button', { name: 'フォローする' })).toBeInTheDocument()
    expect(queryByRole('button', { name: 'プロフィールを編集' })).not.toBeInTheDocument()
  })

  it('toggles follow state when the follow button is clicked', async () => {
    mockedUsers.getProfile.mockResolvedValueOnce(otherUserProfile)
    mockedUsers.toggleFollow.mockResolvedValueOnce({ following: true, followerCount: 1 })
    const { findByRole } = renderView()

    await fireEvent.click(await findByRole('button', { name: 'フォローする' }))

    expect(mockedUsers.toggleFollow).toHaveBeenCalledWith(2)
    expect(await findByRole('button', { name: 'フォロー解除' })).toBeInTheDocument()
  })

  it('redirects to login when the profile request expires auth', async () => {
    mockedUsers.getProfile.mockRejectedValueOnce(new AuthExpiredError())
    renderView()

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith({ name: 'login' }))
  })
})

describe('ProfileView (viewing own profile)', () => {
  beforeEach(() => {
    mockRouteId = '1'
  })

  it('shows an edit button instead of a follow button', async () => {
    mockedUsers.getProfile.mockResolvedValueOnce(selfProfile)
    const { findByRole, queryByRole } = renderView()

    expect(await findByRole('button', { name: 'プロフィールを編集' })).toBeInTheDocument()
    expect(queryByRole('button', { name: 'フォローする' })).not.toBeInTheDocument()
  })

  it('reveals the edit form with username/bio fields when clicked', async () => {
    mockedUsers.getProfile.mockResolvedValueOnce(selfProfile)
    const { findByRole, getByLabelText } = renderView()

    await fireEvent.click(await findByRole('button', { name: 'プロフィールを編集' }))

    expect(getByLabelText('ユーザー名')).toBeInTheDocument()
    expect(getByLabelText('自己紹介')).toBeInTheDocument()
  })

  it('saves the edited profile and refreshes the current user via auth.me', async () => {
    mockedUsers.getProfile.mockResolvedValueOnce(selfProfile)
    mockedUsers.updateProfile.mockResolvedValueOnce({ ...selfProfile, username: 'alice2', bio: 'updated bio' })
    mockedAuth.me.mockResolvedValueOnce({ ...ALICE, username: 'alice2' })
    const { findByRole, getByLabelText, getByRole, findByText } = renderView()

    await fireEvent.click(await findByRole('button', { name: 'プロフィールを編集' }))
    await fireEvent.update(getByLabelText('ユーザー名'), 'alice2')
    await fireEvent.update(getByLabelText('自己紹介'), 'updated bio')
    await fireEvent.click(getByRole('button', { name: '保存' }))

    expect(await findByText('alice2')).toBeInTheDocument()
    expect(mockedUsers.updateProfile).toHaveBeenCalledWith({ username: 'alice2', bio: 'updated bio', avatar: null })
    expect(mockedAuth.me).toHaveBeenCalled()
  })

  it('cancel exits edit mode without saving', async () => {
    mockedUsers.getProfile.mockResolvedValueOnce(selfProfile)
    const { findByRole, getByRole, queryByLabelText } = renderView()

    await fireEvent.click(await findByRole('button', { name: 'プロフィールを編集' }))
    await fireEvent.click(getByRole('button', { name: 'キャンセル' }))

    expect(queryByLabelText('ユーザー名')).not.toBeInTheDocument()
    expect(mockedUsers.updateProfile).not.toHaveBeenCalled()
  })
})
