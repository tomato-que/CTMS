package com.ctms.common;

import lombok.Getter;

@Getter
public enum ErrorCode {
    SUCCESS(0, "ok"),
    BAD_REQUEST(40000, "请求参数错误"),
    VALIDATION_ERROR(40001, "参数校验失败"),
    UNAUTHORIZED(40100, "未认证"),
    TOKEN_EXPIRED(40101, "Token已过期"),
    FORBIDDEN(40300, "无权限"),
    NOT_FOUND(40400, "资源不存在"),
    CONFLICT(40900, "资源冲突"),
    INTERNAL_ERROR(50000, "服务器内部错误"),
    STUDY_NOT_FOUND(40401, "研究项目不存在"),
    STUDY_STATUS_TRANSITION_INVALID(42201, "研究状态流转非法"),
    SITE_NOT_FOUND(40402, "中心不存在"),
    SITE_STATUS_TRANSITION_INVALID(42202, "中心状态流转非法"),
    SUBJECT_NOT_FOUND(40403, "受试者不存在"),
    SUBJECT_STATUS_TRANSITION_INVALID(42203, "受试者状态流转非法"),
    SUBJECT_PII_ACCESS_DENIED(40301, "无权访问受试者身份信息"),
    VISIT_NOT_FOUND(40404, "访视不存在"),
    QUERY_NOT_FOUND(40405, "查询不存在"),
    AE_NOT_FOUND(40406, "不良事件不存在"),
    SAE_NOT_FOUND(40407, "严重不良事件不存在"),
    FILE_NOT_FOUND(40408, "文件不存在"),
    OCR_JOB_NOT_FOUND(40409, "OCR任务不存在"),
    FILE_UPLOAD_FAILED(50001, "文件上传失败"),
    FILE_MIME_NOT_ALLOWED(40002, "文件类型不允许"),
    FILE_SIZE_EXCEEDED(40003, "文件大小超限"),
    RATE_LIMIT_EXCEEDED(42900, "请求频率超限"),
    SERVICE_UNAVAILABLE(50300, "服务暂不可用");

    private final int code;
    private final String message;

    ErrorCode(int code, String message) {
        this.code = code;
        this.message = message;
    }
}
