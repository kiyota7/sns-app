package com.snsapp.dto;

import com.snsapp.model.UserSearchResult;

public record UserSearchResponse(Long id, String username, boolean following) {

    public static UserSearchResponse from(UserSearchResult result) {
        return new UserSearchResponse(result.getId(), result.getUsername(), result.isFollowedByCurrentUser());
    }
}
