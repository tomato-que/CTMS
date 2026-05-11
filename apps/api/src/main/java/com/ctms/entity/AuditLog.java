package com.ctms.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("audit_logs")
public class AuditLog {
    private String id;
    private String traceId;
    private String userId;
    private String userRole;
    private String operationType;
    private String targetEntity;
    private String targetId;
    private String targetField;
    private String beforeValue;
    private String afterValue;
    private String operationDetail;
    private String ipAddress;
    private String sensitivityLevel;
    private LocalDateTime createdAt;
}
