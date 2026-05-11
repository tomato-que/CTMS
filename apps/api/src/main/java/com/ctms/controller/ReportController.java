package com.ctms.controller;

import com.ctms.common.ApiResponse;
import com.ctms.mapper.ReportMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportMapper reportMapper;

    /**
     * Dashboard: summary cards + charts data
     * Response: { summary: {...}, enrollmentTrend: [...], centerRanking: [...],
     *             queryDistribution: [...], aeDistribution: [...], etmfStats: [...] }
     */
    @GetMapping("/dashboard")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_PM','ROLE_SPONSOR','ROLE_CRA')")
    public ApiResponse<Map<String, Object>> dashboard(
            @RequestParam(required = false) String studyId,
            @RequestParam(required = false) String siteId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalStudies", reportMapper.countTotalStudies());
        summary.put("activeStudies", reportMapper.countActiveStudies());
        summary.put("totalSubjects", reportMapper.countTotalSubjects());
        summary.put("subjectsThisMonth", reportMapper.countSubjectsThisMonth());
        summary.put("pendingQueries", reportMapper.countPendingQueries());
        summary.put("openAes", reportMapper.countOpenAes());
        summary.put("overdueVisits", reportMapper.countOverdueVisits());

        // eTMF completion rate
        List<Map<String, Object>> etmfStats = reportMapper.etmfCategoryStats();
        long totalDocs = etmfStats.stream().mapToLong(m -> ((Number) m.get("cnt")).longValue()).sum();
        long uploadedDocs = etmfStats.stream()
                .filter(m -> "UPLOADED".equals(m.get("status")))
                .mapToLong(m -> ((Number) m.get("cnt")).longValue()).sum();
        double etmfRate = totalDocs > 0 ? Math.round(1000.0 * uploadedDocs / totalDocs) / 10.0 : 0;
        summary.put("etmfCompletionRate", etmfRate);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("summary", summary);
        result.put("enrollmentTrend", reportMapper.enrollmentTrend());
        result.put("centerRanking", reportMapper.centerRanking());
        result.put("queryDistribution", reportMapper.queryStatusDistribution());
        result.put("aeDistribution", reportMapper.aeSeverityDistribution());
        result.put("etmfStats", etmfStats);
        result.put("studyList", reportMapper.studyList());
        result.put("siteList", reportMapper.siteList());

        return ApiResponse.success(result);
    }

    /**
     * Detail table: per-study aggregated stats with filters
     */
    @GetMapping("/detail")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_PM','ROLE_SPONSOR','ROLE_CRA')")
    public ApiResponse<List<Map<String, Object>>> detail(
            @RequestParam(required = false) String studyId,
            @RequestParam(required = false) String siteId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        return ApiResponse.success(reportMapper.reportDetail(studyId, siteId, startDate, endDate));
    }

    /**
     * Export to Excel (CSV format)
     */
    @GetMapping("/export")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_PM','ROLE_SPONSOR')")
    public ResponseEntity<byte[]> export(
            @RequestParam(required = false) String studyId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {

        List<Map<String, Object>> rows = reportMapper.reportDetail(studyId, null, startDate, endDate);

        StringBuilder csv = new StringBuilder();
        csv.append("﻿"); // BOM for Excel UTF-8
        csv.append("项目编号,项目标题,项目状态,受试者数,Query数,AE数,逾期访视数,文档总数,已完成文档,eTMF完成率(%)\n");

        for (Map<String, Object> row : rows) {
            csv.append(formatCsv(row.get("studyCode"))).append(",");
            csv.append(formatCsv(row.get("studyTitle"))).append(",");
            csv.append(formatCsv(row.get("studyStatus"))).append(",");
            csv.append(row.get("subjectCount")).append(",");
            csv.append(row.get("queryCount")).append(",");
            csv.append(row.get("aeCount")).append(",");
            csv.append(row.get("overdueVisitCount")).append(",");
            csv.append(row.get("totalDocs")).append(",");
            csv.append(row.get("completedDocs")).append(",");
            csv.append(row.get("etmfCompletionRate")).append("\n");
        }

        byte[] bytes = csv.toString().getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=ctms_report_" + java.time.LocalDate.now() + ".csv")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(bytes);
    }

    private String formatCsv(Object val) {
        if (val == null) return "";
        String s = val.toString().replace("\"", "\"\"");
        return s.contains(",") || s.contains("\n") ? "\"" + s + "\"" : s;
    }
}
