package com.snsapp.storage;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class LocalImageStorageServiceTest {

    @TempDir
    Path tempDir;

    @Test
    void store_writesFileToUploadDirAndReturnsUrlPath() throws IOException {
        LocalImageStorageService storage = new LocalImageStorageService(tempDir.toString());
        MockMultipartFile file = new MockMultipartFile(
                "image", "photo.jpg", "image/jpeg", "fake-image-bytes".getBytes());

        String url = storage.store(file);

        assertThat(url).startsWith("/uploads/").endsWith(".jpg");

        String filename = url.substring("/uploads/".length());
        Path savedFile = tempDir.resolve(filename);
        assertThat(Files.exists(savedFile)).isTrue();
        assertThat(Files.readAllBytes(savedFile)).isEqualTo("fake-image-bytes".getBytes());
    }

    @Test
    void store_withNoExtension_savesFileWithoutExtension() {
        LocalImageStorageService storage = new LocalImageStorageService(tempDir.toString());
        MockMultipartFile file = new MockMultipartFile(
                "image", "no-extension", "image/jpeg", "bytes".getBytes());

        String url = storage.store(file);

        assertThat(url).doesNotContain(".");
    }

    @Test
    void store_createsUploadDirIfMissing() {
        Path nestedDir = tempDir.resolve("nested/does/not/exist/yet");
        LocalImageStorageService storage = new LocalImageStorageService(nestedDir.toString());
        MockMultipartFile file = new MockMultipartFile(
                "image", "a.png", "image/png", "bytes".getBytes());

        storage.store(file);

        assertThat(Files.isDirectory(nestedDir)).isTrue();
    }
}
