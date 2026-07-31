package com.snsapp.service;

import com.snsapp.dto.FollowResponse;
import com.snsapp.dto.PostResponse;
import com.snsapp.dto.ProfileResponse;
import com.snsapp.exception.DuplicateUserException;
import com.snsapp.exception.SelfFollowException;
import com.snsapp.exception.UserNotFoundException;
import com.snsapp.mapper.FollowMapper;
import com.snsapp.mapper.PostMapper;
import com.snsapp.mapper.UserMapper;
import com.snsapp.model.UserProfile;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class UserService {

    private final UserMapper userMapper;
    private final PostMapper postMapper;
    private final FollowMapper followMapper;

    public UserService(UserMapper userMapper, PostMapper postMapper, FollowMapper followMapper) {
        this.userMapper = userMapper;
        this.postMapper = postMapper;
        this.followMapper = followMapper;
    }

    public ProfileResponse getProfile(Long userId, Long currentUserId) {
        return ProfileResponse.from(findProfileOrThrow(userId, currentUserId));
    }

    public List<PostResponse> getPosts(Long userId, Long currentUserId) {
        return postMapper.findByUserIdOrderByCreatedAtDesc(userId, currentUserId).stream()
                .map(PostResponse::from)
                .collect(Collectors.toList());
    }

    public ProfileResponse updateProfile(Long userId, String username, String bio) {
        userMapper.findByUsername(username)
                .filter(existing -> !existing.getId().equals(userId))
                .ifPresent(existing -> {
                    throw new DuplicateUserException("そのユーザー名は既に使われています。");
                });

        userMapper.updateProfile(userId, username, bio);

        return ProfileResponse.from(findProfileOrThrow(userId, userId));
    }

    public FollowResponse toggleFollow(Long followerId, Long followedId) {
        if (followerId.equals(followedId)) {
            throw new SelfFollowException("自分自身をフォローすることはできません。");
        }
        findProfileOrThrow(followedId, followerId);

        if (followMapper.existsByFollowerAndFollowed(followerId, followedId)) {
            followMapper.delete(followerId, followedId);
        } else {
            followMapper.insert(followerId, followedId);
        }

        UserProfile profile = findProfileOrThrow(followedId, followerId);
        return new FollowResponse(profile.isFollowedByCurrentUser(), profile.getFollowerCount());
    }

    private UserProfile findProfileOrThrow(Long userId, Long currentUserId) {
        return userMapper.findProfileById(userId, currentUserId)
                .orElseThrow(() -> new UserNotFoundException("ユーザーが見つかりません。"));
    }
}
