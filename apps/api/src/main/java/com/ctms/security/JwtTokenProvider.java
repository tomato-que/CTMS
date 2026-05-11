package com.ctms.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Slf4j
@Component
public class JwtTokenProvider {

    @Value("${ctms.jwt.secret:ctms-jwt-secret-key-change-in-production-min-256-bits!!}")
    private String jwtSecret;

    @Value("${ctms.jwt.access-expiration:900000}")
    private long accessTokenExpiration;

    @Value("${ctms.jwt.refresh-expiration:28800000}")
    private long refreshTokenExpiration;

    private SecretKey key;

    @PostConstruct
    public void init() {
        this.key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateAccessToken(String userId, String username, List<String> roles) {
        return buildToken(userId, username, roles, accessTokenExpiration, "access");
    }

    public String generateRefreshToken(String userId, String username) {
        return buildToken(userId, username, Collections.emptyList(), refreshTokenExpiration, "refresh");
    }

    private String buildToken(String userId, String username, List<String> roles, long expiration, String type) {
        Date now = new Date();
        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .subject(userId)
                .claim("username", username)
                .claim("roles", roles)
                .claim("type", type)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expiration))
                .signWith(key)
                .compact();
    }

    @SuppressWarnings("unchecked")
    public UserPrincipal parseToken(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(key).build()
                .parseSignedClaims(token).getPayload();
        return UserPrincipal.builder()
                .userId(claims.getSubject())
                .username(claims.get("username", String.class))
                .roles(claims.get("roles", List.class))
                .build();
    }

    public boolean validateToken(String token) {
        try {
            Jwts.parser().verifyWith(key).build().parseSignedClaims(token);
            return true;
        } catch (JwtException e) {
            log.warn("JWT validation failed: {}", e.getMessage());
            return false;
        }
    }
}
