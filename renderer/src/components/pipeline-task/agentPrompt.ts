import type {PipelineDefinition} from './types';

const PERMISSION_LABELS: Record<string, string> = {
    'outlook:read': '读取 Outlook 邮箱',
    'outlook:search': '检索 Outlook 邮件',
    'file:read': '读取工作区文件',
    'file:write': '写入工作区文件',
    'excel:merge': '写入 Excel',
    'network:http': '发起 HTTP 请求',
    'agent:auto': '由 Agent 自行决定步骤',
};

function permissionText(codes: string[]): string {
    if (!codes || codes.length === 0) return '无额外权限';
    return codes.map((c) => PERMISSION_LABELS[c] ?? c).join('、');
}

/**
 * 把一条流水线定义翻译成 Agent 可以直接执行的指令。
 * 阶段名称会以 `[阶段完成] xxx` 的形式回传，前端据此推进阶段进度。
 */
export function buildPipelineRunPrompt(def: PipelineDefinition): string {
    const stageLines = def.stages
        .map(
            (stage, index) =>
                `${index + 1}. ${stage.name}` +
                (stage.description ? `：${stage.description}` : '') +
                `（${permissionText(stage.permissions)}）`
        )
        .join('\n');

    const instruction = (def.agentPrompt || '').trim();

    return [
        `【流水线任务执行】${def.name}`,
        def.description ? `流水线说明：${def.description}` : '',
        '',
        '请严格按照下面列出的阶段顺序执行，不要跳阶段、不要自行增减阶段：',
        stageLines,
        '',
        instruction ? `执行要求：\n${instruction}` : '',
        '',
        '输出约定（必须遵守，前端据此推进进度）：',
        '- 每完成一个阶段，单独输出一行：`[阶段完成] <阶段名>`',
        '- 某个阶段失败（工具报错、数据缺失、无法继续等），单独输出一行：`[阶段失败] <阶段名>：<失败原因>`，然后立刻停止，不要继续执行后面的阶段',
        '- 所有阶段都完成后，最后单独输出一行：`[流水线完成]`',
        '- 保存文件的完整路径必须原样写出，不要省略盘符或目录。',
        '',
        '执行说明：',
        '- 用户已点击「立即执行」，视为全部阶段都已授权：不要调用 ask_human，不要等待任何人工确认，直接执行。',
        '- 工具调用报错时不要反复向用户提问：先输出 `[阶段失败] <阶段名>：<失败原因>`，再结束本次执行，让前端把该阶段标记为失败。',
    ]
        .filter((line) => line !== '')
        .join('\n');
}

/** 从 Agent 输出里提取本机绝对路径，作为「产物」展示。 */
export function extractArtifacts(text: string): string[] {
    const found = new Set<string>();
    const re = /[A-Za-z]:\\[^\s"',;|]*?\.[A-Za-z0-9]{1,6}/g;
    const matches = text.match(re) ?? [];
    for (const raw of matches) {
        found.add(raw.replace(/[)\]}]+$/, ''));
    }
    return [...found];
}
