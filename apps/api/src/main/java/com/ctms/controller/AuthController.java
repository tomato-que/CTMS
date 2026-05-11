package com.ctms.controller;

import com.ctms.common.ApiResponse;
import com.ctms.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final JwtTokenProvider jwtTokenProvider;
    private final PasswordEncoder passwordEncoder;

    @PostMapping("/login")
    public ApiResponse<Map<String, String>> login(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String password = body.get("password");
        // Dev mode: hardcoded admin login
        // TODO: Replace with real user lookup + BCrypt verification from sys_users table
        if ("admin".equals(username) && "admin123".equals(password)) {
            String accessToken = jwtTokenProvider.generateAccessToken(
                    "u-admin-001", "admin", List.of("ROLE_ADMIN"));
            String refreshToken = jwtTokenProvider.generateRefreshToken("u-admin-001", "admin");
            return ApiResponse.success(Map.of(
                    "accessToken", accessToken,
                    "refreshToken", refreshToken,
                    "tokenType", "Bearer"
            ));
        }
        return ApiResponse.error(40100, "用户名或密码错误");
    }

    @PostMapping("/refresh")
    public ApiResponse<Map<String, String>> refresh(@RequestBody Map<String, String> body) {
        String refreshToken = body.get("refreshToken");
        if (refreshToken != null && jwtTokenProvider.validateToken(refreshToken)) {
            var principal = jwtTokenProvider.parseToken(refreshToken);
            String newAccessToken = jwtTokenProvider.generateAccessToken(
                    principal.getUserId(), principal.getUsername(), principal.getRoles());
            return ApiResponse.success(Map.of(
                    "accessToken", newAccessToken,
                    "tokenType", "Bearer"
            ));
        }
        return ApiResponse.error(40101, "Token无效或已过期");
    }
}
