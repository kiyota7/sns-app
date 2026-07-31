package com.snsapp.exception;

public class ForbiddenPostAccessException extends RuntimeException {

    public ForbiddenPostAccessException(String message) {
        super(message);
    }
}
