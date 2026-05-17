import type {PipelineDefinition, PipelineExecution} from './types';

export const INITIAL_DEFINITIONS: PipelineDefinition[] = [
    {
        id: 'def-hsbc-daily',
        name: 'HSBC 交易报表拉取',
        description: '每天检查邮箱，下载 subject 为「HSBC的交易报表」的附件并写入 merge excel。',
        enabled: true,
        schedule: {type: 'daily', time: '08:30'},
        stages: [
            {
                id: 's1',
                name: '打开邮箱',
                description: '连接 Outlook 并进入收件箱',
                permissions: ['outlook:read'],
            },
            {
                id: 's2',
                name: '查询目标邮件',
                description: '筛选 subject 为「HSBC的交易报表」',
                permissions: ['outlook:read', 'outlook:search'],
            },
            {
                id: 's3',
                name: '保存到 merge excel',
                description: '将附件合并写入指定 Excel 文件',
                permissions: ['file:write', 'excel:merge'],
            },
        ],
        createdAt: '2026-05-10T09:00:00.000Z',
    },
    {
        id: 'def-weekly-report',
        name: '周报汇总',
        description: '每周一汇总上周 Jira 任务并生成 Markdown 报告。',
        enabled: false,
        schedule: {type: 'weekly', time: '09:00', weekdays: [1]},
        stages: [
            {
                id: 'w1',
                name: '拉取 Jira 任务',
                permissions: ['network:http', 'agent:auto'],
            },
            {
                id: 'w2',
                name: '生成报告文件',
                permissions: ['file:write'],
            },
        ],
        createdAt: '2026-05-12T14:20:00.000Z',
    },
];

export const INITIAL_EXECUTIONS: PipelineExecution[] = [
    {
        id: 'exec-001',
        pipelineId: 'def-hsbc-daily',
        pipelineName: 'HSBC 交易报表拉取',
        status: 'running',
        currentStageIndex: 1,
        startedAt: '2026-05-17T08:30:12.000Z',
        stageResults: [
            {stageId: 's1', status: 'done'},
            {stageId: 's2', status: 'running'},
            {stageId: 's3', status: 'pending'},
        ],
    },
    {
        id: 'exec-002',
        pipelineId: 'def-hsbc-daily',
        pipelineName: 'HSBC 交易报表拉取',
        status: 'completed',
        currentStageIndex: 2,
        startedAt: '2026-05-16T08:30:05.000Z',
        finishedAt: '2026-05-16T08:31:42.000Z',
        stageResults: [
            {stageId: 's1', status: 'done'},
            {stageId: 's2', status: 'done'},
            {stageId: 's3', status: 'done'},
        ],
    },
    {
        id: 'exec-003',
        pipelineId: 'def-hsbc-daily',
        pipelineName: 'HSBC 交易报表拉取',
        status: 'error',
        currentStageIndex: 2,
        startedAt: '2026-05-15T08:30:01.000Z',
        finishedAt: '2026-05-15T08:30:48.000Z',
        errorMessage: '未找到 subject 为「HSBC的交易报表」的邮件',
        stageResults: [
            {stageId: 's1', status: 'done'},
            {stageId: 's2', status: 'error'},
            {stageId: 's3', status: 'skipped'},
        ],
    },
    {
        id: 'exec-004',
        pipelineId: 'def-weekly-report',
        pipelineName: '周报汇总',
        status: 'abandoned',
        currentStageIndex: 0,
        startedAt: '2026-05-13T09:00:00.000Z',
        finishedAt: '2026-05-13T09:00:22.000Z',
        stageResults: [
            {stageId: 'w1', status: 'skipped'},
            {stageId: 'w2', status: 'skipped'},
        ],
    },
];
