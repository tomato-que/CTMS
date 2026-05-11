package com.ctms.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.ctms.entity.EcrfFormDef;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface EcrfFormDefMapper extends BaseMapper<EcrfFormDef> {
    @Select("SELECT * FROM ecrf_form_defs WHERE study_id=#{studyId} AND form_code=#{formCode} AND status='PUBLISHED' AND is_deleted=0 ORDER BY version_number DESC LIMIT 1")
    EcrfFormDef findActiveByCode(@Param("studyId") String studyId, @Param("formCode") String formCode);
}
