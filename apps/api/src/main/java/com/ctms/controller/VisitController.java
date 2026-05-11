package com.ctms.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.ctms.common.ApiResponse;
import com.ctms.entity.Visit;
import com.ctms.mapper.VisitMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/visits")
@RequiredArgsConstructor
public class VisitController {
    private final VisitMapper visitMapper;

    @GetMapping("/subject/{subjectId}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_CRA','ROLE_CRC','ROLE_PI')")
    public ApiResponse<List<Visit>> getSubjectVisits(@PathVariable String subjectId) {
        return ApiResponse.success(visitMapper.selectList(
                new LambdaQueryWrapper<Visit>().eq(Visit::getSubjectId, subjectId)));
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_CRC')")
    public ApiResponse<Visit> createVisit(@RequestBody Visit visit) {
        visitMapper.insert(visit);
        return ApiResponse.success(visit);
    }
}
