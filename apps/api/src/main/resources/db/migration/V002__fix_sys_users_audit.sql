-- V002: Add missing audit columns to sys_users (MySQL 8.0)
SET @exist_created_by := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='ctms_db' AND TABLE_NAME='sys_users' AND COLUMN_NAME='created_by');
SET @sql_add_created_by := IF(@exist_created_by = 0, 'ALTER TABLE sys_users ADD COLUMN created_by VARCHAR(36) DEFAULT NULL AFTER status', 'SELECT 1');
PREPARE stmt FROM @sql_add_created_by; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist_updated_by := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='ctms_db' AND TABLE_NAME='sys_users' AND COLUMN_NAME='updated_by');
SET @sql_add_updated_by := IF(@exist_updated_by = 0, 'ALTER TABLE sys_users ADD COLUMN updated_by VARCHAR(36) DEFAULT NULL AFTER created_by', 'SELECT 1');
PREPARE stmt FROM @sql_add_updated_by; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist_deleted_at := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='ctms_db' AND TABLE_NAME='sys_users' AND COLUMN_NAME='deleted_at');
SET @sql_add_deleted_at := IF(@exist_deleted_at = 0, 'ALTER TABLE sys_users ADD COLUMN deleted_at DATETIME DEFAULT NULL AFTER updated_by', 'SELECT 1');
PREPARE stmt FROM @sql_add_deleted_at; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist_version := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='ctms_db' AND TABLE_NAME='sys_users' AND COLUMN_NAME='version');
SET @sql_add_version := IF(@exist_version = 0, 'ALTER TABLE sys_users ADD COLUMN version INT NOT NULL DEFAULT 0 AFTER deleted_at', 'SELECT 1');
PREPARE stmt FROM @sql_add_version; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Fix admin password (plaintext for dev)
UPDATE sys_users SET password_hash = 'admin123' WHERE username = 'admin';
