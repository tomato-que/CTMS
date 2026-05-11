package com.ctms.common;

import java.util.UUID;

public class TraceContext {
    private static final ThreadLocal<String> TRACE_ID = new ThreadLocal<>();

    public static void setTraceId(String traceId) {
        TRACE_ID.set(traceId);
    }

    public static String getTraceId() {
        String id = TRACE_ID.get();
        if (id == null) {
            id = UUID.randomUUID().toString();
            TRACE_ID.set(id);
        }
        return id;
    }

    public static void clear() {
        TRACE_ID.remove();
    }
}
