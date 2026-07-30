package com.snsapp.dto;

import com.snsapp.model.User;

public record UserResponse(Long id, String username, String email, String bio) {

    public static UserResponse from(User user) {
        return new UserResponse(user.getId(), user.getUsername(), user.getEmail(), user.getBio());
    }
}
