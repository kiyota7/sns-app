package com.snsapp.storage;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class S3ImageStorageServiceTest {

    @Mock
    private S3Client s3Client;

    @Captor
    private ArgumentCaptor<PutObjectRequest> requestCaptor;

    private S3ImageStorageService storage;

    @BeforeEach
    void setUp() {
        storage = new S3ImageStorageService(s3Client, "sns-app-uploads-test", "ap-northeast-1");
    }

    @Test
    void store_putsObjectWithUploadsPrefixAndReturnsPublicS3Url() {
        when(s3Client.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
                .thenReturn(PutObjectResponse.builder().build());
        MockMultipartFile file = new MockMultipartFile(
                "image", "cat.jpg", "image/jpeg", "fake-bytes".getBytes());

        String url = storage.store(file);

        verify(s3Client).putObject(requestCaptor.capture(), any(RequestBody.class));
        PutObjectRequest sentRequest = requestCaptor.getValue();

        assertThat(sentRequest.bucket()).isEqualTo("sns-app-uploads-test");
        assertThat(sentRequest.key()).startsWith("uploads/").endsWith(".jpg");
        assertThat(sentRequest.contentType()).isEqualTo("image/jpeg");

        assertThat(url)
                .isEqualTo("https://sns-app-uploads-test.s3.ap-northeast-1.amazonaws.com/" + sentRequest.key());
    }
}
