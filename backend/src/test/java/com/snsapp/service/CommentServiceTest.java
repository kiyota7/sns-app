package com.snsapp.service;

import com.snsapp.dto.CommentResponse;
import com.snsapp.exception.PostNotFoundException;
import com.snsapp.mapper.CommentMapper;
import com.snsapp.mapper.PostMapper;
import com.snsapp.model.Comment;
import com.snsapp.model.Post;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CommentServiceTest {

    @Mock
    private CommentMapper commentMapper;
    @Mock
    private PostMapper postMapper;

    @InjectMocks
    private CommentService commentService;

    @Test
    void list_postExists_returnsMappedComments() {
        when(postMapper.findById(1L, null)).thenReturn(Optional.of(new Post()));
        Comment comment = new Comment();
        comment.setId(1L);
        comment.setPostId(1L);
        comment.setBody("nice post");
        when(commentMapper.findByPostIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(comment));

        List<CommentResponse> result = commentService.list(1L);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).body()).isEqualTo("nice post");
    }

    @Test
    void list_postNotFound_throwsPostNotFoundException() {
        when(postMapper.findById(99L, null)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> commentService.list(99L))
                .isInstanceOf(PostNotFoundException.class);
    }

    @Test
    void create_postExists_insertsAndReturnsComment() {
        when(postMapper.findById(1L, null)).thenReturn(Optional.of(new Post()));
        Comment saved = new Comment();
        saved.setId(5L);
        saved.setPostId(1L);
        saved.setUserId(9L);
        saved.setBody("hello");
        when(commentMapper.findById(any())).thenReturn(Optional.of(saved));

        CommentResponse response = commentService.create(1L, 9L, "hello");

        assertThat(response.id()).isEqualTo(5L);
        verify(commentMapper).insert(any(Comment.class));
    }

    @Test
    void create_postNotFound_throwsAndDoesNotInsert() {
        when(postMapper.findById(99L, null)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> commentService.create(99L, 9L, "hello"))
                .isInstanceOf(PostNotFoundException.class);
        verify(commentMapper, never()).insert(any());
    }
}
