package com.snsapp.service;

import com.snsapp.dto.LikeResponse;
import com.snsapp.dto.PostResponse;
import com.snsapp.exception.ForbiddenPostAccessException;
import com.snsapp.exception.PostNotFoundException;
import com.snsapp.mapper.CommentMapper;
import com.snsapp.mapper.LikeMapper;
import com.snsapp.mapper.PostMapper;
import com.snsapp.model.Post;
import com.snsapp.storage.ImageStorageService;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class PostService {

    private final PostMapper postMapper;
    private final CommentMapper commentMapper;
    private final LikeMapper likeMapper;
    private final ImageStorageService imageStorageService;

    public PostService(
            PostMapper postMapper,
            CommentMapper commentMapper,
            LikeMapper likeMapper,
            ImageStorageService imageStorageService
    ) {
        this.postMapper = postMapper;
        this.commentMapper = commentMapper;
        this.likeMapper = likeMapper;
        this.imageStorageService = imageStorageService;
    }

    public List<PostResponse> list(Long currentUserId) {
        return postMapper.findAllOrderByCreatedAtDesc(currentUserId).stream()
                .map(PostResponse::from)
                .collect(Collectors.toList());
    }

    public List<PostResponse> listFollowing(Long currentUserId) {
        return postMapper.findFollowingOrderByCreatedAtDesc(currentUserId).stream()
                .map(PostResponse::from)
                .collect(Collectors.toList());
    }

    public PostResponse getById(Long postId, Long currentUserId) {
        return PostResponse.from(findByIdOrThrow(postId, currentUserId));
    }

    public PostResponse create(Long userId, String body, MultipartFile image) {
        Post post = new Post();
        post.setUserId(userId);
        post.setBody(body);
        post.setImageUrl(image != null && !image.isEmpty() ? imageStorageService.store(image) : null);

        postMapper.insert(post);

        return PostResponse.from(findByIdOrThrow(post.getId(), userId));
    }

    public PostResponse update(Long postId, Long requesterId, String body) {
        Post post = findByIdOrThrow(postId, requesterId);
        requireOwner(post, requesterId);

        postMapper.update(postId, body);

        return PostResponse.from(findByIdOrThrow(postId, requesterId));
    }

    public void delete(Long postId, Long requesterId) {
        Post post = findByIdOrThrow(postId, requesterId);
        requireOwner(post, requesterId);

        commentMapper.deleteByPostId(postId);
        likeMapper.deleteByPostId(postId);
        postMapper.delete(postId);
    }

    public LikeResponse toggleLike(Long postId, Long userId) {
        findByIdOrThrow(postId, userId);

        if (likeMapper.existsByPostIdAndUserId(postId, userId)) {
            likeMapper.delete(postId, userId);
            return new LikeResponse(false, likeMapper.countByPostId(postId));
        }

        likeMapper.insert(postId, userId);
        return new LikeResponse(true, likeMapper.countByPostId(postId));
    }

    private Post findByIdOrThrow(Long postId, Long currentUserId) {
        return postMapper.findById(postId, currentUserId)
                .orElseThrow(() -> new PostNotFoundException("投稿が見つかりません。"));
    }

    private void requireOwner(Post post, Long requesterId) {
        if (!post.getUserId().equals(requesterId)) {
            throw new ForbiddenPostAccessException("自分以外の投稿は操作できません。");
        }
    }
}
