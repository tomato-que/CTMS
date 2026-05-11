package com.ctms.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.ctms.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_users")
public class SysUser extends BaseEntity {
    private String username;
    private String passwordHash;
    private String realName;
    private String email;
    private String phone;
    private String status;
}
