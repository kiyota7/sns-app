package com.snsapp.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

import static com.snsapp.controller.support.AuthTestHelper.register;
import static com.snsapp.controller.support.AuthTestHelper.registerAndGetAccessToken;
import static org.hamcrest.Matchers.blankOrNullString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 実際のHTTPリクエスト〜レスポンス、JWT認証フィルタ、DBまで含めた統合テスト
 * (これまで手動でcurl確認していた内容の自動化)。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void register_createsUserAndReturnsTokens() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "username", "alice",
                "email", "alice@example.com",
                "password", "password123"
        ));

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accessToken", not(blankOrNullString())))
                .andExpect(jsonPath("$.refreshToken", not(blankOrNullString())))
                .andExpect(jsonPath("$.user.username").value("alice"));
    }

    @Test
    void register_duplicateEmail_returns409() throws Exception {
        register(mockMvc, objectMapper, "alice", "dup@example.com", "password123");

        String body = objectMapper.writeValueAsString(Map.of(
                "username", "someoneelse",
                "email", "dup@example.com",
                "password", "password123"
        ));

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict());
    }

    @Test
    void register_invalidPayload_returns400() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "username", "",
                "email", "not-an-email",
                "password", "short"
        ));

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void login_correctCredentials_returnsTokens() throws Exception {
        register(mockMvc, objectMapper, "bob", "bob@example.com", "password123");

        String body = objectMapper.writeValueAsString(Map.of(
                "email", "bob@example.com",
                "password", "password123"
        ));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.email").value("bob@example.com"));
    }

    @Test
    void login_wrongPassword_returns401() throws Exception {
        register(mockMvc, objectMapper, "carol", "carol@example.com", "password123");

        String body = objectMapper.writeValueAsString(Map.of(
                "email", "carol@example.com",
                "password", "wrong-password"
        ));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void me_withValidAccessToken_returnsCurrentUser() throws Exception {
        String token = registerAndGetAccessToken(mockMvc, objectMapper, "dave", "dave@example.com", "password123");

        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("dave"));
    }

    @Test
    void me_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void me_withInvalidToken_returns401() throws Exception {
        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer not-a-real-token"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void refresh_validRefreshToken_issuesNewTokenPairAndRotatesOldOne() throws Exception {
        JsonNode auth = register(mockMvc, objectMapper, "erin", "erin@example.com", "password123");
        String refreshToken = auth.get("refreshToken").asText();

        String refreshBody = objectMapper.writeValueAsString(Map.of("refreshToken", refreshToken));

        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(refreshBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken", not(blankOrNullString())));

        // 同じリフレッシュトークンは使用済みになり、再利用できない
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(refreshBody))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logout_thenAccessTokenIsRejected() throws Exception {
        String token = registerAndGetAccessToken(mockMvc, objectMapper, "frank", "frank@example.com", "password123");

        mockMvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }
}
