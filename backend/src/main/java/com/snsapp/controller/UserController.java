package com.snsapp.controller;

import com.snsapp.dto.FollowResponse;
import com.snsapp.dto.PostResponse;
import com.snsapp.dto.ProfileResponse;
import com.snsapp.dto.UserSearchResponse;
import com.snsapp.security.AuthenticatedUser;
import com.snsapp.service.UserService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@Validated
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public ResponseEntity<List<UserSearchResponse>> search(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @RequestParam(defaultValue = "") String query
    ) {
        return ResponseEntity.ok(userService.search(query, principal.id()));
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

    @PutMapping(value = "/me", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ProfileResponse> updateProfile(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @RequestParam @NotBlank @Size(max = 50) String username,
            @RequestParam(required = false) @Size(max = 160) String bio,
            @RequestParam(value = "avatar", required = false) MultipartFile avatar
    ) {
        return ResponseEntity.ok(userService.updateProfile(principal.id(), username, bio, avatar));
    }

    @PostMapping("/{id}/follow")
    public ResponseEntity<FollowResponse> toggleFollow(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(userService.toggleFollow(principal.id(), id));
    }
}
