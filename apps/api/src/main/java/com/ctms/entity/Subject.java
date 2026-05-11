package com.ctms.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.ctms.common.BaseEntity;
import com.ctms.enums.SubjectStatus;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDate;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("subjects")
public class Subject extends BaseEntity {
    private String studyId;
    private String siteId;
    private String subjectNumber;
    private String realName;
    private String phone;
    private String gender;
    private LocalDate birthDate;
    private LocalDate enrollmentDate;
    private SubjectStatus status;
    private LocalDate withdrawalDate;
    private String withdrawalReason;
}
