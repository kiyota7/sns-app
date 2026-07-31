package com.snsapp.controller;

import com.snsapp.dto.PostResponse;
import com.snsapp.dto.UpdatePostRequest;
import com.snsapp.security.AuthenticatedUser;
import com.snsapp.service.PostService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/posts")
public class PostController {

    private final PostService postService;

    public PostController(PostService postService) {
        this.postService = postService;
    }

    @GetMapping
    public ResponseEntity<List<PostResponse>> list() {
        return ResponseEntity.ok(postService.list());
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PostResponse> create(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @RequestParam("body") String body,
            @RequestParam(value = "image", required = false) MultipartFile image
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(postService.create(principal.id(), body, image));
    }

    @PutMapping("/{id}")
    public ResponseEntity<PostResponse> update(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable Long id,
            @Valid @RequestBody UpdatePostRequest request
    ) {
        return ResponseEntity.ok(postService.update(id, principal.id(), request.getBody()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable Long id
    ) {
        postService.delete(id, principal.id());
        return ResponseEntity.noContent().build();
    }
}
