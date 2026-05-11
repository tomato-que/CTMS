package com.ctms.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.ctms.common.ApiResponse;
import com.ctms.entity.EcrfTask;
import com.ctms.mapper.EcrfTaskMapper;
import com.ctms.service.EcrfTaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/v1/ecrf/tasks")
@RequiredArgsConstructor
public class EcrfTaskController {

    private final EcrfTaskMapper taskMapper;
    private final EcrfTaskService taskService;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_PM','ROLE_CRA','ROLE_CRC')")
    public ApiResponse<List<EcrfTask>> list(
            @RequestParam(required = false) String studyId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String assignedTo,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        LambdaQueryWrapper<EcrfTask> q = new LambdaQueryWrapper<EcrfTask>()
            .eq(studyId != null, EcrfTask::getStudyId, studyId)
            .eq(status != null, EcrfTask::getStatus, status)
            .eq(assignedTo != null, EcrfTask::getAssignedTo, assignedTo)
            .orderByDesc(EcrfTask::getCreatedAt);
        Page<EcrfTask> p = new Page<>(page, size);
        taskMapper.selectPage(p, q);
        return ApiResponse.success(p.getRecords());
    }

    @GetMapping("/{taskId}")
    public ApiResponse<EcrfTask> get(@PathVariable String taskId) {
        return ApiResponse.success(taskService.getById(taskId));
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_CRC')")
    public ApiResponse<EcrfTask> create(@RequestBody EcrfTask task) {
        return ApiResponse.success(taskService.create(task));
    }

    @PutMapping("/{taskId}/submit")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_CRC')")
    public ApiResponse<EcrfTask> submit(@PathVariable String taskId) {
        return ApiResponse.success(taskService.submit(taskId));
    }

    @PutMapping("/{taskId}/review")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_PI')")
    public ApiResponse<EcrfTask> review(@PathVariable String taskId, @RequestBody Map<String, Object> body) {
        boolean approved = "APPROVE".equals(body.get("action"));
        return ApiResponse.success(taskService.review(taskId, approved));
    }

    @PutMapping("/{taskId}/sdv")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_CRA')")
    public ApiResponse<EcrfTask> updateSdv(@PathVariable String taskId, @RequestBody Map<String, String> body) {
        return ApiResponse.success(taskService.updateSdvStatus(taskId, body.get("sdvStatus")));
    }

    @GetMapping("/stats")
    public ApiResponse<Map<String, Object>> stats(@RequestParam(required = false) String studyId) {
        return ApiResponse.success(taskService.getStats(studyId));
    }
}
