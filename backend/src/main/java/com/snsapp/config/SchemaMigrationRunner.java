package com.snsapp.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;

/**
 * schema.sqlはCREATE TABLE IF NOT EXISTSのみのため、既存DB(usersテーブルが既に存在する
 * 本番環境やローカルのsns.db)には新規カラムが追加されない。SQLiteはALTER TABLE ADD COLUMNに
 * IF NOT EXISTSを使えないため、起動時にカラムの有無を確認してから追加する。
 */
@Component
public class SchemaMigrationRunner implements CommandLineRunner {

    private final DataSource dataSource;

    public SchemaMigrationRunner(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public void run(String... args) throws Exception {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            if (!columnExists(statement, "users", "avatar_url")) {
                statement.execute("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500)");
            }
        }
    }

    private boolean columnExists(Statement statement, String table, String column) throws Exception {
        try (ResultSet rs = statement.executeQuery("PRAGMA table_info(" + table + ")")) {
            while (rs.next()) {
                if (column.equalsIgnoreCase(rs.getString("name"))) {
                    return true;
                }
            }
        }
        return false;
    }
}
