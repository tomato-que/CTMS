package com.ctms.service;

import com.ctms.common.BusinessException;
import com.ctms.common.ErrorCode;
import com.ctms.common.ResourceNotFoundException;
import com.ctms.entity.Subject;
import com.ctms.enums.SubjectStatus;
import com.ctms.mapper.SubjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class SubjectService {
    private final SubjectMapper subjectMapper;

    public Subject getById(String subjectId) {
        Subject s = subjectMapper.selectById(subjectId);
        if (s == null) throw new ResourceNotFoundException(ErrorCode.SUBJECT_NOT_FOUND);
        return s;
    }

    @Transactional
    public Subject create(Subject subject) {
        subject.setStatus(SubjectStatus.LEAD);
        subjectMapper.insert(subject);
        return subject;
    }

    @Transactional
    public Subject transitionStatus(String subjectId, SubjectStatus targetStatus) {
        Subject s = subjectMapper.selectById(subjectId);
        if (s == null) throw new ResourceNotFoundException(ErrorCode.SUBJECT_NOT_FOUND);
        s.setStatus(targetStatus);
        subjectMapper.updateById(s);
        return s;
    }
}
