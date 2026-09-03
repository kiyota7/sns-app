package com.snsapp.service;

import com.snsapp.dto.LikeResponse;
import com.snsapp.dto.PostListResponse;
import com.snsapp.dto.PostResponse;
import com.snsapp.exception.ForbiddenPostAccessException;
import com.snsapp.exception.PostNotFoundException;
import com.snsapp.mapper.CommentMapper;
import com.snsapp.mapper.LikeMapper;
import com.snsapp.mapper.PostMapper;
import com.snsapp.model.Post;
import com.snsapp.storage.ImageStorageService;
import org.junit.jupiter.api.BeforeEach;
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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PostServiceTest {

    @Mock
    private PostMapper postMapper;
    @Mock
    private CommentMapper commentMapper;
    @Mock
    private LikeMapper likeMapper;
    @Mock
    private ImageStorageService imageStorageService;

    @InjectMocks
    private PostService postService;

    private Post samplePost(Long id, Long userId) {
        Post post = new Post();
        post.setId(id);
        post.setUserId(userId);
        post.setUsername("alice");
        post.setBody("hello");
        return post;
    }

    @Test
    void list_mapsAllPostsToResponses() {
        when(postMapper.findAllOrderByCreatedAtDesc(1L, null, 21))
                .thenReturn(List.of(samplePost(1L, 1L), samplePost(2L, 2L)));

        PostListResponse result = postService.list(1L, null, 20);

        assertThat(result.items()).hasSize(2);
        assertThat(result.items().get(0).id()).isEqualTo(1L);
        assertThat(result.hasMore()).isFalse();
    }

    @Test
    void list_passesCursorThroughAndFetchesOneExtraToDetermineHasMore() {
        when(postMapper.findAllOrderByCreatedAtDesc(1L, 10L, 3)).thenReturn(
                List.of(samplePost(9L, 1L), samplePost(8L, 1L), samplePost(7L, 1L))
        );

        PostListResponse result = postService.list(1L, 10L, 2);

        assertThat(result.items()).extracting(PostResponse::id).containsExactly(9L, 8L);
        assertThat(result.hasMore()).isTrue();
    }

    @Test
    void listFollowing_delegatesToFollowingQuery() {
        when(postMapper.findFollowingOrderByCreatedAtDesc(1L, null, 21)).thenReturn(List.of(samplePost(3L, 2L)));

        PostListResponse result = postService.listFollowing(1L, null, 20);

        assertThat(result.items()).hasSize(1);
        assertThat(result.items().get(0).id()).isEqualTo(3L);
        assertThat(result.hasMore()).isFalse();
    }

    @Test
    void getById_found_returnsResponse() {
        when(postMapper.findById(1L, 9L)).thenReturn(Optional.of(samplePost(1L, 9L)));

        PostResponse result = postService.getById(1L, 9L);

        assertThat(result.id()).isEqualTo(1L);
    }

    @Test
    void getById_notFound_throwsPostNotFoundException() {
        when(postMapper.findById(99L, 9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> postService.getById(99L, 9L))
                .isInstanceOf(PostNotFoundException.class);
    }

    @Test
    void create_withoutImage_doesNotCallImageStorage() {
        when(postMapper.findById(any(), eq(1L))).thenReturn(Optional.of(samplePost(1L, 1L)));

        postService.create(1L, "hello world", null);

        verify(imageStorageService, never()).store(any());
    }

    @Test
    void create_withEmptyImage_doesNotCallImageStorage() {
        MultipartFile emptyFile = new MockMultipartFile("image", new byte[0]);
        when(postMapper.findById(any(), eq(1L))).thenReturn(Optional.of(samplePost(1L, 1L)));

        postService.create(1L, "hello world", emptyFile);

        verify(imageStorageService, never()).store(any());
    }

    @Test
    void create_withImage_storesImageAndSetsUrl() {
        MultipartFile file = new MockMultipartFile("image", "cat.jpg", "image/jpeg", "bytes".getBytes());
        when(imageStorageService.store(file)).thenReturn("/uploads/generated.jpg");
        when(postMapper.findById(any(), eq(1L))).thenReturn(Optional.of(samplePost(1L, 1L)));

        postService.create(1L, "hello world", file);

        verify(postMapper).insert(argThatImageUrlEquals("/uploads/generated.jpg"));
    }

    @Test
    void update_byOwner_updatesBody() {
        Post existing = samplePost(1L, 1L);
        when(postMapper.findById(1L, 1L)).thenReturn(Optional.of(existing));

        postService.update(1L, 1L, "updated body");

        verify(postMapper).update(1L, "updated body");
    }

    @Test
    void update_byNonOwner_throwsForbidden() {
        Post existing = samplePost(1L, 1L);
        when(postMapper.findById(1L, 2L)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> postService.update(1L, 2L, "hacked body"))
                .isInstanceOf(ForbiddenPostAccessException.class);
        verify(postMapper, never()).update(any(), any());
    }

    @Test
    void delete_byOwner_cascadesToCommentsAndLikes() {
        Post existing = samplePost(1L, 1L);
        when(postMapper.findById(1L, 1L)).thenReturn(Optional.of(existing));

        postService.delete(1L, 1L);

        verify(commentMapper).deleteByPostId(1L);
        verify(likeMapper).deleteByPostId(1L);
        verify(postMapper).delete(1L);
    }

    @Test
    void delete_byNonOwner_throwsForbiddenAndDoesNotDelete() {
        Post existing = samplePost(1L, 1L);
        when(postMapper.findById(1L, 2L)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> postService.delete(1L, 2L))
                .isInstanceOf(ForbiddenPostAccessException.class);
        verify(postMapper, never()).delete(any());
        verify(commentMapper, never()).deleteByPostId(any());
    }

    @Test
    void toggleLike_notYetLiked_insertsLike() {
        when(postMapper.findById(1L, 9L)).thenReturn(Optional.of(samplePost(1L, 1L)));
        when(likeMapper.existsByPostIdAndUserId(1L, 9L)).thenReturn(false);
        when(likeMapper.countByPostId(1L)).thenReturn(1);

        LikeResponse response = postService.toggleLike(1L, 9L);

        assertThat(response.liked()).isTrue();
        assertThat(response.likeCount()).isEqualTo(1);
        verify(likeMapper).insert(1L, 9L);
        verify(likeMapper, never()).delete(any(), any());
    }

    @Test
    void toggleLike_alreadyLiked_removesLike() {
        when(postMapper.findById(1L, 9L)).thenReturn(Optional.of(samplePost(1L, 1L)));
        when(likeMapper.existsByPostIdAndUserId(1L, 9L)).thenReturn(true);
        when(likeMapper.countByPostId(1L)).thenReturn(0);

        LikeResponse response = postService.toggleLike(1L, 9L);

        assertThat(response.liked()).isFalse();
        assertThat(response.likeCount()).isEqualTo(0);
        verify(likeMapper).delete(1L, 9L);
        verify(likeMapper, never()).insert(any(), any());
    }

    @Test
    void toggleLike_postNotFound_throwsAndDoesNotTouchLikes() {
        when(postMapper.findById(99L, 9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> postService.toggleLike(99L, 9L))
                .isInstanceOf(PostNotFoundException.class);
        verify(likeMapper, never()).insert(any(), any());
    }

    private Post argThatImageUrlEquals(String expectedUrl) {
        return org.mockito.ArgumentMatchers.argThat(post -> expectedUrl.equals(post.getImageUrl()));
    }
}
