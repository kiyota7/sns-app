package com.snsapp.mapper;

import com.snsapp.model.Post;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Optional;

@Mapper
public interface PostMapper {

    void insert(Post post);

    List<Post> findAllOrderByCreatedAtDesc();

    Optional<Post> findById(@Param("id") Long id);

    void update(@Param("id") Long id, @Param("body") String body);

    void delete(@Param("id") Long id);
}
