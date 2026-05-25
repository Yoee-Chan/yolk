package com.yolk.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@ConfigurationProperties(prefix = "yolk")
public record YolkProperties(Jwt jwt, Cors cors) {

    public record Jwt(String secret, long expirationMs) {}

    public record Cors(List<String> allowedOrigins) {}
}
