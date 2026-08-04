import { describe, it, expect, vi, beforeEach } from 'vitest'
import { auth, posts, comments, users, AuthExpiredError } from '../api'

function jsonResponse(body, { ok = true, status = ok ? 200 : 400 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  }
}

const SAVED_AUTH = {
  accessToken: 'access-token-1',
  refreshToken: 'refresh-token-1',
  user: { id: 1, username: 'alice', email: 'alice@example.com', bio: null },
}

function saveAuthToStorage(auth = SAVED_AUTH) {
  localStorage.setItem('sns-auth', JSON.stringify(auth))
}

beforeEach(() => {
  localStorage.clear()
  global.fetch = vi.fn()
})

describe('auth.register', () => {
  it('posts credentials and saves the returned auth to localStorage', async () => {
    fetch.mockResolvedValueOnce(jsonResponse(SAVED_AUTH))

    const result = await auth.register({ username: 'alice', email: 'alice@example.com', password: 'password123' })

    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/register',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'alice', email: 'alice@example.com', password: 'password123' }),
      })
    )
    expect(result).toEqual(SAVED_AUTH)
    expect(JSON.parse(localStorage.getItem('sns-auth'))).toEqual(SAVED_AUTH)
  })

  it('throws with the server error message on failure', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ error: 'そのユーザー名は既に使われています。' }, { ok: false }))

    await expect(
      auth.register({ username: 'alice', email: 'alice@example.com', password: 'password123' })
    ).rejects.toThrow('そのユーザー名は既に使われています。')
    expect(localStorage.getItem('sns-auth')).toBeNull()
  })
})

describe('auth.login', () => {
  it('saves auth on success', async () => {
    fetch.mockResolvedValueOnce(jsonResponse(SAVED_AUTH))

    await auth.login({ email: 'alice@example.com', password: 'password123' })

    expect(auth.getUser()).toEqual(SAVED_AUTH.user)
    expect(auth.isLoggedIn()).toBe(true)
  })

  it('throws a generic message when the error body is unparseable', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => {
        throw new Error('not json')
      },
    })

    await expect(auth.login({ email: 'x@example.com', password: 'wrong' })).rejects.toThrow(
      '予期しないエラーが発生しました。'
    )
  })
})

describe('authenticated requests (via posts.list)', () => {
  it('throws AuthExpiredError immediately when not logged in', async () => {
    await expect(posts.list()).rejects.toBeInstanceOf(AuthExpiredError)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('attaches the Bearer access token and returns the parsed JSON on success', async () => {
    saveAuthToStorage()
    fetch.mockResolvedValueOnce(jsonResponse([{ id: 1, body: 'hello' }]))

    const result = await posts.list()

    expect(fetch).toHaveBeenCalledWith(
      '/api/posts',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer access-token-1' }) })
    )
    expect(result).toEqual([{ id: 1, body: 'hello' }])
  })

  it('appends the scope query param when provided', async () => {
    saveAuthToStorage()
    fetch.mockResolvedValueOnce(jsonResponse([]))

    await posts.list({ scope: 'following' })

    expect(fetch).toHaveBeenCalledWith('/api/posts?scope=following', expect.anything())
  })

  it('on 401, refreshes the access token once and retries the original request', async () => {
    saveAuthToStorage()
    fetch
      .mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ accessToken: 'new-access-token', refreshToken: 'new-refresh-token' }))
      .mockResolvedValueOnce(jsonResponse([{ id: 1 }]))

    const result = await posts.list()

    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fetch.mock.calls[1][0]).toBe('/api/auth/refresh')
    expect(fetch.mock.calls[2][1].headers.Authorization).toBe('Bearer new-access-token')
    expect(result).toEqual([{ id: 1 }])
    expect(JSON.parse(localStorage.getItem('sns-auth')).accessToken).toBe('new-access-token')
  })

  it('when the refresh token is also invalid, clears storage and throws AuthExpiredError', async () => {
    saveAuthToStorage()
    fetch
      .mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 401 }))
      .mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 401 }))

    await expect(posts.list()).rejects.toBeInstanceOf(AuthExpiredError)
    expect(localStorage.getItem('sns-auth')).toBeNull()
  })
})

describe('auth.me', () => {
  it('merges the returned user into the saved auth without touching tokens', async () => {
    saveAuthToStorage()
    const updatedUser = { id: 1, username: 'alice-renamed', email: 'alice@example.com', bio: 'hi' }
    fetch.mockResolvedValueOnce(jsonResponse(updatedUser))

    const result = await auth.me()

    expect(result).toEqual(updatedUser)
    const stored = JSON.parse(localStorage.getItem('sns-auth'))
    expect(stored.user).toEqual(updatedUser)
    expect(stored.accessToken).toBe('access-token-1')
  })
})

