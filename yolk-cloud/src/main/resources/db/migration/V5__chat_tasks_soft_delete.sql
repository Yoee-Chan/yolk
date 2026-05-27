ALTER TABLE chat_tasks
    ADD COLUMN deleted TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0=正常 1=已删除' AFTER updated_at;

CREATE INDEX idx_chat_task_user_active ON chat_tasks (user_id, deleted, updated_at DESC);
