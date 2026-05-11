package com.ctms.service;

import org.springframework.stereotype.Component;
import java.util.Map;
import java.util.Set;

@Component
public class EcrfTaskStateMachine {

    private static final Map<String, Set<String>> TRANSITIONS = Map.of(
        "DRAFT",           Set.of("IN_PROGRESS"),
        "IN_PROGRESS",     Set.of("SUBMITTED", "DRAFT"),
        "SUBMITTED",       Set.of("PENDING_REVIEW"),
        "PENDING_REVIEW",  Set.of("APPROVED", "REJECTED"),
        "REJECTED",        Set.of("IN_PROGRESS"),
        "APPROVED",        Set.of("LOCKED"),
        "LOCKED",          Set.of()
    );

    public boolean canTransition(String from, String to) {
        Set<String> allowed = TRANSITIONS.get(from);
        return allowed != null && allowed.contains(to);
    }

    public String getNextOnSubmit(String current) { return "PENDING_REVIEW"; }
    public String getNextOnApprove() { return "LOCKED"; }
    public String getNextOnReject() { return "REJECTED"; }
}
