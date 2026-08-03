package com.snsapp.dto;

import com.snsapp.model.UserProfile;

public record ProfileResponse(
        Long id,
        String username,
        String bio,
        String avatarUrl,
        int followerCount,
        int followingCount,
        boolean following
) {

    public static ProfileResponse from(UserProfile profile) {
        return new ProfileResponse(
                profile.getId(),
                profile.getUsername(),
                profile.getBio(),
                profile.getAvatarUrl(),
                profile.getFollowerCount(),
                profile.getFollowingCount(),
                profile.isFollowedByCurrentUser()
        );
    }
}
