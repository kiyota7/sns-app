package com.snsapp.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

import static com.snsapp.controller.support.AuthTestHelper.registerAndGetAccessToken;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class PostControllerTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;

    private String tokenFor(String username) throws Exception {
        return registerAndGetAccessToken(mockMvc, objectMapper, username, username + "@example.com", "password123");
    }

    private Long createPost(String token, String body) throws Exception {
        MvcResult result = mockMvc.perform(multipart("/api/posts")
                        .param("body", body)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        return json.get("id").asLong();
    }

    @Test
    void create_withoutImage_returnsCreatedPost() throws Exception {
        String token = tokenFor("alice");

        mockMvc.perform(multipart("/api/posts")
                        .param("body", "hello world")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.body").value("hello world"))
                .andExpect(jsonPath("$.imageUrl").doesNotExist());
    }

    @Test
    void create_withImage_storesAndReturnsImageUrl() throws Exception {
        String token = tokenFor("alice");
        MockMultipartFile image = new MockMultipartFile("image", "cat.jpg", "image/jpeg", "fake-bytes".getBytes());

        mockMvc.perform(multipart("/api/posts")
                        .file(image)
                        .param("body", "look at my cat")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.imageUrl").value(org.hamcrest.Matchers.startsWith("/uploads/")));
    }

    @Test
    void create_withoutAuth_returns401() throws Exception {
        mockMvc.perform(multipart("/api/posts").param("body", "no auth"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void list_returnsAllPostsNewestFirst() throws Exception {
        String token = tokenFor("alice");
        createPost(token, "first");
        createPost(token, "second");

        mockMvc.perform(get("/api/posts").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].body").value("second"))
                .andExpect(jsonPath("$.items[1].body").value("first"))
                .andExpect(jsonPath("$.hasMore").value(false));
    }

    @Test
    void list_limitCapsPageSizeAndReportsHasMore() throws Exception {
        String token = tokenFor("alice");
        createPost(token, "first");
        createPost(token, "second");
        createPost(token, "third");

        mockMvc.perform(get("/api/posts").param("limit", "2").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].body").value("third"))
                .andExpect(jsonPath("$.items[1].body").value("second"))
                .andExpect(jsonPath("$.hasMore").value(true));
    }

    @Test
    void list_cursorReturnsPostsOlderThanTheGivenId() throws Exception {
        String token = tokenFor("alice");
        createPost(token, "first");
        Long secondId = createPost(token, "second");
        createPost(token, "third");

        mockMvc.perform(get("/api/posts").param("cursor", secondId.toString()).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].body").value("first"))
                .andExpect(jsonPath("$.hasMore").value(false));
    }

    @Test
    void list_limitOutOfRange_returns400() throws Exception {
        String token = tokenFor("alice");

        mockMvc.perform(get("/api/posts").param("limit", "0").header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/posts").param("limit", "51").header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
    }

    @Test
    void getById_notFound_returns404() throws Exception {
        String token = tokenFor("alice");

        mockMvc.perform(get("/api/posts/999999").header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void update_byOwner_succeeds() throws Exception {
        String token = tokenFor("alice");
        Long postId = createPost(token, "original");

        String body = objectMapper.writeValueAsString(Map.of("body", "edited"));

        mockMvc.perform(put("/api/posts/" + postId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.body").value("edited"));
    }

    @Test
    void update_byNonOwner_returns403() throws Exception {
        String ownerToken = tokenFor("alice");
        String otherToken = tokenFor("bob");
        Long postId = createPost(ownerToken, "alice's post");

        String body = objectMapper.writeValueAsString(Map.of("body", "hacked"));

        mockMvc.perform(put("/api/posts/" + postId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .header("Authorization", "Bearer " + otherToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void delete_byOwner_succeedsAndPostIsGone() throws Exception {
        String token = tokenFor("alice");
        Long postId = createPost(token, "to delete");

        mockMvc.perform(delete("/api/posts/" + postId).header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/posts/" + postId).header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void delete_byNonOwner_returns403() throws Exception {
        String ownerToken = tokenFor("alice");
        String otherToken = tokenFor("bob");
        Long postId = createPost(ownerToken, "alice's post");

        mockMvc.perform(delete("/api/posts/" + postId).header("Authorization", "Bearer " + otherToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void toggleLike_likeThenUnlike() throws Exception {
        String token = tokenFor("alice");
        Long postId = createPost(token, "likeable");

        MvcResult likeResult = mockMvc.perform(post("/api/posts/" + postId + "/likes")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode likeJson = objectMapper.readTree(likeResult.getResponse().getContentAsString());
        assertThat(likeJson.get("liked").asBoolean()).isTrue();
        assertThat(likeJson.get("likeCount").asInt()).isEqualTo(1);

        MvcResult unlikeResult = mockMvc.perform(post("/api/posts/" + postId + "/likes")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode unlikeJson = objectMapper.readTree(unlikeResult.getResponse().getContentAsString());
        assertThat(unlikeJson.get("liked").asBoolean()).isFalse();
        assertThat(unlikeJson.get("likeCount").asInt()).isZero();
    }

    @Test
    void list_followingScope_onlyReturnsFollowedUsersPosts() throws Exception {
        String aliceToken = tokenFor("alice");
        String bobToken = tokenFor("bob");
        createPost(bobToken, "bob's post");

        // aliceのユーザーIDを取得してフォロー
        MvcResult meResult = mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + bobToken))
                .andReturn();
        Long bobId = objectMapper.readTree(meResult.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(post("/api/users/" + bobId + "/follow").header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/posts?scope=following").header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].body").value("bob's post"))
                .andExpect(jsonPath("$.items.length()").value(1));
    }
}
