CREATE TABLE IF NOT EXISTS chat_tasks (
    id          VARCHAR(36)  PRIMARY KEY,
    user_id     BIGINT       NOT NULL,
    title       VARCHAR(128) NOT NULL DEFAULT '新任务',
    session_id  VARCHAR(64)  NOT NULL,
    pinned      TINYINT(1)   NOT NULL DEFAULT 0,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_chat_task_user FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_chat_task_user_updated (user_id, updated_at DESC),
    INDEX idx_chat_task_session (user_id, session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS chat_messages (
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
