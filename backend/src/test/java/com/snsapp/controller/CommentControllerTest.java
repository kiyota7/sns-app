package com.snsapp.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

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
class CommentControllerTest {

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
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asLong();
    }

    @Test
    void create_addsCommentToPost() throws Exception {
        String token = tokenFor("alice");
        Long postId = createPost(token, "a post to comment on");
        String body = objectMapper.writeValueAsString(Map.of("body", "nice post!"));

        mockMvc.perform(post("/api/posts/" + postId + "/comments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.body").value("nice post!"))
                .andExpect(jsonPath("$.username").value("alice"));
    }

    @Test
    void create_onNonExistentPost_returns404() throws Exception {
        String token = tokenFor("alice");
        String body = objectMapper.writeValueAsString(Map.of("body", "comment on nothing"));

        mockMvc.perform(post("/api/posts/999999/comments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void create_blankBody_returns400() throws Exception {
        String token = tokenFor("alice");
        Long postId = createPost(token, "a post");
        String body = objectMapper.writeValueAsString(Map.of("body", ""));

        mockMvc.perform(post("/api/posts/" + postId + "/comments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
    }

    @Test
    void list_returnsCommentsNewestFirst() throws Exception {
        String token = tokenFor("alice");
        Long postId = createPost(token, "a post");
        mockMvc.perform(post("/api/posts/" + postId + "/comments")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("body", "first")))
                .header("Authorization", "Bearer " + token));
        Thread.sleep(10);
        mockMvc.perform(post("/api/posts/" + postId + "/comments")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("body", "second")))
                .header("Authorization", "Bearer " + token));

        mockMvc.perform(get("/api/posts/" + postId + "/comments").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].body").value("second"))
                .andExpect(jsonPath("$[1].body").value("first"));
    }

    @Test
    void list_nonExistentPost_returns404() throws Exception {
        String token = tokenFor("alice");

        mockMvc.perform(get("/api/posts/999999/comments").header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }
}
