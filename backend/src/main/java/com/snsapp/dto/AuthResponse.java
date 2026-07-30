package com.snsapp.dto;

public record AuthResponse(String accessToken, String refreshToken, UserResponse user) {
}
