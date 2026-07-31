package com.snsapp.service;

import com.snsapp.dto.CommentResponse;
import com.snsapp.exception.PostNotFoundException;
import com.snsapp.mapper.CommentMapper;
import com.snsapp.mapper.PostMapper;
import com.snsapp.model.Comment;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class CommentService {

    private final CommentMapper commentMapper;
    private final PostMapper postMapper;

    public CommentService(CommentMapper commentMapper, PostMapper postMapper) {
        this.commentMapper = commentMapper;
        this.postMapper = postMapper;
    }

    public List<CommentResponse> list(Long postId) {
        requirePostExists(postId);
        return commentMapper.findByPostIdOrderByCreatedAtDesc(postId).stream()
                .map(CommentResponse::from)
                .collect(Collectors.toList());
    }

    public CommentResponse create(Long postId, Long userId, String body) {
        requirePostExists(postId);

        Comment comment = new Comment();
        comment.setPostId(postId);
        comment.setUserId(userId);
        comment.setBody(body);
        commentMapper.insert(comment);

        return CommentResponse.from(commentMapper.findById(comment.getId()).orElseThrow());
    }

    private void requirePostExists(Long postId) {
        postMapper.findById(postId, null)
                .orElseThrow(() -> new PostNotFoundException("投稿が見つかりません。"));
    }
}
