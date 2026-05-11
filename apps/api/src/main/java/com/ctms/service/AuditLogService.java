package com.ctms.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.ctms.entity.AuditLog;
import com.ctms.mapper.AuditLogMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuditLogService {
    private final AuditLogMapper auditLogMapper;

    public void log(String traceId, String userId, String userRole, String operationType,
                    String targetEntity, String targetId, String targetField,
                    String beforeValue, String afterValue, String ipAddress, String sensitivityLevel) {
        AuditLog log = new AuditLog();
        log.setId(UUID.randomUUID().toString().replace("-", ""));
        log.setTraceId(traceId);
        log.setUserId(userId);
        log.setUserRole(userRole);
        log.setOperationType(operationType);
        log.setTargetEntity(targetEntity);
        log.setTargetId(targetId);
        log.setTargetField(targetField);
        log.setBeforeValue(beforeValue);
        log.setAfterValue(afterValue);
        log.setIpAddress(ipAddress);
        log.setSensitivityLevel(sensitivityLevel);
        log.setCreatedAt(LocalDateTime.now());
        auditLogMapper.insert(log);
    }

    public Page<AuditLog> search(String targetEntity, String targetId, int page, int size) {
        LambdaQueryWrapper<AuditLog> qw = new LambdaQueryWrapper<>();
        if (targetEntity != null) qw.eq(AuditLog::getTargetEntity, targetEntity);
        if (targetId != null) qw.eq(AuditLog::getTargetId, targetId);
        qw.orderByDesc(AuditLog::getCreatedAt);
        return auditLogMapper.selectPage(new Page<>(page, size), qw);
    }
}
