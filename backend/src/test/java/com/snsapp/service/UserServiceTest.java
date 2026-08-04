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
import com.snsapp.model.Post;
import com.snsapp.model.User;
import com.snsapp.model.UserProfile;
import com.snsapp.model.UserSearchResult;
import com.snsapp.storage.ImageStorageService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserMapper userMapper;
    @Mock
    private PostMapper postMapper;
    @Mock
    private FollowMapper followMapper;
    @Mock
    private ImageStorageService imageStorageService;

    @InjectMocks
    private UserService userService;

    private UserProfile profileOf(Long id, String username, boolean following) {
        UserProfile profile = new UserProfile();
        profile.setId(id);
        profile.setUsername(username);
        profile.setFollowedByCurrentUser(following);
        return profile;
    }

    @Test
    void getProfile_found_returnsResponse() {
        when(userMapper.findProfileById(1L, 9L)).thenReturn(Optional.of(profileOf(1L, "alice", false)));

        ProfileResponse response = userService.getProfile(1L, 9L);

        assertThat(response.username()).isEqualTo("alice");
    }

    @Test
    void getProfile_notFound_throwsUserNotFoundException() {
        when(userMapper.findProfileById(99L, 9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getProfile(99L, 9L))
                .isInstanceOf(UserNotFoundException.class);
    }

    @Test
    void getPosts_mapsToResponses() {
        Post post = new Post();
        post.setId(1L);
        post.setUserId(1L);
        post.setUsername("alice");
        post.setBody("hi");
        when(postMapper.findByUserIdOrderByCreatedAtDesc(1L, 9L)).thenReturn(List.of(post));

        List<PostResponse> result = userService.getPosts(1L, 9L);

        assertThat(result).hasSize(1);
    }

    @Test
    void updateProfile_newUniqueUsername_updatesAndReturnsProfile() {
        when(userMapper.findByUsername("newname")).thenReturn(Optional.empty());
        when(userMapper.findProfileById(1L, 1L)).thenReturn(Optional.of(profileOf(1L, "newname", false)));

        ProfileResponse response = userService.updateProfile(1L, "newname", "bio", null);

        assertThat(response.username()).isEqualTo("newname");
        verify(userMapper).updateProfile(1L, "newname", "bio", null);
    }

    @Test
    void updateProfile_usernameTakenBySomeoneElse_throwsDuplicateUser() {
        User otherUser = new User();
        otherUser.setId(2L);
        otherUser.setUsername("taken");
        when(userMapper.findByUsername("taken")).thenReturn(Optional.of(otherUser));

        assertThatThrownBy(() -> userService.updateProfile(1L, "taken", "bio", null))
                .isInstanceOf(DuplicateUserException.class);
        verify(userMapper, never()).updateProfile(any(), any(), any(), any());
    }

    @Test
    void updateProfile_usernameUnchangedBySameUser_doesNotThrow() {
        User self = new User();
        self.setId(1L);
        self.setUsername("alice");
        when(userMapper.findByUsername("alice")).thenReturn(Optional.of(self));
        when(userMapper.findProfileById(1L, 1L)).thenReturn(Optional.of(profileOf(1L, "alice", false)));

        userService.updateProfile(1L, "alice", "new bio", null);

        verify(userMapper).updateProfile(1L, "alice", "new bio", null);
    }

    @Test
    void updateProfile_withAvatar_storesImageAndPassesUrl() {
        MultipartFile avatar = new MockMultipartFile("avatar", "icon.png", "image/png", "bytes".getBytes());
        when(userMapper.findByUsername("alice")).thenReturn(Optional.empty());
        when(imageStorageService.store(avatar)).thenReturn("/uploads/icon-generated.png");
        when(userMapper.findProfileById(1L, 1L)).thenReturn(Optional.of(profileOf(1L, "alice", false)));

        userService.updateProfile(1L, "alice", "bio", avatar);

        verify(userMapper).updateProfile(1L, "alice", "bio", "/uploads/icon-generated.png");
    }

    @Test
    void updateProfile_withoutAvatar_keepsExistingAvatarUrl() {
        when(userMapper.findByUsername("alice")).thenReturn(Optional.empty());
        when(userMapper.findProfileById(1L, 1L)).thenReturn(Optional.of(profileOf(1L, "alice", false)));

        userService.updateProfile(1L, "alice", "bio", null);

        verify(userMapper).updateProfile(eq(1L), eq("alice"), eq("bio"), isNull());
        verify(imageStorageService, never()).store(any());
    }

    @Test
    void toggleFollow_selfFollow_throwsSelfFollowException() {
        assertThatThrownBy(() -> userService.toggleFollow(1L, 1L))
                .isInstanceOf(SelfFollowException.class);
        verify(followMapper, never()).insert(any(), any());
    }

    @Test
    void toggleFollow_notFollowingYet_insertsFollow() {
        when(userMapper.findProfileById(2L, 1L))
                .thenReturn(Optional.of(profileOf(2L, "bob", false)))
                .thenReturn(Optional.of(profileOf(2L, "bob", true)));
        when(followMapper.existsByFollowerAndFollowed(1L, 2L)).thenReturn(false);

        FollowResponse response = userService.toggleFollow(1L, 2L);

        assertThat(response.following()).isTrue();
        verify(followMapper).insert(1L, 2L);
        verify(followMapper, never()).delete(any(), any());
    }

    @Test
    void toggleFollow_alreadyFollowing_removesFollow() {
        when(userMapper.findProfileById(2L, 1L))
                .thenReturn(Optional.of(profileOf(2L, "bob", true)))
                .thenReturn(Optional.of(profileOf(2L, "bob", false)));
        when(followMapper.existsByFollowerAndFollowed(1L, 2L)).thenReturn(true);

        FollowResponse response = userService.toggleFollow(1L, 2L);

        assertThat(response.following()).isFalse();
        verify(followMapper).delete(1L, 2L);
        verify(followMapper, never()).insert(any(), any());
    }

    @Test
    void toggleFollow_targetUserNotFound_throwsUserNotFoundException() {
        when(userMapper.findProfileById(99L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.toggleFollow(1L, 99L))
                .isInstanceOf(UserNotFoundException.class);
    }

    @Test
    void search_mapsResultsToResponses() {
        UserSearchResult result = new UserSearchResult();
        result.setId(2L);
        result.setUsername("bob");
        result.setFollowedByCurrentUser(true);
        when(userMapper.search("bo", 1L)).thenReturn(List.of(result));

        List<UserSearchResponse> response = userService.search("bo", 1L);

        assertThat(response).hasSize(1);
        assertThat(response.get(0).username()).isEqualTo("bob");
        assertThat(response.get(0).following()).isTrue();
    }
}
