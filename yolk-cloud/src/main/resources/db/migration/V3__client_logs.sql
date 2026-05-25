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
