package com.ctms.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.ctms.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDate;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("aes")
public class Ae extends BaseEntity {
    private String studyId;
    private String siteId;
    private String subjectId;
    private String aeNumber;
    private String aeTerm;
    private LocalDate onsetDate;
    private Integer severityGrade;
    private String causality;
    private Integer isSerious;
    private String outcome;
    private String status;
}
