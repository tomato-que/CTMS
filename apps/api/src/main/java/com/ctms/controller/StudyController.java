package com.ctms.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.ctms.common.ApiResponse;
import com.ctms.entity.Study;
import com.ctms.enums.StudyStatus;
import com.ctms.mapper.StudyMapper;
import com.ctms.service.StudyService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/studies")
@RequiredArgsConstructor
public class StudyController {

    private final StudyService studyService;
    private final StudyMapper studyMapper;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_PM','ROLE_CRA','ROLE_SPONSOR')")
    public ApiResponse<List<Study>> listStudies(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<Study> p = new Page<>(page, size);
        studyMapper.selectPage(p, new LambdaQueryWrapper<Study>().orderByDesc(Study::getCreatedAt));
        return ApiResponse.success(p.getRecords());
    }

    @GetMapping("/{studyId}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_PM','ROLE_CRA','ROLE_CRC','ROLE_PI','ROLE_SPONSOR')")
    public ApiResponse<Study> getStudy(@PathVariable String studyId) {
        return ApiResponse.success(studyService.getById(studyId));
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_PM')")
    public ApiResponse<Study> createStudy(@RequestBody Study study) {
        return ApiResponse.success(studyService.create(study));
    }

    @PutMapping("/{studyId}/status")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_PM')")
    public ApiResponse<Study> transitionStatus(@PathVariable String studyId,
                                                @RequestParam StudyStatus targetStatus) {
        return ApiResponse.success(studyService.transitionStatus(studyId, targetStatus));
    }
}
