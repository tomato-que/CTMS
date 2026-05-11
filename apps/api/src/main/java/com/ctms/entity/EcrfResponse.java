package com.ctms.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.ctms.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName(value = "ecrf_responses", autoResultMap = true)
public class EcrfResponse extends BaseEntity {
    private String taskId;
    private String formDefId;
    private String subjectId;
    private String responseData;
    private String status;
    private LocalDateTime submittedAt;
}
