package com.snsapp.service;

import com.snsapp.dto.PostResponse;
import com.snsapp.exception.ForbiddenPostAccessException;
import com.snsapp.exception.PostNotFoundException;
import com.snsapp.mapper.PostMapper;
import com.snsapp.model.Post;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class PostService {

    private final PostMapper postMapper;
    private final Path uploadDir;

    public PostService(PostMapper postMapper, @Value("${app.upload.dir}") String uploadDir) {
        this.postMapper = postMapper;
        this.uploadDir = Path.of(uploadDir).toAbsolutePath();
    }

    public List<PostResponse> list() {
        return postMapper.findAllOrderByCreatedAtDesc().stream()
                .map(PostResponse::from)
                .collect(Collectors.toList());
    }

    public PostResponse create(Long userId, String body, MultipartFile image) {
        Post post = new Post();
        post.setUserId(userId);
        post.setBody(body);
        post.setImageUrl(image != null && !image.isEmpty() ? saveImage(image) : null);

        postMapper.insert(post);

        return PostResponse.from(findByIdOrThrow(post.getId()));
    }

    public PostResponse update(Long postId, Long requesterId, String body) {
        Post post = findByIdOrThrow(postId);
        requireOwner(post, requesterId);

        postMapper.update(postId, body);

        return PostResponse.from(findByIdOrThrow(postId));
    }

    public void delete(Long postId, Long requesterId) {
        Post post = findByIdOrThrow(postId);
        requireOwner(post, requesterId);

        postMapper.delete(postId);
    }

    private Post findByIdOrThrow(Long postId) {
        return postMapper.findById(postId)
                .orElseThrow(() -> new PostNotFoundException("投稿が見つかりません。"));
    }

    private void requireOwner(Post post, Long requesterId) {
        if (!post.getUserId().equals(requesterId)) {
            throw new ForbiddenPostAccessException("自分以外の投稿は操作できません。");
        }
    }

    private String saveImage(MultipartFile image) {
        try {
            Files.createDirectories(uploadDir);
            String filename = UUID.randomUUID() + extractExtension(image.getOriginalFilename());
            Files.copy(image.getInputStream(), uploadDir.resolve(filename));
            return "/uploads/" + filename;
        } catch (IOException e) {
            throw new UncheckedIOException("画像の保存に失敗しました。", e);
        }
    }

    private String extractExtension(String originalFilename) {
        if (originalFilename == null) {
            return "";
        }
        int dotIndex = originalFilename.lastIndexOf('.');
        return dotIndex >= 0 ? originalFilename.substring(dotIndex) : "";
    }
}
