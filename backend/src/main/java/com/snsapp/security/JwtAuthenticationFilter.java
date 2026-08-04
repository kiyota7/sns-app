package com.snsapp.security;

import com.snsapp.mapper.TokenBlacklistMapper;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final TokenBlacklistMapper tokenBlacklistMapper;

    public JwtAuthenticationFilter(JwtService jwtService, TokenBlacklistMapper tokenBlacklistMapper) {
        this.jwtService = jwtService;
        this.tokenBlacklistMapper = tokenBlacklistMapper;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        String header = request.getHeader("Authorization");

        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring("Bearer ".length());
            try {
                Claims claims = jwtService.parseClaims(token);
                String jti = claims.getId();
                boolean isAccessToken = JwtService.TYPE_ACCESS.equals(claims.get("type"));

                if (isAccessToken && !tokenBlacklistMapper.existsByJti(jti)) {
                    Long userId = ((Number) claims.get("userId")).longValue();
                    String username = claims.getSubject();
                    AuthenticatedUser principal = new AuthenticatedUser(userId, username);

                    var authentication = new UsernamePasswordAuthenticationToken(principal, null, java.util.List.of());
                    SecurityContextHolder.getContext().setAuthentication(authentication);

                    // 以降このリクエスト内の全ログ行にuser_idが自動付与される
                    // (RequestLoggingFilterがリクエスト完了時にMDCをクリアする)
                    MDC.put("user_id", String.valueOf(userId));
                }
                // リフレッシュトークンが渡された場合、およびblacklist登録済み(ログアウト済み)の
                // アクセストークンの場合は認証を設定せず、未認証のまま後続処理へ進む
            } catch (JwtException | IllegalArgumentException e) {
                // 署名不正・期限切れ等はそのまま未認証として扱う(401はSecurityConfig側のentry pointが返す)
            }
        }

        filterChain.doFilter(request, response);
    }
}
