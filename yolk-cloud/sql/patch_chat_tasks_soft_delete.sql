-- 为已有库增加任务软删除标志（0=正常 1=已删除），执行后重启 yolk-cloud
USE yolk;

ALTER TABLE chat_tasks
    ADD COLUMN deleted TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0=正常 1=已删除' AFTER updated_at;

CREATE INDEX idx_chat_task_user_active ON chat_tasks (user_id, deleted, updated_at DESC);

-- 若此前已加过 deleted_at 列，可再执行以下语句完成迁移：
-- UPDATE chat_tasks SET deleted = 1 WHERE deleted_at IS NOT NULL;
-- ALTER TABLE chat_tasks DROP COLUMN deleted_at;
