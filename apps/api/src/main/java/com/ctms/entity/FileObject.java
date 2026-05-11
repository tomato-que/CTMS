package com.ctms.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.ctms.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("file_objects")
public class FileObject extends BaseEntity {
    private String originalName;
    private String storagePath;
    private String bucketName;
    private String mimeType;
    private Long fileSize;
    private String fileHash;
    private String status;
    private String belongEntity;
    private String belongId;
}
