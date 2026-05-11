package com.ctms.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.ctms.common.ApiResponse;
import com.ctms.entity.Ae;
import com.ctms.mapper.AeMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/aes")
@RequiredArgsConstructor
public class AeController {
    private final AeMapper aeMapper;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_PM','ROLE_CRA','ROLE_CRC','ROLE_PI')")
    public ApiResponse<List<Ae>> listAes(@RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(aeMapper.selectList(
                new LambdaQueryWrapper<Ae>().orderByDesc(Ae::getCreatedAt).last("LIMIT " + size)));
    }

    @GetMapping("/study/{studyId}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_PM','ROLE_CRA','ROLE_CRC','ROLE_PI')")
    public ApiResponse<List<Ae>> getStudyAes(@PathVariable String studyId) {
        return ApiResponse.success(aeMapper.selectList(
                new LambdaQueryWrapper<Ae>().eq(Ae::getStudyId, studyId)));
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_CRA','ROLE_CRC','ROLE_PI')")
    public ApiResponse<Ae> reportAe(@RequestBody java.util.Map<String, Object> body) {
        Ae ae = new Ae();
        ae.setStudyId((String) body.getOrDefault("studyId", ""));
        ae.setSiteId((String) body.getOrDefault("siteId", null));
        ae.setSubjectId((String) body.getOrDefault("subjectId", ""));
        ae.setAeNumber((String) body.getOrDefault("aeNumber", "AE-" + System.currentTimeMillis()));
        ae.setAeTerm((String) body.getOrDefault("aeTerm", ""));
        ae.setSeverityGrade(body.get("severityGrade") != null ?
                Integer.parseInt(body.get("severityGrade").toString()) : 1);
        ae.setCausality((String) body.getOrDefault("causality", ""));
        // onsetDate: accept String or parse
        Object od = body.get("onsetDate");
        if (od != null) {
            try { ae.setOnsetDate(java.time.LocalDate.parse(od.toString())); }
            catch (Exception e) { ae.setOnsetDate(java.time.LocalDate.now()); }
        }
        ae.setOutcome((String) body.getOrDefault("outcome", ""));
        ae.setIsSerious(body.get("isSerious") != null ?
                Integer.parseInt(body.get("isSerious").toString()) : 0);
        ae.setStatus((String) body.getOrDefault("status", "REPORTED"));
        aeMapper.insert(ae);
        return ApiResponse.success(ae);
    }
}
