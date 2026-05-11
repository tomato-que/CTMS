package com.ctms.controller;

import com.ctms.common.ApiResponse;
import com.ctms.entity.AuditLog;
import com.ctms.entity.SysUser;
import com.ctms.mapper.AuditLogMapper;
import com.ctms.mapper.SysUserMapper;
import com.ctms.security.JwtTokenProvider;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final JwtTokenProvider jwtTokenProvider;
    private final SysUserMapper sysUserMapper;
    private final AuditLogMapper auditLogMapper;

    @PostMapping("/login")
    public ApiResponse<Map<String, String>> login(@RequestBody Map<String, String> body,
                                                   HttpServletRequest request) {
        String username = body.get("username");
        String password = body.get("password");

        if (username == null || password == null) {
            return ApiResponse.error(40100, "用户名或密码不能为空");
        }

        // Dev mode: look up from DB and compare plain text password
        // TODO: Add BCryptPasswordEncoder for production
        SysUser user = sysUserMapper.findByUsername(username);
        if (user != null && password.equals(user.getPasswordHash())) {
            String accessToken = jwtTokenProvider.generateAccessToken(
                    user.getId(), user.getUsername(),
                    List.of("ROLE_" + user.getStatus())); // status holds role in dev
            String refreshToken = jwtTokenProvider.generateRefreshToken(
                    user.getId(), user.getUsername());
            // Record login audit
            AuditLog al = new AuditLog();
            al.setId(UUID.randomUUID().toString());
            al.setOperationType("LOGIN");
            al.setTargetEntity("Auth");
            al.setTargetId(user.getId());
            al.setUserId(user.getId());
            al.setUserRole("ROLE_" + user.getStatus());
            al.setIpAddress(request.getRemoteAddr());
            al.setCreatedAt(LocalDateTime.now());
            auditLogMapper.insert(al);
            return ApiResponse.success(Map.of(
                    "accessToken", accessToken,
                    "refreshToken", refreshToken,
                    "tokenType", "Bearer",
                    "realName", user.getRealName() != null ? user.getRealName() : username
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
