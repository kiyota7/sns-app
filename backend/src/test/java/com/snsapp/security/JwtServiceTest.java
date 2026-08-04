package com.snsapp.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.security.SignatureException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private static final String SECRET = "unit-test-secret-key-0123456789abcdefghijklmn";

    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService(SECRET, 900_000L, 604_800_000L);
    }

    @Test
    void generateAccessToken_containsExpectedClaims() {
        String token = jwtService.generateAccessToken(42L, "alice");

        Claims claims = jwtService.parseClaims(token);

        assertThat(claims.getSubject()).isEqualTo("alice");
        assertThat(((Number) claims.get("userId")).longValue()).isEqualTo(42L);
        assertThat(claims.get("type")).isEqualTo(JwtService.TYPE_ACCESS);
        assertThat(claims.getId()).isNotBlank();
    }

    @Test
    void generateRefreshToken_hasRefreshType() {
        String token = jwtService.generateRefreshToken(1L, "bob");

        Claims claims = jwtService.parseClaims(token);

        assertThat(claims.get("type")).isEqualTo(JwtService.TYPE_REFRESH);
    }

    @Test
    void parseClaims_rejectsTokenSignedWithDifferentSecret() {
        JwtService otherService = new JwtService(
                "a-completely-different-secret-key-0123456789ab", 900_000L, 604_800_000L);
        String token = otherService.generateAccessToken(1L, "eve");

        assertThatThrownBy(() -> jwtService.parseClaims(token))
                .isInstanceOf(SignatureException.class);
    }

    @Test
    void parseClaims_rejectsExpiredToken() {
        JwtService shortLivedService = new JwtService(SECRET, -1_000L, 604_800_000L);
        String expiredToken = shortLivedService.generateAccessToken(1L, "carol");

        assertThatThrownBy(() -> jwtService.parseClaims(expiredToken))
                .isInstanceOf(ExpiredJwtException.class);
    }

    @Test
    void parseClaims_rejectsGarbageToken() {
        assertThatThrownBy(() -> jwtService.parseClaims("not-a-jwt"))
                .isInstanceOf(JwtException.class);
    }
}
