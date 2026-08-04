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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserMapper userMapper;
    @Mock
    private TokenBlacklistMapper tokenBlacklistMapper;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private JwtService jwtService;

    @InjectMocks
    private AuthService authService;

    private User existingUser;

    @BeforeEach
    void setUp() {
        existingUser = new User();
        existingUser.setId(1L);
        existingUser.setUsername("alice");
        existingUser.setEmail("alice@example.com");
        existingUser.setPasswordHash("hashed-password");
    }

    @Test
    void register_createsUserAndReturnsTokens() {
        RegisterRequest request = new RegisterRequest();
        request.setUsername("alice");
        request.setEmail("alice@example.com");
        request.setPassword("password123");

        when(userMapper.findByUsername("alice")).thenReturn(Optional.empty());
        when(userMapper.findByEmail("alice@example.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("password123")).thenReturn("hashed-password");
        when(jwtService.generateAccessToken(any(), eq("alice"))).thenReturn("access-token");
        when(jwtService.generateRefreshToken(any(), eq("alice"))).thenReturn("refresh-token");

        AuthResponse response = authService.register(request);

        assertThat(response.accessToken()).isEqualTo("access-token");
        assertThat(response.refreshToken()).isEqualTo("refresh-token");
        assertThat(response.user().username()).isEqualTo("alice");
        verify(userMapper).insert(any(User.class));
    }

    @Test
    void register_duplicateUsername_throwsWithoutInserting() {
        RegisterRequest request = new RegisterRequest();
        request.setUsername("alice");
        request.setEmail("new@example.com");
        request.setPassword("password123");

        when(userMapper.findByUsername("alice")).thenReturn(Optional.of(existingUser));

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(DuplicateUserException.class);
        verify(userMapper, never()).insert(any());
    }

    @Test
    void register_duplicateEmail_throwsWithoutInserting() {
        RegisterRequest request = new RegisterRequest();
        request.setUsername("newname");
        request.setEmail("alice@example.com");
        request.setPassword("password123");

        when(userMapper.findByUsername("newname")).thenReturn(Optional.empty());
        when(userMapper.findByEmail("alice@example.com")).thenReturn(Optional.of(existingUser));

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(DuplicateUserException.class);
        verify(userMapper, never()).insert(any());
    }

    @Test
    void login_correctPassword_returnsTokens() {
        LoginRequest request = new LoginRequest();
        request.setEmail("alice@example.com");
        request.setPassword("password123");

        when(userMapper.findByEmail("alice@example.com")).thenReturn(Optional.of(existingUser));
        when(passwordEncoder.matches("password123", "hashed-password")).thenReturn(true);
        when(jwtService.generateAccessToken(any(), anyString())).thenReturn("access-token");
        when(jwtService.generateRefreshToken(any(), anyString())).thenReturn("refresh-token");

        AuthResponse response = authService.login(request);

        assertThat(response.accessToken()).isEqualTo("access-token");
    }

    @Test
    void login_wrongPassword_throwsInvalidCredentials() {
        LoginRequest request = new LoginRequest();
        request.setEmail("alice@example.com");
        request.setPassword("wrong-password");

        when(userMapper.findByEmail("alice@example.com")).thenReturn(Optional.of(existingUser));
        when(passwordEncoder.matches("wrong-password", "hashed-password")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void login_unknownEmail_throwsInvalidCredentials() {
        LoginRequest request = new LoginRequest();
        request.setEmail("nobody@example.com");
        request.setPassword("password123");

        when(userMapper.findByEmail("nobody@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void refresh_validToken_blacklistsOldAndIssuesNewTokens() {
        Claims claims = claimsOf(1L, "alice", JwtService.TYPE_REFRESH, "old-jti");
        when(jwtService.parseClaims("valid-refresh-token")).thenReturn(claims);
        when(tokenBlacklistMapper.existsByJti("old-jti")).thenReturn(false);
        when(jwtService.generateAccessToken(1L, "alice")).thenReturn("new-access-token");
        when(jwtService.generateRefreshToken(1L, "alice")).thenReturn("new-refresh-token");

        RefreshResponse response = authService.refresh("valid-refresh-token");

        assertThat(response.accessToken()).isEqualTo("new-access-token");
        assertThat(response.refreshToken()).isEqualTo("new-refresh-token");
        verify(tokenBlacklistMapper).insert(eq("old-jti"), anyString());
    }

    @Test
    void refresh_blacklistedToken_throwsInvalidCredentials() {
        Claims claims = claimsOf(1L, "alice", JwtService.TYPE_REFRESH, "reused-jti");
        when(jwtService.parseClaims("reused-token")).thenReturn(claims);
        when(tokenBlacklistMapper.existsByJti("reused-jti")).thenReturn(true);

        assertThatThrownBy(() -> authService.refresh("reused-token"))
                .isInstanceOf(InvalidCredentialsException.class);
        verify(jwtService, never()).generateAccessToken(any(), anyString());
    }

    @Test
    void refresh_accessTokenPassedInstead_throwsInvalidCredentials() {
        Claims claims = claimsOf(1L, "alice", JwtService.TYPE_ACCESS, "access-jti");
        when(jwtService.parseClaims("access-token-not-refresh")).thenReturn(claims);

        assertThatThrownBy(() -> authService.refresh("access-token-not-refresh"))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void logout_blacklistsAccessAndRefreshTokens() {
        Claims accessClaims = claimsOf(1L, "alice", JwtService.TYPE_ACCESS, "access-jti");
        Claims refreshClaims = claimsOf(1L, "alice", JwtService.TYPE_REFRESH, "refresh-jti");
        when(jwtService.parseClaims("access-token")).thenReturn(accessClaims);
        when(jwtService.parseClaims("refresh-token")).thenReturn(refreshClaims);

        authService.logout("access-token", "refresh-token");

        verify(tokenBlacklistMapper).insert(eq("access-jti"), anyString());
        verify(tokenBlacklistMapper).insert(eq("refresh-jti"), anyString());
    }

    @Test
    void logout_withoutRefreshToken_onlyBlacklistsAccessToken() {
        Claims accessClaims = claimsOf(1L, "alice", JwtService.TYPE_ACCESS, "access-jti");
        when(jwtService.parseClaims("access-token")).thenReturn(accessClaims);

        authService.logout("access-token", null);

        verify(tokenBlacklistMapper).insert(eq("access-jti"), anyString());
        verify(tokenBlacklistMapper, never()).insert(eq("refresh-jti"), anyString());
    }

    @Test
    void getCurrentUser_returnsUserResponse() {
        when(userMapper.findById(1L)).thenReturn(Optional.of(existingUser));

        UserResponse response = authService.getCurrentUser(1L);

        assertThat(response.username()).isEqualTo("alice");
    }

    @Test
    void getCurrentUser_unknownId_throwsInvalidCredentials() {
        when(userMapper.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.getCurrentUser(999L))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    private Claims claimsOf(Long userId, String username, String type, String jti) {
        Map<String, Object> data = new HashMap<>();
        data.put("userId", userId);
        data.put("type", type);
        return new io.jsonwebtoken.impl.DefaultClaims(data) {
            @Override
            public String getSubject() {
                return username;
            }

            @Override
            public String getId() {
                return jti;
            }

            @Override
            public Date getExpiration() {
                return new Date(System.currentTimeMillis() + 60_000);
            }
        };
    }
}
