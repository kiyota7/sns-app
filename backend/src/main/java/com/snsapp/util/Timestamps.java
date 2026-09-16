package com.snsapp.util;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

/**
 * DBに保存する日時文字列を生成する。SQLiteの
 * {@code strftime('%Y-%m-%dT%H:%M:%fZ', 'now')} が生成する形式(ミリ秒3桁固定・
 * UTC・末尾Z)と完全に一致させ、SQLite/PostgreSQLどちらのDBに対しても
 * Java側で計算した同一の値を書き込めるようにする(DB側の日時関数への依存を無くす)。
 */
public final class Timestamps {

    private static final DateTimeFormatter FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC);

    private Timestamps() {
    }

    public static String nowIso() {
        return FORMATTER.format(Instant.now());
    }
}
