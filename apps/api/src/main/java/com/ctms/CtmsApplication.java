package com.ctms;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class CtmsApplication {
    public static void main(String[] args) {
        SpringApplication.run(CtmsApplication.class, args);
    }
}
