package com.snsapp.mapper;

import com.snsapp.model.Comment;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Optional;

@Mapper
public interface CommentMapper {

    void insert(Comment comment);

    Optional<Comment> findById(@Param("id") Long id);

    List<Comment> findByPostIdOrderByCreatedAtDesc(@Param("postId") Long postId);

    void deleteByPostId(@Param("postId") Long postId);
}
