package com.snsapp.config;

import com.snsapp.logging.RequestLoggingFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

/**
 * RequestLoggingFilterがSpring Securityのフィルタチェーン(JwtAuthenticationFilter等)より
 * 先に実行されるよう、明示的に最優先の順序で登録する。これによりrequest_idがSecurity層の
 * 処理も含めたリクエスト全体を包むようになる。
 */
@Configuration
public class LoggingFilterConfig {

    @Bean
    public FilterRegistrationBean<RequestLoggingFilter> requestLoggingFilterRegistration(
            RequestLoggingFilter requestLoggingFilter
    ) {
        FilterRegistrationBean<RequestLoggingFilter> registration =
                new FilterRegistrationBean<>(requestLoggingFilter);
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return registration;
    }
}
