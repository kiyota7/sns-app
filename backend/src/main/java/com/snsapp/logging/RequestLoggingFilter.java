package com.snsapp.logging;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

import static net.logstash.logback.argument.StructuredArguments.kv;

/**
 * リクエスト全体を包み、相関ID(request_id)をMDCに載せる。同じリクエスト内で出力される
 * 全ログ行(JwtAuthenticationFilter・GlobalExceptionHandler等)に自動的に付与されるため、
 * 障害調査時に「このリクエストで何が起きたか」を1つのIDで追跡できるようにするのが狙い。
 * レスポンスヘッダーにも同じIDを返し、クライアント側の問い合わせ時にも使えるようにする。
 *
 * MDCはスレッドローカルであり、Tomcatはスレッドをリクエストをまたいで再利用するため、
 * 必ずfinallyでクリアしないと次のリクエストに値が漏れてしまう点に注意。
 */
@Component
public class RequestLoggingFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RequestLoggingFilter.class);
    private static final String REQUEST_ID_HEADER = "X-Request-Id";
    static final String MDC_REQUEST_ID = "request_id";

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        String requestId = resolveRequestId(request);
        MDC.put(MDC_REQUEST_ID, requestId);
        response.setHeader(REQUEST_ID_HEADER, requestId);

        long startTimeMs = System.currentTimeMillis();
        try {
            filterChain.doFilter(request, response);
        } finally {
            long durationMs = System.currentTimeMillis() - startTimeMs;
            log.info("request completed",
                    kv("http_method", request.getMethod()),
                    kv("path", request.getRequestURI()),
                    kv("status", response.getStatus()),
                    kv("duration_ms", durationMs));
            MDC.clear();
        }
    }

    private String resolveRequestId(HttpServletRequest request) {
        String incoming = request.getHeader(REQUEST_ID_HEADER);
        return (incoming != null && !incoming.isBlank()) ? incoming : UUID.randomUUID().toString();
    }
}
