package com.ctms.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.ctms.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("queries")
public class Query extends BaseEntity {
    private String studyId;
    private String siteId;
    private String subjectId;
    private String queryType;
    private String description;
    private String response;
    private String status;
    private String severity;
    private Integer agingDays;
}
