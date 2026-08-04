package com.snsapp.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import static com.snsapp.controller.support.AuthTestHelper.registerAndGetAccessToken;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;

    private String tokenFor(String username) throws Exception {
        return registerAndGetAccessToken(mockMvc, objectMapper, username, username + "@example.com", "password123");
    }

    private Long idFor(String token) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token)).andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asLong();
    }

    @Test
    void getProfile_returnsProfileWithZeroCounts() throws Exception {
        String token = tokenFor("alice");
        Long aliceId = idFor(token);

        mockMvc.perform(get("/api/users/" + aliceId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("alice"))
                .andExpect(jsonPath("$.followerCount").value(0))
                .andExpect(jsonPath("$.followingCount").value(0));
    }

    @Test
    void getProfile_notFound_returns404() throws Exception {
        String token = tokenFor("alice");

        mockMvc.perform(get("/api/users/999999").header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void updateProfile_usernameAndBioOnly_updatesFields() throws Exception {
        String token = tokenFor("alice");

        mockMvc.perform(multipart(HttpMethod.PUT, "/api/users/me")
                        .param("username", "alice-renamed")
                        .param("bio", "hello, I am alice")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("alice-renamed"))
                .andExpect(jsonPath("$.bio").value("hello, I am alice"));
    }

    @Test
    void updateProfile_withAvatar_setsAvatarUrl() throws Exception {
        String token = tokenFor("alice");
        MockMultipartFile avatar = new MockMultipartFile("avatar", "icon.png", "image/png", "bytes".getBytes());

        mockMvc.perform(multipart(HttpMethod.PUT, "/api/users/me")
                        .file(avatar)
                        .param("username", "alice")
                        .param("bio", "")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatarUrl").value(org.hamcrest.Matchers.startsWith("/uploads/")));
    }

    @Test
    void updateProfile_editAgainWithoutAvatar_keepsExistingAvatarUrl() throws Exception {
        String token = tokenFor("alice");
        MockMultipartFile avatar = new MockMultipartFile("avatar", "icon.png", "image/png", "bytes".getBytes());
        mockMvc.perform(multipart(HttpMethod.PUT, "/api/users/me")
                        .file(avatar)
                        .param("username", "alice")
                        .param("bio", "first bio")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        mockMvc.perform(multipart(HttpMethod.PUT, "/api/users/me")
                        .param("username", "alice")
                        .param("bio", "second bio")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bio").value("second bio"))
                .andExpect(jsonPath("$.avatarUrl").value(org.hamcrest.Matchers.startsWith("/uploads/")));
    }

    @Test
    void updateProfile_duplicateUsername_returns409() throws Exception {
        tokenFor("alice");
        String bobToken = tokenFor("bob");

        mockMvc.perform(multipart(HttpMethod.PUT, "/api/users/me")
                        .param("username", "alice")
                        .param("bio", "")
                        .header("Authorization", "Bearer " + bobToken))
                .andExpect(status().isConflict());
    }

    @Test
    void updateProfile_blankUsername_returns400() throws Exception {
        String token = tokenFor("alice");

        mockMvc.perform(multipart(HttpMethod.PUT, "/api/users/me")
                        .param("username", "")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
    }

    @Test
    void toggleFollow_followThenUnfollow() throws Exception {
        String aliceToken = tokenFor("alice");
        String bobToken = tokenFor("bob");
        Long bobId = idFor(bobToken);

        MvcResult followResult = mockMvc.perform(post("/api/users/" + bobId + "/follow")
                        .header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode followJson = objectMapper.readTree(followResult.getResponse().getContentAsString());
        org.assertj.core.api.Assertions.assertThat(followJson.get("following").asBoolean()).isTrue();
        org.assertj.core.api.Assertions.assertThat(followJson.get("followerCount").asInt()).isEqualTo(1);

        MvcResult unfollowResult = mockMvc.perform(post("/api/users/" + bobId + "/follow")
                        .header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode unfollowJson = objectMapper.readTree(unfollowResult.getResponse().getContentAsString());
        org.assertj.core.api.Assertions.assertThat(unfollowJson.get("following").asBoolean()).isFalse();
    }

    @Test
    void toggleFollow_self_returns400() throws Exception {
        String token = tokenFor("alice");
        Long aliceId = idFor(token);

        mockMvc.perform(post("/api/users/" + aliceId + "/follow").header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
    }

    @Test
    void search_findsUsersByPartialUsername() throws Exception {
        String token = tokenFor("alice");
        tokenFor("alicia");
        tokenFor("bob");

        mockMvc.perform(get("/api/users?query=ali").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].username").value("alicia"))
                .andExpect(jsonPath("$.length()").value(1));
    }
}
