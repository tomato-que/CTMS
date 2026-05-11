package com.ctms.enums;

import lombok.Getter;

@Getter
public enum StudyStatus {
    DRAFT("草稿"),
    STARTUP("启动中"),
    ENROLLING("入组中"),
    FOLLOWUP("随访中"),
    LOCKED("已锁定"),
    ARCHIVED("已归档");

    private final String displayName;

    StudyStatus(String displayName) {
        this.displayName = displayName;
    }
}
