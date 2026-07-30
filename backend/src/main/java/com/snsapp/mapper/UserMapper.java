package com.snsapp.mapper;

import com.snsapp.model.User;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.Optional;

@Mapper
public interface UserMapper {

    void insert(User user);

    Optional<User> findByEmail(@Param("email") String email);

    Optional<User> findByUsername(@Param("username") String username);

    Optional<User> findById(@Param("id") Long id);
}
