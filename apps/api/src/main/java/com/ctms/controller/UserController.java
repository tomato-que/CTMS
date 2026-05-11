package com.ctms.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.ctms.common.ApiResponse;
import com.ctms.common.ErrorCode;
import com.ctms.entity.SysUser;
import com.ctms.mapper.SysUserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {
    private final SysUserMapper sysUserMapper;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_PM')")
    public ApiResponse<List<SysUser>> listUsers() {
        return ApiResponse.success(sysUserMapper.selectList(
            new LambdaQueryWrapper<SysUser>().orderByAsc(SysUser::getCreatedAt)));
    }

    @GetMapping("/{userId}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_PM')")
    public ApiResponse<SysUser> getUser(@PathVariable String userId) {
        SysUser user = sysUserMapper.selectById(userId);
        if (user == null) {
            return ApiResponse.error(ErrorCode.NOT_FOUND.getCode(), "用户不存在");
        }
        return ApiResponse.success(user);
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN')")
    public ApiResponse<?> createUser(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        if (username == null || username.isBlank()) {
            return ApiResponse.error(ErrorCode.VALIDATION_ERROR.getCode(), "用户名不能为空");
        }

        // Check duplicate
        SysUser existing = sysUserMapper.findByUsername(username.trim());
        if (existing != null) {
            return ApiResponse.error(ErrorCode.CONFLICT.getCode(), "用户名已存在: " + username);
        }

        SysUser user = new SysUser();
        user.setId("u-" + UUID.randomUUID().toString().replace("-", "").substring(0, 16));
        user.setUsername(username.trim());
        user.setPasswordHash(body.getOrDefault("password", "admin123"));
        user.setRealName(body.getOrDefault("realName", username));
        user.setEmail(body.getOrDefault("email", ""));
        user.setPhone(body.getOrDefault("phone", ""));
        user.setStatus(body.getOrDefault("status", "Active"));
        sysUserMapper.insert(user);
        return ApiResponse.success(user);
    }

    @PutMapping("/{username}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN')")
    public ApiResponse<?> updateUser(@PathVariable String username, @RequestBody Map<String, String> body) {
        SysUser user = sysUserMapper.findByUsername(username);
        if (user == null) {
            return ApiResponse.error(ErrorCode.NOT_FOUND.getCode(), "用户不存在: " + username);
        }
        if (body.containsKey("realName")) user.setRealName(body.get("realName"));
        if (body.containsKey("email")) user.setEmail(body.get("email"));
        if (body.containsKey("phone")) user.setPhone(body.get("phone"));
        if (body.containsKey("role")) user.setStatus(body.get("role"));
        if (body.containsKey("site")) { /* site is not a column in SysUser, skip or store in remark */ }
        if (body.containsKey("status")) user.setStatus(body.get("status"));
        if (body.containsKey("password") && !body.get("password").isBlank()) {
            user.setPasswordHash(body.get("password"));
        }
        sysUserMapper.updateById(user);
        return ApiResponse.success(user);
    }

    @DeleteMapping("/{username}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN')")
    public ApiResponse<Void> deleteUser(@PathVariable String username) {
        SysUser user = sysUserMapper.findByUsername(username);
        if (user != null) {
            sysUserMapper.deleteById(user.getId());
        }
        return ApiResponse.success(null);
    }
}
