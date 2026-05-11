package com.ctms.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.ctms.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName(value = "ecrf_form_defs", autoResultMap = true)
public class EcrfFormDef extends BaseEntity {
    private String studyId;
    private String formCode;
    private String formName;
    private String formCategory;
    private Integer versionNumber;
    private String status;
    private String formSchema;
    private LocalDateTime publishedAt;
    private String publishedBy;
}
