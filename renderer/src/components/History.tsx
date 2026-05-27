import React from 'react';
import {DeleteOutlined, PlusOutlined, PushpinOutlined} from '@ant-design/icons';
import type {ChatTaskSummary} from '../api/cloudApi';

interface HistoryProps {
    tasks: ChatTaskSummary[];
    activeTaskId: string | null;
    onSelect: (id: string) => void;
    onNewTask: () => void;
    onTogglePin?: (id: string, pinned: boolean) => void;
    onDelete?: (id: string) => void;
    disabled?: boolean;
}

export default function History({
    tasks,
    activeTaskId,
    onSelect,
    onNewTask,
    onTogglePin,
    onDelete,
    disabled,
}: HistoryProps) {
    return (
        <div className="sidebar-history">
            <button
                type="button"
                className="sidebar-history-new"
                onClick={onNewTask}
                disabled={disabled}
            >
                <PlusOutlined aria-hidden/>
                <span>创建新任务</span>
            </button>
            <ul className="sidebar-history-list">
                {tasks.length === 0 ? (
                    <li className="sidebar-history-empty">暂无历史任务</li>
                ) : (
                    tasks.map((task) => {
                        const isActive = task.id === activeTaskId;
                        return (
                            <li key={task.id} className="sidebar-history-row">
                                <button
                                    type="button"
                                    className={
                                        isActive
                                            ? 'sidebar-history-item sidebar-history-item--active'
                                            : 'sidebar-history-item'
                                    }
                                    onClick={() => onSelect(task.id)}
                                    title={task.title}
                                >
                                    <span className="sidebar-history-item__text">
                                        {task.title.length > 28
                                            ? `${task.title.slice(0, 28)}…`
                                            : task.title}
                                    </span>
                                    {task.pinned ? (
                                        <PushpinOutlined
                                            className="sidebar-history-item__pin"
                                            aria-label="已置顶"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onTogglePin?.(task.id, false);
                                            }}
                                        />
                                    ) : onTogglePin ? (
                                        <PushpinOutlined
                                            className="sidebar-history-item__pin sidebar-history-item__pin--muted"
                                            aria-label="置顶"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onTogglePin(task.id, true);
                                            }}
                                        />
                                    ) : null}
                                </button>
                                {onDelete ? (
                                    <button
                                        type="button"
                                        className="sidebar-history-item__delete"
                                        aria-label="删除任务"
                                        title="删除任务"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(task.id);
                                        }}
                                    >
                                        <DeleteOutlined aria-hidden/>
                                    </button>
                                ) : null}
                            </li>
                        );
                    })
                )}
            </ul>
        </div>
    );
}