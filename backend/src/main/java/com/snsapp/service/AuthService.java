package com.snsapp.service;

import com.snsapp.dto.AuthResponse;
import com.snsapp.dto.LoginRequest;
import com.snsapp.dto.RegisterRequest;
import com.snsapp.dto.UserResponse;
import com.snsapp.exception.DuplicateUserException;
import com.snsapp.exception.InvalidCredentialsException;
import com.snsapp.mapper.TokenBlacklistMapper;
import com.snsapp.mapper.UserMapper;
import com.snsapp.model.User;
import com.snsapp.security.JwtService;
import io.jsonwebtoken.Claims;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;

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

    public void logout(String token) {
        Claims claims = jwtService.parseClaims(token);
        String jti = claims.getId();
        Instant expiresAt = claims.getExpiration().toInstant();
        tokenBlacklistMapper.insert(jti, expiresAt.toString());
    }

    public UserResponse getCurrentUser(Long userId) {
        User user = userMapper.findById(userId)
                .orElseThrow(() -> new InvalidCredentialsException("ユーザーが見つかりません。"));
        return UserResponse.from(user);
    }

    private AuthResponse buildAuthResponse(User user) {
        String token = jwtService.generateToken(user.getId(), user.getUsername());
        return new AuthResponse(token, UserResponse.from(user));
    }
}
