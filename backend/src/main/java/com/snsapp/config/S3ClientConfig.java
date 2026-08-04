package com.snsapp.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

@Configuration
public class S3ClientConfig {

    @Bean
    @ConditionalOnProperty(name = "app.storage.type", havingValue = "s3")
    public S3Client s3Client(@Value("${app.storage.s3.region}") String region) {
        return S3Client.builder()
                .region(Region.of(region))
                .build();
    }
}
