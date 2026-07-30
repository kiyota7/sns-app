package com.snsapp.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface TokenBlacklistMapper {

    void insert(@Param("jti") String jti, @Param("expiresAt") String expiresAt);

    boolean existsByJti(@Param("jti") String jti);

    void deleteExpired(@Param("now") String now);
}
