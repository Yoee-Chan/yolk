-- 仅当曾执行过含 deleted_at 的旧版软删除脚本时使用：迁移为 deleted 0/1 标志
USE yolk;

UPDATE chat_tasks SET deleted = 1 WHERE deleted_at IS NOT NULL;

ALTER TABLE chat_tasks DROP COLUMN deleted_at;

-- 若 idx_chat_task_user_active 已存在且列不同，请先 DROP 再 CREATE
-- DROP INDEX idx_chat_task_user_active ON chat_tasks;
-- CREATE INDEX idx_chat_task_user_active ON chat_tasks (user_id, deleted, updated_at DESC);
