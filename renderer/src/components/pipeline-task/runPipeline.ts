import {desktopApi} from '../../platform/desktopApi';
import {buildPipelineRunPrompt, extractArtifacts} from './agentPrompt';
import type {PipelineDefinition} from './types';

export interface PipelineRunHandlers {
    /** 一行 Agent 输出（已去掉协议包装） */
    onLog: (line: string) => void;
    /** 第 index 个阶段（0 基）已完成 */
    onStageDone: (index: number) => void;
    /** 第 index 个阶段失败，reason 为展示给用户的失败原因 */
    onStageError: (index: number, reason: string) => void;
    /** Agent 报告过的本机文件路径 */
    onArtifacts: (paths: string[]) => void;
    onFinish: (
        status: 'completed' | 'error',
        errorMessage?: string,
        failedStageIndex?: number
    ) => void;
}

interface StreamPayload {
    type?: string;
    id?: string;
    text?: string;
}

const STAGE_DONE_RE = /\[阶段完成\]\s*(.+)/;
const STAGE_FAIL_RE = /\[阶段失败\]\s*(.+)/;
const PIPELINE_DONE_RE = /\[流水线完成\]/;
const PIPELINE_FAIL_RE = /\[流水线失败\]\s*(.*)/;
// 模型不一定老实输出 [阶段失败]，用它兜底记录最后一条看起来像报错的内容。
const FAILURE_HINT_RE = /(失败|错误|未找到|未检测到|无法|failed|error)/i;

/** 计划确认的固定回复值，与 agent-controller 的约定保持一致。 */
const PLAN_CONFIRM_REPLY = '__PLAN_CONFIRM__';
const INPUT_CONFIRM_REPLY = '确认';

let cancelRequested = false;

export function cancelPipelineRun(): void {
    cancelRequested = true;
    desktopApi.cancelAgent();
}

/** 把 `[阶段失败] 阶段名：原因` 拆成阶段名与原因。 */
function splitStageFailure(raw: string): {name: string; reason: string} {
    const text = raw.trim();
    const matched = text.match(/^(.{1,40}?)\s*[：:]\s*([\s\S]+)$/);
    if (matched) {
        return {name: matched[1].trim(), reason: matched[2].trim()};
    }
    return {name: text, reason: ''};
}

/**
 * 把一条流水线交给常驻 Agent 执行。
 * 走 `skipPlan`，因为用户点击「立即执行」本身就是确认动作；
 * 执行过程中不做人工 review，阶段失败即标记失败并给出原因。
 */
