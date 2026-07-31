package com.snsapp.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface LikeMapper {

    boolean existsByPostIdAndUserId(@Param("postId") Long postId, @Param("userId") Long userId);

    void insert(@Param("postId") Long postId, @Param("userId") Long userId);

    void delete(@Param("postId") Long postId, @Param("userId") Long userId);

    void deleteByPostId(@Param("postId") Long postId);

    int countByPostId(@Param("postId") Long postId);
}
