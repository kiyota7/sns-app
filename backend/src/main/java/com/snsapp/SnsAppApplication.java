package com.snsapp;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("com.snsapp.mapper")
public class SnsAppApplication {

    public static void main(String[] args) {
        SpringApplication.run(SnsAppApplication.class, args);
    }
}
