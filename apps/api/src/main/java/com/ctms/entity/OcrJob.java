package com.ctms.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.ctms.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName(value = "ocr_jobs", autoResultMap = true)
public class OcrJob extends BaseEntity {
    private String fileId;
    private String ocrType;
    private String status;
    private String resultJson;
    private String confidenceJson;
    private String modelName;
    private String modelVersion;
    private Integer retryCount;
}