export function startPipelineRun(
    definition: PipelineDefinition,
    handlers: PipelineRunHandlers
): void {
    cancelRequested = false;

    const stageCount = definition.stages.length;
    const stageCompleted: boolean[] = new Array(stageCount).fill(false);
    const artifacts = new Set<string>();
    let carry = '';
    let errCarry = '';
    let finished = false;
    let nextStageIndex = 0;
    let lastFailureLine = '';

    const clampStageIndex = (index: number) =>
        Math.max(0, Math.min(index, Math.max(stageCount - 1, 0)));

    /** 先按名称精确匹配，再模糊匹配，最后退回到当前正在执行的阶段。 */
    const findStageIndex = (name: string): number => {
        const text = (name ?? '').trim();
        if (text) {
            const exact = definition.stages.findIndex((s) => s.name.trim() === text);
            if (exact >= 0) return exact;
            const fuzzy = definition.stages.findIndex(
                (s) => text.includes(s.name.trim()) || s.name.trim().includes(text)
            );
            if (fuzzy >= 0) return fuzzy;
        }
        return clampStageIndex(nextStageIndex);
    };

    const firstUnfinishedStage = (): number => {
        const index = stageCompleted.findIndex((done) => !done);
        return index >= 0 ? index : clampStageIndex(stageCount - 1);
    };

    const stageName = (index: number) =>
        definition.stages[index]?.name ?? `第 ${index + 1} 阶段`;

    const finish = (status: 'completed' | 'error', errorMessage?: string, failedStageIndex?: number) => {
        if (finished) return;
        finished = true;
        if (artifacts.size > 0) handlers.onArtifacts([...artifacts]);
        if (cancelRequested) {
            handlers.onFinish('error', '已手动取消执行');
            return;
        }
        handlers.onFinish(status, errorMessage, failedStageIndex);
    };

    const markStageFailed = (index: number, reason: string) => {
        if (finished) return;
        const target = clampStageIndex(index);
        const detail = (reason ?? '').trim() || `${stageName(target)} 执行失败`;
        handlers.onStageError(target, detail);
        finish('error', detail, target);
    };

    /** 收到「流水线完成」或流结束时调用：还有阶段没报告完成，就不能算成功。 */
    const settleCompleted = () => {
        if (finished) return;
        const pending = stageCompleted.findIndex((done) => !done);
        if (pending < 0) {
            finish('completed');
            return;
        }
        const reason =
            lastFailureLine.trim() ||
            `${stageName(pending)} 未返回完成标记，Agent 可能没有执行该阶段`;
        markStageFailed(pending, reason);
    };

    const advanceStage = (line: string) => {
        const matched = line.match(STAGE_DONE_RE);
        if (!matched) return false;
        const index = findStageIndex(matched[1]);
        stageCompleted[index] = true;
        nextStageIndex = Math.min(index + 1, stageCount);
        handlers.onStageDone(index);
        return true;
    };

    const failStage = (line: string): boolean => {
        const matched = line.match(STAGE_FAIL_RE);
        if (!matched) return false;
        const raw = matched[1].trim();
        const parsed = splitStageFailure(raw);
        const index = findStageIndex(parsed.name);
        const declaredName = definition.stages[index]?.name?.trim() ?? '';
        const namedStage =
            !!declaredName &&
            (parsed.name.includes(declaredName) || declaredName.includes(parsed.name));
        let reason = parsed.reason;
        if (!reason) {
            // 兼容「[阶段失败] 阶段名 原因」（没有冒号）与「[阶段失败] 只有原因」两种写法。
            reason = namedStage
                ? parsed.name.replace(declaredName, '').replace(/^[\s:：,，\-—、]+/, '').trim()
                : raw;
        }
        markStageFailed(index, reason);
        return true;
    };

    const failPipeline = (line: string): boolean => {
        const matched = line.match(PIPELINE_FAIL_RE);
        if (!matched) return false;
        const reason = (matched[1] ?? '').trim() || lastFailureLine.trim() || '流水线执行失败';
        markStageFailed(firstUnfinishedStage(), reason);
        return true;
    };

    const handleText = (text: string) => {
        if (!text || finished) return;
        for (const piece of text.split('\n')) {
            const line = piece.trim();
            if (!line) continue;
            handlers.onLog(line);
            for (const path of extractArtifacts(line)) artifacts.add(path);

            if (failStage(line) || failPipeline(line)) return;
            if (advanceStage(line)) continue;
            if (FAILURE_HINT_RE.test(line)) lastFailureLine = line;
            if (PIPELINE_DONE_RE.test(line)) settleCompleted();
            if (finished) return;
        }
    };

    const handlePayload = (payload: StreamPayload) => {
        switch (payload.type) {
            case 'stream':
                handleText(payload.text ?? '');
                break;
            case 'result':
                handleText(payload.text ?? '');
                settleCompleted();
                break;
            case 'done':
                settleCompleted();
                break;
            case 'error': {
                const reason = (payload.text ?? '').trim() || 'Agent 执行失败';
                handleText(reason);
                markStageFailed(firstUnfinishedStage(), reason);
                break;
            }
            case 'need_input':
            case 'need_plan_confirm': {
                // 流水线不做人工 review：自动回一条确认，避免 Agent 一直等待导致任务卡死。
                handleText('[系统] 流水线模式自动跳过人工确认，继续执行。');
                if (payload.id) {
                    desktopApi.sendAgentInput({
                        id: payload.id,
                        data:
                            payload.type === 'need_plan_confirm'
                                ? PLAN_CONFIRM_REPLY
                                : INPUT_CONFIRM_REPLY,
                    });
                }
                break;
            }
            default:
                break;
        }
    };

    const handleLine = (rawLine: string) => {
        const line = rawLine.trim();
        if (!line) return;

        if (line.startsWith('{')) {
            try {
                const payload = JSON.parse(line) as StreamPayload;
                if (payload && typeof payload.type === 'string') {
                    handlePayload(payload);
                    return;
                }
            } catch {
                /* 不是协议行，按普通日志处理 */
            }
        }
        handleText(line);
    };

    desktopApi.runAgent(
        {
            msg: buildPipelineRunPrompt(definition),
            history: [],
            skipPlan: true,
            pipelineId: definition.id,
            isFirstMessage: false,
        },
        (chunk) => {
            const merged = carry + chunk;
            const parts = merged.split('\n');
            carry = parts.pop() ?? '';
            for (const part of parts) handleLine(part);
        },
        (errChunk) => {
            // stderr 是 Python 侧日志，只作为调试信息展示，不参与阶段/产物解析。
            const merged = errCarry + errChunk;
            const parts = merged.split('\n');
            errCarry = parts.pop() ?? '';
            for (const part of parts) {
                const line = part.trim();
                if (line) handlers.onLog(line);
            }
        },
        () => {
            settleCompleted();
        }
    );
}
