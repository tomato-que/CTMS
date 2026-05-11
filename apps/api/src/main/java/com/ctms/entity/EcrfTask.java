package com.ctms.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.ctms.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("ecrf_tasks")
public class EcrfTask extends BaseEntity {
    private String studyId;
    private String siteId;
    private String subjectId;
    private String visitId;
    private String formDefId;
    private String taskNumber;
    private String status;
    private String sdvStatus;
    private String assignedTo;
    private String reviewerId;
    private String sdvReviewerId;
    private LocalDateTime submittedAt;
    private LocalDateTime lockedAt;
    private LocalDateTime sdvCompletedAt;
    private LocalDate dueDate;
    private String priority;
}
