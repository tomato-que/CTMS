package com.ctms.service;

import com.ctms.enums.StudyStatus;
import org.springframework.stereotype.Component;
import java.util.Map;
import java.util.Set;

@Component
public class StudyStateMachine {

    private static final Map<StudyStatus, Set<StudyStatus>> ALLOWED = Map.of(
            StudyStatus.DRAFT,     Set.of(StudyStatus.STARTUP, StudyStatus.ARCHIVED),
            StudyStatus.STARTUP,   Set.of(StudyStatus.ENROLLING, StudyStatus.ARCHIVED),
            StudyStatus.ENROLLING, Set.of(StudyStatus.FOLLOWUP),
            StudyStatus.FOLLOWUP,  Set.of(StudyStatus.LOCKED),
            StudyStatus.LOCKED,    Set.of(StudyStatus.ARCHIVED),
            StudyStatus.ARCHIVED,  Set.of()
    );

    public boolean canTransition(StudyStatus from, StudyStatus to) {
        Set<StudyStatus> allowed = ALLOWED.get(from);
        return allowed != null && allowed.contains(to);
    }
}
