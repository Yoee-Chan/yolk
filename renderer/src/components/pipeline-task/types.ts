export type ExecutionStatus = 'running' | 'completed' | 'error' | 'abandoned';

export type ScheduleType = 'once' | 'daily' | 'weekly';

export interface ProcessStage {
    id: string;
    name: string;
    description?: string;
    permissions: string[];
}

export interface PipelineSchedule {
    type: ScheduleType;
    /** HH:mm，用于 daily / weekly */
    time?: string;
    /** ISO 字符串，用于 once */
    datetime?: string;
    /** 0=周日 … 6=周六 */
    weekdays?: number[];
}

export interface PipelineDefinition {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    schedule: PipelineSchedule;
    stages: ProcessStage[];
    createdAt: string;
}

export type StageRunStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped';

export interface StageRunResult {
    stageId: string;
    status: StageRunStatus;
}

export interface PipelineExecution {
    id: string;
    pipelineId: string;
    pipelineName: string;
    status: ExecutionStatus;
    currentStageIndex: number;
    startedAt: string;
    finishedAt?: string;
    errorMessage?: string;
    stageResults: StageRunResult[];
}

export const PERMISSION_OPTIONS = [
    {value: 'outlook:read', label: 'Outlook · 读取邮箱'},
    {value: 'outlook:search', label: 'Outlook · 搜索邮件'},
    {value: 'file:read', label: '文件 · 读取'},
    {value: 'file:write', label: '文件 · 写入'},
    {value: 'excel:merge', label: 'Excel · 合并写入'},
    {value: 'network:http', label: '网络 · HTTP 请求'},
    {value: 'agent:auto', label: 'Agent · 自动执行'},
] as const;
