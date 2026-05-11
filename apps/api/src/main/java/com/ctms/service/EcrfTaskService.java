package com.ctms.service;

import com.ctms.common.BusinessException;
import com.ctms.common.ResourceNotFoundException;
import com.ctms.entity.EcrfTask;
import com.ctms.mapper.EcrfTaskMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class EcrfTaskService {

    private final EcrfTaskMapper taskMapper;
    private final EcrfTaskStateMachine sm;

    public EcrfTask getById(String taskId) {
        EcrfTask t = taskMapper.selectById(taskId);
        if (t == null) throw new ResourceNotFoundException(null);
        return t;
    }

    @Transactional
    public EcrfTask create(EcrfTask task) {
        task.setStatus("DRAFT");
        taskMapper.insert(task);
        return task;
    }

    @Transactional
    public EcrfTask submit(String taskId) {
        EcrfTask t = getById(taskId);
        if (!sm.canTransition(t.getStatus(), "SUBMITTED"))
            throw new BusinessException(null, "当前状态不允许提交: " + t.getStatus());
        t.setStatus("PENDING_REVIEW");
        t.setSubmittedAt(LocalDateTime.now());
        taskMapper.updateById(t);
        return t;
    }

    @Transactional
    public EcrfTask review(String taskId, boolean approved) {
        EcrfTask t = getById(taskId);
        if (!"PENDING_REVIEW".equals(t.getStatus()))
            throw new BusinessException(null, "仅待审核状态可审核");
        if (approved) {
            t.setStatus("APPROVED");
            t.setLockedAt(LocalDateTime.now());
            t.setStatus("LOCKED"); // atomic transition
        } else {
            t.setStatus("REJECTED");
        }
        taskMapper.updateById(t);
        return t;
    }

    @Transactional
    public EcrfTask updateSdvStatus(String taskId, String sdvStatus) {
        EcrfTask t = getById(taskId);
        t.setSdvStatus(sdvStatus);
        if ("COMPLETED".equals(sdvStatus)) t.setSdvCompletedAt(LocalDateTime.now());
        taskMapper.updateById(t);
        return t;
    }

    public Map<String, Object> getStats(String studyId) {
        long total = taskMapper.selectCount(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<EcrfTask>()
                .eq(EcrfTask::getStudyId, studyId));
        long locked = taskMapper.selectCount(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<EcrfTask>()
                .eq(EcrfTask::getStudyId, studyId).eq(EcrfTask::getStatus, "LOCKED"));
        long sdvDone = taskMapper.selectCount(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<EcrfTask>()
                .eq(EcrfTask::getStudyId, studyId).eq(EcrfTask::getSdvStatus, "COMPLETED"));
        return Map.of("total", total, "locked", locked, "sdvCompleted", sdvDone,
            "sdvRate", locked > 0 ? Math.round(1000.0 * sdvDone / locked) / 10.0 : 0);
    }
}
