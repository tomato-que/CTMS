-- V003: eCRF Form Designer + Task Management tables

CREATE TABLE IF NOT EXISTS ecrf_form_defs (
    id              VARCHAR(36)  NOT NULL PRIMARY KEY,
    study_id        VARCHAR(36)  NOT NULL,
    form_code       VARCHAR(50)  NOT NULL,
    form_name       VARCHAR(200) NOT NULL,
    form_category   VARCHAR(30)  NOT NULL DEFAULT 'GENERAL',
    version_number  INT          NOT NULL DEFAULT 1,
    status          VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    form_schema     JSON         NOT NULL,
    published_at    DATETIME,
    published_by    VARCHAR(36),
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by      VARCHAR(36),
    updated_by      VARCHAR(36),
    is_deleted      TINYINT      NOT NULL DEFAULT 0,
    deleted_at      DATETIME,
    version         INT          NOT NULL DEFAULT 0,
    UNIQUE KEY uk_form_version (study_id, form_code, version_number),
    INDEX idx_form_status (study_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ecrf_tasks (
    id              VARCHAR(36)  NOT NULL PRIMARY KEY,
    study_id        VARCHAR(36)  NOT NULL,
    site_id         VARCHAR(36),
    subject_id      VARCHAR(36)  NOT NULL,
    visit_id        VARCHAR(36),
    form_def_id     VARCHAR(36)  NOT NULL,
    task_number     VARCHAR(50)  NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    sdv_status      VARCHAR(20)  DEFAULT NULL,
    assigned_to     VARCHAR(36),
    reviewer_id     VARCHAR(36),
    sdv_reviewer_id VARCHAR(36),
    submitted_at    DATETIME,
    locked_at       DATETIME,
    sdv_completed_at DATETIME,
    due_date        DATE,
    priority        VARCHAR(10)  DEFAULT 'MEDIUM',
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by      VARCHAR(36),
    updated_by      VARCHAR(36),
    is_deleted      TINYINT      NOT NULL DEFAULT 0,
    deleted_at      DATETIME,
    version         INT          NOT NULL DEFAULT 0,
    INDEX idx_ecrf_task_subject (subject_id),
    INDEX idx_ecrf_task_status (study_id, status),
    INDEX idx_ecrf_task_assigned (assigned_to, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ecrf_responses (
    id              VARCHAR(36)  NOT NULL PRIMARY KEY,
    task_id         VARCHAR(36)  NOT NULL,
    form_def_id     VARCHAR(36)  NOT NULL,
    subject_id      VARCHAR(36)  NOT NULL,
    response_data   JSON         NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    submitted_at    DATETIME,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by      VARCHAR(36),
    updated_by      VARCHAR(36),
    is_deleted      TINYINT      NOT NULL DEFAULT 0,
    version         INT          NOT NULL DEFAULT 0,
    UNIQUE KEY uk_task_response (task_id),
    INDEX idx_response_subject (subject_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ecrf_sdv_records (
    id              VARCHAR(36)  NOT NULL PRIMARY KEY,
    task_id         VARCHAR(36)  NOT NULL,
    field_key       VARCHAR(100) NOT NULL,
    source_value    TEXT,
    ecrf_value      TEXT,
    is_match        TINYINT      DEFAULT 1,
    difference_note TEXT,
    reviewer_id     VARCHAR(36),
    reviewed_at     DATETIME,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sdv_task (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
