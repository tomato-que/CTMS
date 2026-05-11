package com.ctms.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.ctms.entity.SysUser;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface SysUserMapper extends BaseMapper<SysUser> {
    @Select("SELECT * FROM sys_users WHERE username = #{username} AND is_deleted = 0 LIMIT 1")
    SysUser findByUsername(@Param("username") String username);
}
