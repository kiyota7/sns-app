package com.snsapp.security;

/**
 * JWT検証に成功したリクエストの認証プリンシパルとして
 * SecurityContextに格納する、最小限のユーザー情報。
 */
public record AuthenticatedUser(Long id, String username) {
}
