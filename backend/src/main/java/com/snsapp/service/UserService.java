package com.snsapp.service;

import com.snsapp.dto.FollowResponse;
import com.snsapp.dto.PostResponse;
import com.snsapp.dto.ProfileResponse;
import com.snsapp.dto.UserSearchResponse;
import com.snsapp.exception.DuplicateUserException;
import com.snsapp.exception.SelfFollowException;
import com.snsapp.exception.UserNotFoundException;
import com.snsapp.mapper.FollowMapper;
import com.snsapp.mapper.PostMapper;
import com.snsapp.mapper.UserMapper;
import com.snsapp.model.UserProfile;
import com.snsapp.storage.ImageStorageService;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class UserService {

    private final UserMapper userMapper;
    private final PostMapper postMapper;
    private final FollowMapper followMapper;
    private final ImageStorageService imageStorageService;

    public UserService(
            UserMapper userMapper,
            PostMapper postMapper,
            FollowMapper followMapper,
            ImageStorageService imageStorageService
    ) {
        this.userMapper = userMapper;
        this.postMapper = postMapper;
        this.followMapper = followMapper;
        this.imageStorageService = imageStorageService;
    }

    public ProfileResponse getProfile(Long userId, Long currentUserId) {
        return ProfileResponse.from(findProfileOrThrow(userId, currentUserId));
    }

    public List<PostResponse> getPosts(Long userId, Long currentUserId) {
        return postMapper.findByUserIdOrderByCreatedAtDesc(userId, currentUserId).stream()
                .map(PostResponse::from)
                .collect(Collectors.toList());
    }

    public ProfileResponse updateProfile(Long userId, String username, String bio, MultipartFile avatar) {
        userMapper.findByUsername(username)
                .filter(existing -> !existing.getId().equals(userId))
                .ifPresent(existing -> {
                    throw new DuplicateUserException("そのユーザー名は既に使われています。");
                });

        String avatarUrl = (avatar != null && !avatar.isEmpty()) ? imageStorageService.store(avatar) : null;
        userMapper.updateProfile(userId, username, bio, avatarUrl);

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

    public List<UserSearchResponse> search(String query, Long currentUserId) {
        return userMapper.search(query, currentUserId).stream()
                .map(UserSearchResponse::from)
                .collect(Collectors.toList());
    }

    private UserProfile findProfileOrThrow(Long userId, Long currentUserId) {
        return userMapper.findProfileById(userId, currentUserId)
                .orElseThrow(() -> new UserNotFoundException("ユーザーが見つかりません。"));
    }
}
