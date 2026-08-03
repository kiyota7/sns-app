package com.snsapp.mapper;

import com.snsapp.model.User;
import com.snsapp.model.UserProfile;
import com.snsapp.model.UserSearchResult;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Optional;

@Mapper
public interface UserMapper {

    void insert(User user);

    Optional<User> findByEmail(@Param("email") String email);

    Optional<User> findByUsername(@Param("username") String username);

    Optional<User> findById(@Param("id") Long id);

    Optional<UserProfile> findProfileById(@Param("id") Long id, @Param("currentUserId") Long currentUserId);

    void updateProfile(
            @Param("id") Long id,
            @Param("username") String username,
            @Param("bio") String bio,
            @Param("avatarUrl") String avatarUrl
    );

    List<UserSearchResult> search(@Param("query") String query, @Param("currentUserId") Long currentUserId);
}
