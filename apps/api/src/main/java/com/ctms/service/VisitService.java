package com.ctms.service;

import com.ctms.common.ResourceNotFoundException;
import com.ctms.common.ErrorCode;
import com.ctms.entity.Visit;
import com.ctms.enums.VisitStatus;
import com.ctms.mapper.VisitMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@RequiredArgsConstructor
public class VisitService {
    private final VisitMapper visitMapper;

    public Visit getById(String id) {
        Visit v = visitMapper.selectById(id);
        if (v == null) throw new ResourceNotFoundException(ErrorCode.VISIT_NOT_FOUND);
        return v;
    }

    public List<Visit> listBySubject(String subjectId) {
        return visitMapper.selectList(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<Visit>()
                .eq(Visit::getSubjectId, subjectId)
                .orderByAsc(Visit::getVisitNumber));
    }

    @Transactional
    public Visit create(Visit visit) {
        visit.setStatus(VisitStatus.PLANNED.name());
        visitMapper.insert(visit);
        return visit;
    }

    @Transactional
    public Visit updateStatus(String id, VisitStatus status) {
        Visit v = getById(id);
        v.setStatus(status.name());
        visitMapper.updateById(v);
        return v;
    }
}