describe('auth.logout', () => {
  it('clears local auth even if the logout request fails', async () => {
    saveAuthToStorage()
    fetch.mockRejectedValueOnce(new Error('network error'))

    await auth.logout()

    expect(localStorage.getItem('sns-auth')).toBeNull()
  })

  it('does nothing when not logged in', async () => {
    await auth.logout()

    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('posts', () => {
  beforeEach(() => saveAuthToStorage())

  it('create sends a FormData body with post text and optional image', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ id: 1, body: 'hello' }))
    const image = new File(['bytes'], 'cat.jpg', { type: 'image/jpeg' })

    await posts.create({ body: 'hello', image })

    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe('/api/posts')
    expect(options.method).toBe('POST')
    expect(options.body).toBeInstanceOf(FormData)
    expect(options.body.get('body')).toBe('hello')
    expect(options.body.get('image')).toBe(image)
  })

  it('create omits the image field when no image is given', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ id: 1 }))

    await posts.create({ body: 'no image here' })

    expect(fetch.mock.calls[0][1].body.get('image')).toBeNull()
  })

  it('update sends a JSON PUT request', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ id: 1, body: 'edited' }))

    await posts.update(1, { body: 'edited' })

    expect(fetch).toHaveBeenCalledWith(
      '/api/posts/1',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ body: 'edited' }) })
    )
  })

  it('remove sends a DELETE request', async () => {
    fetch.mockResolvedValueOnce({ ok: true, status: 204, json: async () => null })

    await posts.remove(1)

    expect(fetch).toHaveBeenCalledWith('/api/posts/1', expect.objectContaining({ method: 'DELETE' }))
  })

  it('toggleLike posts to the likes endpoint', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ liked: true, likeCount: 1 }))

    const result = await posts.toggleLike(1)

    expect(fetch).toHaveBeenCalledWith('/api/posts/1/likes', expect.objectContaining({ method: 'POST' }))
    expect(result).toEqual({ liked: true, likeCount: 1 })
  })
})

describe('comments', () => {
  beforeEach(() => saveAuthToStorage())

  it('list fetches comments for a post', async () => {
    fetch.mockResolvedValueOnce(jsonResponse([{ id: 1, body: 'nice' }]))

    const result = await comments.list(5)

    expect(fetch).toHaveBeenCalledWith('/api/posts/5/comments', expect.anything())
    expect(result).toEqual([{ id: 1, body: 'nice' }])
  })

  it('create posts a JSON body', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ id: 1, body: 'nice' }))

    await comments.create(5, { body: 'nice' })

    expect(fetch).toHaveBeenCalledWith(
      '/api/posts/5/comments',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ body: 'nice' }) })
    )
  })
})

describe('users', () => {
  beforeEach(() => saveAuthToStorage())

  it('getProfile fetches the given user id', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ id: 2, username: 'bob' }))

    await users.getProfile(2)

    expect(fetch).toHaveBeenCalledWith('/api/users/2', expect.anything())
  })

  it('updateProfile sends username/bio/avatar as FormData', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ id: 1, username: 'alice', bio: 'hi' }))
    const avatar = new File(['bytes'], 'icon.png', { type: 'image/png' })

    await users.updateProfile({ username: 'alice', bio: 'hi', avatar })

    const options = fetch.mock.calls[0][1]
    expect(options.method).toBe('PUT')
    expect(options.body.get('username')).toBe('alice')
    expect(options.body.get('bio')).toBe('hi')
    expect(options.body.get('avatar')).toBe(avatar)
  })

  it('updateProfile sends an empty string for bio when not provided', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ id: 1, username: 'alice' }))

    await users.updateProfile({ username: 'alice' })

    expect(fetch.mock.calls[0][1].body.get('bio')).toBe('')
    expect(fetch.mock.calls[0][1].body.get('avatar')).toBeNull()
  })

  it('toggleFollow posts to the follow endpoint', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ following: true, followerCount: 1 }))

    const result = await users.toggleFollow(2)

    expect(fetch).toHaveBeenCalledWith('/api/users/2/follow', expect.objectContaining({ method: 'POST' }))
    expect(result.following).toBe(true)
  })

  it('search encodes the query string', async () => {
    fetch.mockResolvedValueOnce(jsonResponse([]))

    await users.search('foo bar')

    expect(fetch).toHaveBeenCalledWith('/api/users?query=foo%20bar', expect.anything())
  })
})
