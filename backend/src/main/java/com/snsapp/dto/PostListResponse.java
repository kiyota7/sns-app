package com.snsapp.dto;

import java.util.List;

public record PostListResponse(List<PostResponse> items, boolean hasMore) {
}
