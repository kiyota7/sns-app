package com.snsapp.controller.support;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * コントローラーの統合テストで、実際に/api/auth/registerを叩いてアクセストークンを
 * 取得するための共通ヘルパー。JWT認証込みのエンドポイントをMockMvcから叩く際に使う。
 */
public final class AuthTestHelper {

    private AuthTestHelper() {
    }

    public static JsonNode register(
            MockMvc mockMvc, ObjectMapper objectMapper, String username, String email, String password
    ) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "username", username,
                "email", email,
                "password", password
        ));

        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn();

        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    public static String registerAndGetAccessToken(
            MockMvc mockMvc, ObjectMapper objectMapper, String username, String email, String password
    ) throws Exception {
        return register(mockMvc, objectMapper, username, email, password).get("accessToken").asText();
    }
}
