package com.snsapp.mapper;

import com.snsapp.model.Post;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Optional;

@Mapper
public interface PostMapper {

    void insert(Post post);

    List<Post> findAllOrderByCreatedAtDesc(
            @Param("currentUserId") Long currentUserId,
            @Param("cursor") Long cursor,
            @Param("fetchLimit") int fetchLimit
    );

    List<Post> findByUserIdOrderByCreatedAtDesc(@Param("userId") Long userId, @Param("currentUserId") Long currentUserId);

    List<Post> findFollowingOrderByCreatedAtDesc(
            @Param("currentUserId") Long currentUserId,
            @Param("cursor") Long cursor,
            @Param("fetchLimit") int fetchLimit
    );

    Optional<Post> findById(@Param("id") Long id, @Param("currentUserId") Long currentUserId);

    void update(@Param("id") Long id, @Param("body") String body);

    void delete(@Param("id") Long id);
}
