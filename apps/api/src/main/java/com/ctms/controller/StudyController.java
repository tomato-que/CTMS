package com.ctms.controller;

import com.ctms.common.ApiResponse;
import com.ctms.entity.Study;
import com.ctms.enums.StudyStatus;
import com.ctms.service.StudyService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/studies")
@RequiredArgsConstructor
public class StudyController {

    private final StudyService studyService;

    @GetMapping("/{studyId}")
    @PreAuthorize("hasAnyRole('ROLE_PM','ROLE_CRA','ROLE_CRC','ROLE_PI','ROLE_SPONSOR')")
    public ApiResponse<Study> getStudy(@PathVariable String studyId) {
        return ApiResponse.success(studyService.getById(studyId));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_PM')")
    public ApiResponse<Study> createStudy(@RequestBody Study study) {
        return ApiResponse.success(studyService.create(study));
    }

    @PutMapping("/{studyId}/status")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_PM')")
    public ApiResponse<Study> transitionStatus(@PathVariable String studyId,
                                                @RequestParam StudyStatus targetStatus) {
        return ApiResponse.success(studyService.transitionStatus(studyId, targetStatus));
    }
}
