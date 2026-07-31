package com.snsapp.dto;

import jakarta.validation.constraints.NotBlank;

public class UpdatePostRequest {

    @NotBlank
    private String body;

    public String getBody() {
        return body;
    }

    public void setBody(String body) {
        this.body = body;
    }
}
