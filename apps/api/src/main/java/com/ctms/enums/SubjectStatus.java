package com.ctms.enums;

import lombok.Getter;

@Getter
public enum SubjectStatus {
    LEAD("潜在"),
    PRESCREENED("预筛"),
    CONSENTED("已知情"),
    SCREENED("已筛选"),
    ENROLLED("已入组"),
    IN_FOLLOWUP("随访中"),
    COMPLETED("已完成"),
    WITHDRAWN("已退出"),
    LOST("失访");

    private final String displayName;
    SubjectStatus(String displayName) { this.displayName = displayName; }
}
