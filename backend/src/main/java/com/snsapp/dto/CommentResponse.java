package com.snsapp.dto;

import com.snsapp.model.Comment;

public record CommentResponse(
        Long id,
        Long postId,
        Long userId,
        String username,
        String body,
        String createdAt
) {

    public static CommentResponse from(Comment comment) {
        return new CommentResponse(
                comment.getId(),
                comment.getPostId(),
                comment.getUserId(),
                comment.getUsername(),
                comment.getBody(),
                comment.getCreatedAt()
        );
    }
}
