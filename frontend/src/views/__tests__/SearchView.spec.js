import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, RouterLinkStub, flushPromises } from '@vue/test-utils'
import SearchView from '../SearchView.vue'
import { auth, users, AuthExpiredError } from '../../lib/api'

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

beforeEach(() => {
  vi.clearAllMocks()
  auth.getUser.mockReturnValue({ id: 1, username: 'alice' })
})

function mountView() {
  return mount(SearchView, { global: { stubs: { RouterLink: RouterLinkStub } } })
}

describe('SearchView', () => {
  it('loads all users (empty query) on mount', async () => {
    users.search.mockResolvedValueOnce([{ id: 2, username: 'bob', following: false }])
    const wrapper = mountView()
    await flushPromises()

    expect(users.search).toHaveBeenCalledWith('')
    expect(wrapper.text()).toContain('bob')
  })

  it('shows the empty state when no results are found', async () => {
    users.search.mockResolvedValueOnce([])
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('該当する利用者が見つかりません。')
  })

  it('searches with the trimmed query on submit', async () => {
    users.search.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 3, username: 'carol', following: false }])
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('input[type=text]').setValue('  carol  ')
    await wrapper.find('form.search-bar').trigger('submit.prevent')
    await flushPromises()

    expect(users.search).toHaveBeenLastCalledWith('carol')
    expect(wrapper.text()).toContain('carol')
  })

  it('toggles follow state for a search result', async () => {
    users.search.mockResolvedValueOnce([{ id: 2, username: 'bob', following: false }])
    users.toggleFollow.mockResolvedValueOnce({ following: true, followerCount: 1 })
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.search-result-row button').trigger('click')
    await flushPromises()

    expect(users.toggleFollow).toHaveBeenCalledWith(2)
    expect(wrapper.find('.search-result-row button').text()).toBe('フォロー中')
  })

  it('redirects to login when the search request expires auth', async () => {
    users.search.mockRejectedValueOnce(new AuthExpiredError())
    mountView()
    await flushPromises()

    expect(push).toHaveBeenCalledWith({ name: 'login' })
  })
})
