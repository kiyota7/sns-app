package com.snsapp.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface FollowMapper {

    boolean existsByFollowerAndFollowed(@Param("followerId") Long followerId, @Param("followedId") Long followedId);

    void insert(@Param("followerId") Long followerId, @Param("followedId") Long followedId);

    void delete(@Param("followerId") Long followerId, @Param("followedId") Long followedId);
}
