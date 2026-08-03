package com.snsapp.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

@Service
@ConditionalOnProperty(name = "app.storage.type", havingValue = "local", matchIfMissing = true)
public class LocalImageStorageService implements ImageStorageService {

    private final Path uploadDir;

    public LocalImageStorageService(@Value("${app.upload.dir}") String uploadDir) {
        this.uploadDir = Path.of(uploadDir).toAbsolutePath();
    }

    @Override
    public String store(MultipartFile image) {
        try {
            Files.createDirectories(uploadDir);
            String filename = UUID.randomUUID() + extractExtension(image.getOriginalFilename());
            Files.copy(image.getInputStream(), uploadDir.resolve(filename));
            return "/uploads/" + filename;
        } catch (IOException e) {
            throw new UncheckedIOException("画像の保存に失敗しました。", e);
        }
    }

    private String extractExtension(String originalFilename) {
        if (originalFilename == null) {
            return "";
        }
        int dotIndex = originalFilename.lastIndexOf('.');
        return dotIndex >= 0 ? originalFilename.substring(dotIndex) : "";
    }
}
