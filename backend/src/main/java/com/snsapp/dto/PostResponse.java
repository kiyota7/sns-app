package com.snsapp.dto;

import com.snsapp.model.Post;

public record PostResponse(
        Long id,
        Long userId,
        String username,
        String body,
        String imageUrl,
        String createdAt,
        String updatedAt
) {

    public static PostResponse from(Post post) {
        return new PostResponse(
                post.getId(),
                post.getUserId(),
                post.getUsername(),
                post.getBody(),
                post.getImageUrl(),
                post.getCreatedAt(),
                post.getUpdatedAt()
        );
    }
}
