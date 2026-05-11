package com.ctms.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.ctms.entity.Subject;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface SubjectMapper extends BaseMapper<Subject> {
    @Select("SELECT COUNT(*) FROM subjects WHERE study_id = #{studyId} AND is_deleted = 0")
    Long countByStudy(@Param("studyId") String studyId);
}
