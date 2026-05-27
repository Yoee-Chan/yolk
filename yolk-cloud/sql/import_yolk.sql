-- Yolk Cloud 完整库表与种子数据（可重复执行前请先 DROP DATABASE 或手动删表）
-- 用法: mysql -u root -p < sql/import_yolk.sql

CREATE DATABASE IF NOT EXISTS yolk CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE yolk;

DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_tasks;
DROP TABLE IF EXISTS client_logs;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS usage_records;
DROP TABLE IF EXISTS user_traffic;
DROP TABLE IF EXISTS recharge_packages;
DROP TABLE IF EXISTS traffic_plans;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    email         VARCHAR(128) NULL UNIQUE,
    phone         VARCHAR(20)  NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nickname      VARCHAR(64)  NOT NULL DEFAULT '',
    avatar_url    MEDIUMTEXT   NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE traffic_plans (
    id           VARCHAR(32)   PRIMARY KEY,
    name         VARCHAR(64)   NOT NULL,
    total_tokens BIGINT        NOT NULL,
    price        DECIMAL(10,2) NOT NULL,
    description  VARCHAR(255)  NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE recharge_packages (
    id             VARCHAR(32)   PRIMARY KEY,
    name           VARCHAR(64)   NOT NULL,
    tokens         BIGINT        NOT NULL,
    price          DECIMAL(10,2) NOT NULL,
    original_price DECIMAL(10,2) NULL,
    tag            VARCHAR(32)   NULL,
    hot            TINYINT(1)    NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_traffic (
    user_id      BIGINT PRIMARY KEY,
    plan_id      VARCHAR(32) NOT NULL,
    total_tokens BIGINT      NOT NULL DEFAULT 0,
    used_tokens  BIGINT      NOT NULL DEFAULT 0,
    renew_date   DATE        NOT NULL,
    daily_limit  BIGINT      NOT NULL DEFAULT 80000,
    CONSTRAINT fk_user_traffic_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_user_traffic_plan FOREIGN KEY (plan_id) REFERENCES traffic_plans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE usage_records (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id     BIGINT      NOT NULL,
    period_type VARCHAR(8)  NOT NULL,
    label       VARCHAR(16) NOT NULL,
    tokens      BIGINT      NOT NULL,
    recorded_at DATE        NOT NULL,
    CONSTRAINT fk_usage_user FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE KEY uk_usage_user_period (user_id, period_type, label, recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE orders (
    id           VARCHAR(36) PRIMARY KEY,
    user_id      BIGINT      NOT NULL,
    package_id   VARCHAR(32) NOT NULL,
    package_name VARCHAR(64) NOT NULL,
    tokens       BIGINT      NOT NULL,
    amount       DECIMAL(10,2) NOT NULL,
    status       VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    qr_code_url  VARCHAR(512) NULL,
    created_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at      DATETIME    NULL,
    CONSTRAINT fk_order_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_order_package FOREIGN KEY (package_id) REFERENCES recharge_packages(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE client_logs (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id       BIGINT       NOT NULL,
    session_id    VARCHAR(64)  NULL,
    level         VARCHAR(16)  NOT NULL,
    logger_name   VARCHAR(255) NOT NULL DEFAULT '',
    function_name VARCHAR(128) NOT NULL DEFAULT '',
    line_no       INT          NOT NULL DEFAULT 0,
    message       TEXT         NOT NULL,
    logged_at     DATETIME(3)  NOT NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_client_log_user FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_client_log_user_time (user_id, logged_at),
    INDEX idx_client_log_session (user_id, session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE chat_tasks (
    id          VARCHAR(36)  PRIMARY KEY,
    user_id     BIGINT       NOT NULL,
    title       VARCHAR(128) NOT NULL DEFAULT '新任务',
    session_id  VARCHAR(64)  NOT NULL,
    pinned      TINYINT(1)   NOT NULL DEFAULT 0,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted     TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '0=正常 1=已删除',
    CONSTRAINT fk_chat_task_user FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_chat_task_user_updated (user_id, updated_at DESC),
    INDEX idx_chat_task_user_active (user_id, deleted, updated_at DESC),
    INDEX idx_chat_task_session (user_id, session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE chat_messages (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id    VARCHAR(36)  NOT NULL,
    user_id    BIGINT       NOT NULL,
    role       VARCHAR(16)  NOT NULL,
    content    MEDIUMTEXT   NOT NULL,
    sort_order INT          NOT NULL DEFAULT 0,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_chat_message_task FOREIGN KEY (task_id) REFERENCES chat_tasks(id) ON DELETE CASCADE,
    CONSTRAINT fk_chat_message_user FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_chat_message_task_order (task_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO traffic_plans (id, name, total_tokens, price, description) VALUES
('basic', '词元基础包', 100000, 19.90, '适合轻度使用'),
('pro', '词元畅享包', 500000, 59.90, '日常办公推荐'),
('flagship', '词元旗舰包', 2000000, 199.90, '高频 Agent 任务');

INSERT INTO recharge_packages (id, name, tokens, price, original_price, tag, hot) VALUES
('pack-s', '体验加量包', 50000, 9.90, NULL, '尝鲜', 0),
('pack-m', '标准加量包', 200000, 29.90, 39.90, NULL, 1),
('pack-l', '专业加量包', 500000, 59.90, 79.90, NULL, 0),
('pack-xl', '旗舰加量包', 1200000, 129.90, NULL, '最划算', 0);
