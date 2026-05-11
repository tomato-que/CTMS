package com.ctms.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.ctms.common.BaseEntity;
import com.ctms.enums.StudyStatus;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("studies")
public class Study extends BaseEntity {
    private String studyCode;
    private String title;
    private String shortTitle;
    private String phase;
    private String therapeuticArea;
    private String indication;
    private String sponsorOrgId;
    private String croOrgId;
    private String registrationNumber;
    private StudyStatus status;
    private Integer plannedSites;
    private Integer plannedSubjects;
}
