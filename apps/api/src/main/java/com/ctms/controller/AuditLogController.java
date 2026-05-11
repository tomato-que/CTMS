package com.ctms.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.ctms.common.ApiResponse;
import com.ctms.entity.AuditLog;
import com.ctms.mapper.AuditLogMapper;
import com.ctms.security.JwtTokenProvider;
import com.ctms.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/audit-logs")
@RequiredArgsConstructor
public class AuditLogController {

    private final AuditLogMapper auditLogMapper;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_AUDITOR')")
    public ApiResponse<List<AuditLog>> listLogs(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int size) {
        Page<AuditLog> p = new Page<>(page, size);
        auditLogMapper.selectPage(p,
                new LambdaQueryWrapper<AuditLog>().orderByDesc(AuditLog::getCreatedAt));
        return ApiResponse.success(p.getRecords());
    }

    @PostMapping("/record")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<Void> recordAudit(@RequestBody Map<String, Object> body,
                                          HttpServletRequest request,
                                          Authentication auth) {
        AuditLog log = new AuditLog();
        log.setId(java.util.UUID.randomUUID().toString());
        log.setOperationType((String) body.getOrDefault("operationType", "UNKNOWN"));
        log.setTargetEntity((String) body.getOrDefault("targetEntity", ""));
        log.setTargetId((String) body.getOrDefault("targetId", ""));
        log.setUserId(auth != null ? ((UserPrincipal) auth.getPrincipal()).getUserId() : "system");
        log.setIpAddress(request.getRemoteAddr());
        log.setCreatedAt(java.time.LocalDateTime.now());
        auditLogMapper.insert(log);
        return ApiResponse.success(null);
    }
}
