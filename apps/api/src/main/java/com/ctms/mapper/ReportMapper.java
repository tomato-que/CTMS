package com.ctms.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

@Mapper
public interface ReportMapper {

    /** Dashboard summary: key counts across all modules */
    @Select("SELECT COUNT(*) FROM studies WHERE is_deleted = 0")
    Long countTotalStudies();

    @Select("SELECT COUNT(*) FROM studies WHERE is_deleted = 0 AND status IN ('ENROLLING','FOLLOWUP','STARTUP')")
    Long countActiveStudies();

    @Select("SELECT COUNT(*) FROM subjects WHERE is_deleted = 0")
    Long countTotalSubjects();

    @Select("SELECT COUNT(*) FROM subjects WHERE is_deleted = 0 AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')")
    Long countSubjectsThisMonth();

    @Select("SELECT COUNT(*) FROM queries WHERE is_deleted = 0 AND status = 'OPEN'")
    Long countPendingQueries();

    @Select("SELECT COUNT(*) FROM aes WHERE is_deleted = 0 AND status = 'REPORTED'")
    Long countOpenAes();

    @Select("SELECT COUNT(*) FROM visits WHERE is_deleted = 0 AND status = 'OVERDUE'")
    Long countOverdueVisits();

    /** Enrollment trend: monthly cumulative */
    @Select("SELECT DATE_FORMAT(created_at,'%Y-%m') AS month, COUNT(*) AS cnt FROM subjects WHERE is_deleted = 0 GROUP BY month ORDER BY month")
    List<Map<String, Object>> enrollmentTrend();

    /** Center enrollment ranking */
    @Select("SELECT s.name AS centerName, COUNT(sub.id) AS cnt " +
            "FROM subjects sub LEFT JOIN sites s ON sub.site_id = s.id " +
            "WHERE sub.is_deleted = 0 GROUP BY sub.site_id, s.name ORDER BY cnt DESC LIMIT 10")
    List<Map<String, Object>> centerRanking();

    /** Query status distribution */
    @Select("SELECT status, COUNT(*) AS cnt FROM queries WHERE is_deleted = 0 GROUP BY status")
    List<Map<String, Object>> queryStatusDistribution();

    /** AE severity distribution */
    @Select("SELECT severity_grade AS severity, COUNT(*) AS cnt FROM aes WHERE is_deleted = 0 GROUP BY severity_grade")
    List<Map<String, Object>> aeSeverityDistribution();

    /** eTMF category completion: by document type */
    @Select("SELECT belong_entity AS category, status, COUNT(*) AS cnt FROM file_objects WHERE is_deleted = 0 GROUP BY belong_entity, status")
    List<Map<String, Object>> etmfCategoryStats();

    /** Detail table: study-site level stats */
    List<Map<String, Object>> reportDetail(@Param("studyId") String studyId,
                                           @Param("siteId") String siteId,
                                           @Param("startDate") String startDate,
                                           @Param("endDate") String endDate);

    /** Study list for filter dropdown */
    @Select("SELECT id, study_code AS studyCode, title FROM studies WHERE is_deleted = 0 ORDER BY study_code")
    List<Map<String, Object>> studyList();

    /** Site list for filter dropdown */
    @Select("SELECT id, site_code AS siteCode, name FROM sites WHERE is_deleted = 0 ORDER BY site_code")
    List<Map<String, Object>> siteList();
}
