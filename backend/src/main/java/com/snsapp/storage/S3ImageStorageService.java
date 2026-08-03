package com.snsapp.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.UUID;

/**
 * EC2のIAMインスタンスプロファイル経由でS3にアクセスする(アクセスキーの発行・管理は不要)。
 */
@Service
@ConditionalOnProperty(name = "app.storage.type", havingValue = "s3")
public class S3ImageStorageService implements ImageStorageService {

    private final S3Client s3Client;
    private final String bucket;
    private final String publicUrlPrefix;

    public S3ImageStorageService(
            @Value("${app.storage.s3.bucket}") String bucket,
            @Value("${app.storage.s3.region}") String region
    ) {
        this.bucket = bucket;
        this.publicUrlPrefix = "https://" + bucket + ".s3." + region + ".amazonaws.com/";
        this.s3Client = S3Client.builder()
                .region(Region.of(region))
                .build();
    }

    @Override
    public String store(MultipartFile image) {
        String key = "uploads/" + UUID.randomUUID() + extractExtension(image.getOriginalFilename());

        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(image.getContentType())
                .build();

        try {
            s3Client.putObject(request, RequestBody.fromInputStream(image.getInputStream(), image.getSize()));
        } catch (IOException e) {
            throw new UncheckedIOException("画像のS3への保存に失敗しました。", e);
        }

        return publicUrlPrefix + key;
    }

    private String extractExtension(String originalFilename) {
        if (originalFilename == null) {
            return "";
        }
        int dotIndex = originalFilename.lastIndexOf('.');
        return dotIndex >= 0 ? originalFilename.substring(dotIndex) : "";
    }
}
