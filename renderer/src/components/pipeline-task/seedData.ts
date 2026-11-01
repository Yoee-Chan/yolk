import type {PipelineDefinition, PipelineStore} from './types';

/**
 * 首次启动（本机还没有 pipelines.json）时写入的种子数据。
 * 之后所有读写都以 `<workspace>/流水线任务/pipelines.json` 为准。
 */
export const HSBC_SUBJECT_KEYWORD = 'HSBC的交易报表';

const HSBC_AGENT_PROMPT = `目标是拉取 HSBC 交易报表邮件里的附件并保存到本机工作区。

执行要求：
1. 邮件主题关键词固定为「${HSBC_SUBJECT_KEYWORD}」，只检索最近 7 天。
2. 必须调用工具 save_outlook_attachment 完成检索与保存，不要用 Python 或浏览器去抓邮件。
3. 保存目录使用工作区里的 merge excel 目录（不传 save_dir 时工具会自动选它）。
4. 保存完成后逐个列出已保存附件的完整路径，并核对文件是否真的存在。
5. 如果最近 7 天没有匹配邮件，如实说明「未找到邮件」，不要编造文件路径。`;

export const SEED_DEFINITIONS: PipelineDefinition[] = [
    {
        id: 'def-hsbc-daily',
        name: 'HSBC 交易报表拉取',
        description:
            '每天检查 Outlook 收件箱，把主题为「HSBC的交易报表」的邮件附件保存到工作区 merge excel 目录。',
        enabled: true,
        schedule: {type: 'daily', time: '08:30'},
        stages: [
            {
                id: 's1',
                name: '打开邮箱',
                description: '连接本机 Outlook 并进入收件箱',
                permissions: ['outlook:read'],
            },
            {
                id: 's2',
                name: '查询目标邮件',
                description: `筛选最近 7 天主题包含「${HSBC_SUBJECT_KEYWORD}」的邮件`,
                permissions: ['outlook:read', 'outlook:search'],
            },
            {
                id: 's3',
                name: '保存到 merge excel',
                description: '把匹配邮件的附件保存到工作区 merge excel 目录',
                permissions: ['file:write'],
            },
        ],
        createdAt: '2026-05-10T09:00:00.000Z',
        agentPrompt: HSBC_AGENT_PROMPT,
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
                description: '按 JQL 取上周完成与进行中的任务',
                permissions: ['network:http', 'agent:auto'],
            },
            {
                id: 'w2',
                name: '生成报告文件',
                description: '输出 Markdown 周报并写入工作区',
                permissions: ['file:write'],
            },
        ],
        createdAt: '2026-05-12T14:20:00.000Z',
        agentPrompt: `汇总上周的 Jira 任务并生成一份 Markdown 周报，写入工作区。`,
    },
];

export function buildSeedStore(): PipelineStore {
    return {
        version: 1,
        updatedAt: new Date().toISOString(),
        definitions: SEED_DEFINITIONS,
        executions: [],
    };
}
