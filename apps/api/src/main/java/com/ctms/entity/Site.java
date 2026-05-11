package com.ctms.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.ctms.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sites")
public class Site extends BaseEntity {
    private String siteCode;
    private String name;
    private String orgId;
    private String siteType;
    private String address;
    private String status;
}
