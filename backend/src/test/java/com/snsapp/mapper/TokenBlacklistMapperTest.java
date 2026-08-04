package com.snsapp.mapper;

import org.junit.jupiter.api.Test;
import org.mybatis.spring.boot.test.autoconfigure.MybatisTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

@MybatisTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class TokenBlacklistMapperTest {

    @Autowired
    private TokenBlacklistMapper tokenBlacklistMapper;

    @Test
    void insertAndExistsByJti_reflectsInsertedToken() {
        assertThat(tokenBlacklistMapper.existsByJti("jti-1")).isFalse();

        tokenBlacklistMapper.insert("jti-1", Instant.now().plusSeconds(3600).toString());

        assertThat(tokenBlacklistMapper.existsByJti("jti-1")).isTrue();
        assertThat(tokenBlacklistMapper.existsByJti("jti-unknown")).isFalse();
    }

    @Test
    void deleteExpired_removesOnlyTokensExpiredBeforeGivenTime() {
        Instant now = Instant.now();
        tokenBlacklistMapper.insert("expired-jti", now.minusSeconds(3600).toString());
        tokenBlacklistMapper.insert("still-valid-jti", now.plusSeconds(3600).toString());

        tokenBlacklistMapper.deleteExpired(now.toString());

        assertThat(tokenBlacklistMapper.existsByJti("expired-jti")).isFalse();
        assertThat(tokenBlacklistMapper.existsByJti("still-valid-jti")).isTrue();
    }
}
