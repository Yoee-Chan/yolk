import type {ExecutionStatus, PipelineSchedule, ScheduleType} from './types';

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function formatScheduleLabel(schedule: PipelineSchedule): string {
    if (schedule.type === 'once') {
        return schedule.datetime
            ? `单次 · ${formatDateTime(schedule.datetime)}`
            : '单次 · 未设置时间';
    }
    if (schedule.type === 'daily') {
        return `每天 · ${schedule.time ?? '未设置'}`;
    }
    const days = (schedule.weekdays ?? [])
        .sort((a, b) => a - b)
        .map((d) => WEEKDAY_LABELS[d])
        .join('、');
    return `每周 · ${days || '未选星期'} · ${schedule.time ?? '未设置'}`;
}

export function formatDateTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('zh-CN', {hour12: false});
}

export function executionStatusLabel(status: ExecutionStatus): string {
    const map: Record<ExecutionStatus, string> = {
        running: '进行中',
        completed: '已完成',
        error: '发生错误',
        abandoned: '已弃用',
    };
    return map[status];
}

export function executionStatusColor(status: ExecutionStatus): string {
    const map: Record<ExecutionStatus, string> = {
        running: 'processing',
        completed: 'success',
        error: 'error',
        abandoned: 'default',
    };
    return map[status];
}

export function scheduleTypeLabel(type: ScheduleType): string {
    const map: Record<ScheduleType, string> = {
        once: '单次执行',
        daily: '每天执行',
        weekly: '每周执行',
    };
    return map[type];
}

export function newId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
