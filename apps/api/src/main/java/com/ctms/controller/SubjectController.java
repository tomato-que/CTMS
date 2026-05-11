package com.ctms.controller;

import com.ctms.common.ApiResponse;
import com.ctms.entity.Subject;
import com.ctms.enums.SubjectStatus;
import com.ctms.service.SubjectService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/subjects")
@RequiredArgsConstructor
public class SubjectController {
    private final SubjectService subjectService;

    @GetMapping("/{subjectId}")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_PM','ROLE_CRA','ROLE_CRC','ROLE_PI')")
    public ApiResponse<Subject> getSubject(@PathVariable String subjectId) {
        return ApiResponse.success(subjectService.getById(subjectId));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CRC')")
    public ApiResponse<Subject> createSubject(@RequestBody Subject subject) {
        return ApiResponse.success(subjectService.create(subject));
    }

    @PutMapping("/{subjectId}/status")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CRC','ROLE_PI')")
    public ApiResponse<Subject> transitionStatus(@PathVariable String subjectId,
                                                  @RequestParam SubjectStatus targetStatus) {
        return ApiResponse.success(subjectService.transitionStatus(subjectId, targetStatus));
    }
}
