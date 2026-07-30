package com.snsapp.service;

import com.snsapp.dto.AuthResponse;
import com.snsapp.dto.LoginRequest;
import com.snsapp.dto.RefreshResponse;
import com.snsapp.dto.RegisterRequest;
import com.snsapp.dto.UserResponse;
import com.snsapp.exception.DuplicateUserException;
import com.snsapp.exception.InvalidCredentialsException;
import com.snsapp.mapper.TokenBlacklistMapper;
import com.snsapp.mapper.UserMapper;
import com.snsapp.model.User;
import com.snsapp.security.JwtService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserMapper userMapper;
    private final TokenBlacklistMapper tokenBlacklistMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(
            UserMapper userMapper,
            TokenBlacklistMapper tokenBlacklistMapper,
            PasswordEncoder passwordEncoder,
            JwtService jwtService
    ) {
        this.userMapper = userMapper;
        this.tokenBlacklistMapper = tokenBlacklistMapper;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public AuthResponse register(RegisterRequest request) {
        if (userMapper.findByUsername(request.getUsername()).isPresent()) {
            throw new DuplicateUserException("そのユーザー名は既に使われています。");
        }
        if (userMapper.findByEmail(request.getEmail()).isPresent()) {
            throw new DuplicateUserException("そのメールアドレスは既に登録されています。");
        }

        User user = new User();
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        userMapper.insert(user);

        return buildAuthResponse(user);
    }

    public AuthResponse login(LoginRequest request) {
        User user = userMapper.findByEmail(request.getEmail())
                .orElseThrow(() -> new InvalidCredentialsException("メールアドレスまたはパスワードが正しくありません。"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new InvalidCredentialsException("メールアドレスまたはパスワードが正しくありません。");
        }

        return buildAuthResponse(user);
    }

    /**
     * リフレッシュトークンを検証し、新しいアクセストークン・リフレッシュトークンの組を発行する。
     * 使用済みのリフレッシュトークンはその場でblacklistに登録し(ローテーション)、
     * 同じリフレッシュトークンを再利用できないようにする。
     */
    public RefreshResponse refresh(String refreshToken) {
        Claims claims = parseValidRefreshClaims(refreshToken);

        Long userId = ((Number) claims.get("userId")).longValue();
        String username = claims.getSubject();

        blacklist(claims);

        String newAccessToken = jwtService.generateAccessToken(userId, username);
        String newRefreshToken = jwtService.generateRefreshToken(userId, username);
        return new RefreshResponse(newAccessToken, newRefreshToken);
    }

    /**
     * アクセストークン・リフレッシュトークンの両方をblacklistに登録し、ログアウトさせる。
     * リフレッシュトークンは省略可能(渡された場合のみ無効化する)。
     */
    public void logout(String accessToken, String refreshToken) {
        blacklist(jwtService.parseClaims(accessToken));

        if (refreshToken != null && !refreshToken.isBlank()) {
            try {
                blacklist(jwtService.parseClaims(refreshToken));
            } catch (JwtException ignored) {
                // 既に期限切れ・不正なリフレッシュトークンは無視してよい(どのみち使えない)
            }
        }
    }

    public UserResponse getCurrentUser(Long userId) {
        User user = userMapper.findById(userId)
                .orElseThrow(() -> new InvalidCredentialsException("ユーザーが見つかりません。"));
        return UserResponse.from(user);
    }

    private Claims parseValidRefreshClaims(String refreshToken) {
        Claims claims;
        try {
            claims = jwtService.parseClaims(refreshToken);
        } catch (JwtException e) {
            throw new InvalidCredentialsException("リフレッシュトークンが無効です。再度ログインしてください。");
        }

        if (!JwtService.TYPE_REFRESH.equals(claims.get("type"))) {
            throw new InvalidCredentialsException("リフレッシュトークンが無効です。再度ログインしてください。");
        }
        if (tokenBlacklistMapper.existsByJti(claims.getId())) {
            throw new InvalidCredentialsException("リフレッシュトークンが無効です。再度ログインしてください。");
        }
        return claims;
    }

    private void blacklist(Claims claims) {
        tokenBlacklistMapper.insert(claims.getId(), claims.getExpiration().toInstant().toString());
    }

    private AuthResponse buildAuthResponse(User user) {
        String accessToken = jwtService.generateAccessToken(user.getId(), user.getUsername());
        String refreshToken = jwtService.generateRefreshToken(user.getId(), user.getUsername());
        return new AuthResponse(accessToken, refreshToken, UserResponse.from(user));
    }
}
