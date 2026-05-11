-- CTMS Core Tables (MySQL 8.0+)

CREATE TABLE IF NOT EXISTS studies (
    id          VARCHAR(36)  NOT NULL PRIMARY KEY,
    study_code  VARCHAR(50)  NOT NULL,
    title       VARCHAR(500) NOT NULL,
    short_title VARCHAR(200),
    phase       VARCHAR(20)  NOT NULL DEFAULT 'OTHER',
    therapeutic_area VARCHAR(100),
    indication  VARCHAR(200),
    sponsor_org_id VARCHAR(36),
    cro_org_id     VARCHAR(36),
    registration_number VARCHAR(100),
    status      VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    planned_sites    INT,
    planned_subjects INT,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by  VARCHAR(36),
    updated_by  VARCHAR(36),
    is_deleted  TINYINT   NOT NULL DEFAULT 0,
    deleted_at  DATETIME,
    version     INT       NOT NULL DEFAULT 0,
    UNIQUE KEY uk_study_code (study_code),
    INDEX idx_studies_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sites (
    id          VARCHAR(36)  NOT NULL PRIMARY KEY,
    site_code   VARCHAR(50)  NOT NULL,
    name        VARCHAR(300) NOT NULL,
    org_id      VARCHAR(36),
    site_type   VARCHAR(20),
    address     TEXT,
    status      VARCHAR(20)  NOT NULL DEFAULT 'CANDIDATE',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by  VARCHAR(36),
    updated_by  VARCHAR(36),
    is_deleted  TINYINT   NOT NULL DEFAULT 0,
    deleted_at  DATETIME,
    version     INT       NOT NULL DEFAULT 0,
    UNIQUE KEY uk_site_code (site_code),
    INDEX idx_sites_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS study_sites (
    id              VARCHAR(36) NOT NULL PRIMARY KEY,
    study_id        VARCHAR(36) NOT NULL,
    site_id         VARCHAR(36) NOT NULL,
    site_status     VARCHAR(20) NOT NULL DEFAULT 'CANDIDATE',
    planned_subjects INT,
    actual_subjects  INT DEFAULT 0,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by  VARCHAR(36),
    updated_by  VARCHAR(36),
    is_deleted  TINYINT   NOT NULL DEFAULT 0,
    deleted_at  DATETIME,
    version     INT       NOT NULL DEFAULT 0,
    UNIQUE KEY uk_study_site (study_id, site_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subjects (
    id                  VARCHAR(36)  NOT NULL PRIMARY KEY,
    study_id            VARCHAR(36)  NOT NULL,
    site_id             VARCHAR(36)  NOT NULL,
    subject_number      VARCHAR(50)  NOT NULL,
    real_name           VARCHAR(200),
    phone               VARCHAR(50),
    gender              VARCHAR(10),
    birth_date          DATE,
    enrollment_date     DATE,
    status              VARCHAR(20)  NOT NULL DEFAULT 'LEAD',
    withdrawal_date     DATE,
    withdrawal_reason   VARCHAR(200),
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by  VARCHAR(36),
    updated_by  VARCHAR(36),
    is_deleted  TINYINT   NOT NULL DEFAULT 0,
    deleted_at  DATETIME,
    version     INT       NOT NULL DEFAULT 0,
    UNIQUE KEY uk_subject_study_site (study_id, site_id, subject_number),
    INDEX idx_subjects_study_status (study_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS visits (
    id              VARCHAR(36) NOT NULL PRIMARY KEY,
    subject_id      VARCHAR(36) NOT NULL,
    visit_number    INT         NOT NULL,
    planned_date    DATE,
    actual_date     DATE,
    status          VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by  VARCHAR(36),
    updated_by  VARCHAR(36),
    is_deleted  TINYINT   NOT NULL DEFAULT 0,
    deleted_at  DATETIME,
    version     INT       NOT NULL DEFAULT 0,
    INDEX idx_visits_subject (subject_id),
    INDEX idx_visits_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS aes (
    id              VARCHAR(36)  NOT NULL PRIMARY KEY,
    study_id        VARCHAR(36)  NOT NULL,
    site_id         VARCHAR(36)  NOT NULL,
    subject_id      VARCHAR(36)  NOT NULL,
    ae_number       VARCHAR(50)  NOT NULL,
    ae_term         VARCHAR(300) NOT NULL,
    onset_date      DATE         NOT NULL,
    severity_grade  INT          NOT NULL DEFAULT 1,
    causality       VARCHAR(20),
    is_serious      TINYINT      DEFAULT 0,
    outcome         VARCHAR(30),
    status          VARCHAR(20)  NOT NULL DEFAULT 'REPORTED',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by  VARCHAR(36),
    updated_by  VARCHAR(36),
    is_deleted  TINYINT   NOT NULL DEFAULT 0,
    deleted_at  DATETIME,
    version     INT       NOT NULL DEFAULT 0,
    INDEX idx_aes_subject (subject_id),
    INDEX idx_aes_study (study_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS queries (
    id              VARCHAR(36) NOT NULL PRIMARY KEY,
    study_id        VARCHAR(36) NOT NULL,
    site_id         VARCHAR(36) NOT NULL,
    subject_id      VARCHAR(36),
    query_type      VARCHAR(30) NOT NULL,
    description     TEXT        NOT NULL,
    response        TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    severity        VARCHAR(10) DEFAULT 'MEDIUM',
    aging_days      INT DEFAULT 0,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by  VARCHAR(36),
    updated_by  VARCHAR(36),
    is_deleted  TINYINT   NOT NULL DEFAULT 0,
    deleted_at  DATETIME,
    version     INT       NOT NULL DEFAULT 0,
    INDEX idx_queries_study (study_id),
    INDEX idx_queries_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS file_objects (
    id              VARCHAR(36)  NOT NULL PRIMARY KEY,
    original_name   VARCHAR(500) NOT NULL,
    storage_path    VARCHAR(1000) NOT NULL,
    bucket_name     VARCHAR(50)  NOT NULL DEFAULT 'raw',
    mime_type       VARCHAR(100),
    file_size       BIGINT,
    file_hash       VARCHAR(64),
    status          VARCHAR(20)  NOT NULL DEFAULT 'UPLOADING',
    belong_entity   VARCHAR(50),
    belong_id       VARCHAR(36),
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by  VARCHAR(36),
    updated_by  VARCHAR(36),
    is_deleted  TINYINT   NOT NULL DEFAULT 0,
    deleted_at  DATETIME,
    version     INT       NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ocr_jobs (
    id              VARCHAR(36) NOT NULL PRIMARY KEY,
    file_id         VARCHAR(36) NOT NULL,
    ocr_type        VARCHAR(30) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    result_json     JSON,
    confidence_json JSON,
    model_name      VARCHAR(100),
    model_version   VARCHAR(20),
    retry_count     INT DEFAULT 0,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by  VARCHAR(36),
    updated_by  VARCHAR(36),
    is_deleted  TINYINT   NOT NULL DEFAULT 0,
    deleted_at  DATETIME,
    version     INT       NOT NULL DEFAULT 0,
    INDEX idx_ocr_jobs_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
    id              VARCHAR(36)  NOT NULL PRIMARY KEY,
    trace_id        VARCHAR(64)  NOT NULL,
    user_id         VARCHAR(36),
    user_role       VARCHAR(50),
    operation_type  VARCHAR(30)  NOT NULL,
    target_entity   VARCHAR(100) NOT NULL,
    target_id       VARCHAR(36),
    target_field    VARCHAR(200),
    before_value    JSON,
    after_value     JSON,
    operation_detail JSON,
    ip_address      VARCHAR(45),
    sensitivity_level VARCHAR(5),
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_target (target_entity, target_id, created_at),
    INDEX idx_audit_user (user_id, created_at),
    INDEX idx_audit_type (operation_type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
    id                VARCHAR(36)  NOT NULL PRIMARY KEY,
    user_id           VARCHAR(36)  NOT NULL,
    notification_type VARCHAR(50)  NOT NULL,
    title             VARCHAR(300) NOT NULL,
    content           TEXT,
    is_read           TINYINT DEFAULT 0,
    priority          VARCHAR(10) DEFAULT 'MEDIUM',
    action_url        VARCHAR(500),
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notifications_user (user_id, is_read, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- System tables
CREATE TABLE IF NOT EXISTS sys_users (
    id              VARCHAR(36)  NOT NULL PRIMARY KEY,
    username        VARCHAR(50)  NOT NULL,
    password_hash   VARCHAR(200) NOT NULL,
    real_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(200),
    phone           VARCHAR(50),
    status          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_deleted  TINYINT   NOT NULL DEFAULT 0,
    UNIQUE KEY uk_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sys_roles (
    id          VARCHAR(36)  NOT NULL PRIMARY KEY,
    role_code   VARCHAR(50)  NOT NULL,
    role_name   VARCHAR(100) NOT NULL,
    description VARCHAR(300),
    is_system   TINYINT DEFAULT 0,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_role_code (role_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default admin user (password: admin123, BCrypt hashed)
INSERT IGNORE INTO sys_users (id, username, password_hash, real_name, status) VALUES
('u-admin-001', 'admin', '$2a$12$LJ3m4ys3GZfnYMz8kVsqOeWKDMm1b7FxH8G0XZ6yZxDq9Yq5NzPXO', '管理员', 'ACTIVE');

INSERT IGNORE INTO sys_roles (id, role_code, role_name, is_system) VALUES
('r-admin', 'ROLE_ADMIN', '系统管理员', 1),
('r-pm',    'ROLE_PM',    '项目经理', 1),
('r-cra',   'ROLE_CRA',   '临床监查员', 1),
('r-crc',   'ROLE_CRC',   '临床研究协调员', 1),
('r-pi',    'ROLE_PI',    '主要研究者', 1);
