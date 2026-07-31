package com.snsapp.controller;

import com.snsapp.dto.CommentResponse;
import com.snsapp.dto.CreateCommentRequest;
import com.snsapp.security.AuthenticatedUser;
import com.snsapp.service.CommentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/posts/{postId}/comments")
public class CommentController {

    private final CommentService commentService;

    public CommentController(CommentService commentService) {
        this.commentService = commentService;
    }

    @GetMapping
    public ResponseEntity<List<CommentResponse>> list(@PathVariable Long postId) {
        return ResponseEntity.ok(commentService.list(postId));
    }

    @PostMapping
    public ResponseEntity<CommentResponse> create(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable Long postId,
            @Valid @RequestBody CreateCommentRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(commentService.create(postId, principal.id(), request.getBody()));
    }
}
