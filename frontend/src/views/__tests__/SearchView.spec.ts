import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/vue'
import { RouterLinkStub } from '@vue/test-utils'
import SearchView from '../SearchView.vue'
import { auth, users, AuthExpiredError } from '../../lib/api'
import type { User } from '../../lib/types'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('../../lib/api', async () => {
  class AuthExpiredError extends Error {}
  return {
    auth: { getUser: vi.fn(), logout: vi.fn() },
    users: { search: vi.fn(), toggleFollow: vi.fn() },
    AuthExpiredError,
  }
})

const mockedAuth = vi.mocked(auth, { deep: true })
const mockedUsers = vi.mocked(users, { deep: true })

const ALICE: User = { id: 1, username: 'alice', email: 'alice@example.com', bio: null }

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedAuth.getUser.mockReturnValue(ALICE)
})

function renderView() {
  return render(SearchView, { global: { stubs: { RouterLink: RouterLinkStub } } })
}

describe('SearchView', () => {
  it('loads all users (empty query) on mount', async () => {
    mockedUsers.search.mockResolvedValueOnce([{ id: 2, username: 'bob', following: false }])
    const { findByText } = renderView()

    expect(await findByText('bob')).toBeInTheDocument()
    expect(mockedUsers.search).toHaveBeenCalledWith('')
  })

  it('shows the empty state when no results are found', async () => {
    mockedUsers.search.mockResolvedValueOnce([])
    const { findByText } = renderView()

    expect(await findByText('該当する利用者が見つかりません。')).toBeInTheDocument()
  })

  it('searches with the trimmed query on submit', async () => {
    mockedUsers.search
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 3, username: 'carol', following: false }])
    const { getByPlaceholderText, getByRole, findByText } = renderView()
    await flushPromises()

    await fireEvent.update(getByPlaceholderText('ユーザー名で検索'), '  carol  ')
    await fireEvent.click(getByRole('button', { name: '検索' }))

    expect(await findByText('carol')).toBeInTheDocument()
    expect(mockedUsers.search).toHaveBeenLastCalledWith('carol')
  })

  it('toggles follow state for a search result', async () => {
    mockedUsers.search.mockResolvedValueOnce([{ id: 2, username: 'bob', following: false }])
    mockedUsers.toggleFollow.mockResolvedValueOnce({ following: true, followerCount: 1 })
    const { findByRole, getByRole } = renderView()

    await fireEvent.click(await findByRole('button', { name: 'フォローする' }))
    await flushPromises()

    expect(mockedUsers.toggleFollow).toHaveBeenCalledWith(2)
    expect(getByRole('button', { name: 'フォロー中' })).toBeInTheDocument()
  })

  it('redirects to login when the search request expires auth', async () => {
    mockedUsers.search.mockRejectedValueOnce(new AuthExpiredError())
    renderView()
    await flushPromises()

    expect(push).toHaveBeenCalledWith({ name: 'login' })
  })
})
