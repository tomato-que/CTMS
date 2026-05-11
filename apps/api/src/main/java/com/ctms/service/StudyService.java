package com.ctms.service;

import com.ctms.common.BusinessException;
import com.ctms.common.ErrorCode;
import com.ctms.common.ResourceNotFoundException;
import com.ctms.entity.Study;
import com.ctms.enums.StudyStatus;
import com.ctms.mapper.StudyMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class StudyService {

    private final StudyMapper studyMapper;
    private final StudyStateMachine stateMachine;

    public Study getById(String studyId) {
        Study study = studyMapper.selectById(studyId);
        if (study == null) {
            throw new ResourceNotFoundException(ErrorCode.STUDY_NOT_FOUND);
        }
        return study;
    }

    @Transactional
    public Study create(Study study) {
        study.setStatus(StudyStatus.DRAFT);
        studyMapper.insert(study);
        return study;
    }

    @Transactional
    public Study transitionStatus(String studyId, StudyStatus targetStatus) {
        Study study = studyMapper.selectById(studyId);
        if (study == null) {
            throw new ResourceNotFoundException(ErrorCode.STUDY_NOT_FOUND);
        }
        if (!stateMachine.canTransition(study.getStatus(), targetStatus)) {
            throw new BusinessException(ErrorCode.STUDY_STATUS_TRANSITION_INVALID,
                    "Cannot transition from " + study.getStatus() + " to " + targetStatus);
        }
        study.setStatus(targetStatus);
        studyMapper.updateById(study);
        return study;
    }
}
