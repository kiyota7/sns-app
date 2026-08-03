package com.snsapp.storage;

import org.springframework.web.multipart.MultipartFile;

public interface ImageStorageService {

    /**
     * 画像を保存し、フロントエンドから直接参照できるURL(相対パスまたは絶対URL)を返す。
     */
    String store(MultipartFile image);
}
