package com.snsapp.controller;

import com.snsapp.dto.FollowResponse;
import com.snsapp.dto.PostResponse;
import com.snsapp.dto.ProfileResponse;
import com.snsapp.dto.UpdateProfileRequest;
import com.snsapp.security.AuthenticatedUser;
import com.snsapp.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProfileResponse> getProfile(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(userService.getProfile(id, principal.id()));
    }

    @GetMapping("/{id}/posts")
    public ResponseEntity<List<PostResponse>> getPosts(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(userService.getPosts(id, principal.id()));
    }

    @PutMapping("/me")
    public ResponseEntity<ProfileResponse> updateProfile(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @Valid @RequestBody UpdateProfileRequest request
    ) {
        return ResponseEntity.ok(userService.updateProfile(principal.id(), request.getUsername(), request.getBio()));
    }

    @PostMapping("/{id}/follow")
    public ResponseEntity<FollowResponse> toggleFollow(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(userService.toggleFollow(principal.id(), id));
    }
}
