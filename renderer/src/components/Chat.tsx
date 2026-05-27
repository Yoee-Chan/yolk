import React, {useCallback, useEffect, useRef, useState} from 'react';
import {cloudApi, getStoredToken} from '../api/cloudApi';
import {useAuth} from '../context/AuthContext';
import AuthModal from './auth/AuthModal';
import '../css/Chat.css';

type PendingHumanInput = {
    id: string;
    promptText: string;
};

type PendingPlanConfirm = {
    id: string;
    planText: string;
};

type TextMessage = {
    kind: 'text';
    role: 'user' | 'assistant';
    content: string;
};

type DiagMessage = {
    kind: 'diag';
    runId: number;
    plan: string;
    infoLines: string[];
};

type ChatMessage = TextMessage | DiagMessage;

type StreamPayload = {
    type?: string;
    text?: string;
    id?: string;
    taskId?: string;
};

export interface ChatProps {
    taskId: string | null;
    sessionId: string | null;
    initialMessages: Array<{role: 'user' | 'assistant'; content: string}> | null;
    showWelcome: boolean;
    onTaskTitleUpdated?: (taskId: string, title: string) => void;
    onTasksChanged?: () => void;
    /** 已登录且尚未选中任务时，发送前自动创建任务 */
    onEnsureTask?: () => Promise<{taskId: string; sessionId: string}>;
}

const WELCOME_TEXT =
    '在下方输入问题后，系统会先请模型整理「执行计划、所需权限、将使用的程序」并请你确认；确认后才会启动 Agent 与工具。取消则不会执行任何操作。首次发送消息将自动在左侧创建任务记录。';

const LOCAL_WELCOME_TEXT =
    '在下方输入问题后点击发送，请先登录或注册。登录后系统会先请模型整理「执行计划、所需权限、将使用的程序」并请你确认；确认后才会启动 Agent 与工具，并可保存任务历史。';

const PROTOCOL_TYPES = new Set([
    'result',
    'error',
    'stream',
    'need_input',
    'need_plan_confirm',
    'done',
    'task_title',
]);

const PLAN_DECISION_CONFIRM = '__PLAN_CONFIRM__';
const PLAN_DECISION_CANCEL = '__PLAN_CANCEL__';

function buildInitialMessages(
    initialMessages: ChatProps['initialMessages'],
    showWelcome: boolean
): ChatMessage[] {
    if (initialMessages && initialMessages.length > 0) {
        return initialMessages.map((m) => ({
            kind: 'text' as const,
            role: m.role,
            content: m.content,
        }));
    }
    if (showWelcome) {
        return [{kind: 'text', role: 'assistant', content: WELCOME_TEXT}];
    }
    return [];
}

function parseProtocolLine(trimmed: string): StreamPayload | null {
    if (!trimmed.startsWith('{')) {
        return null;
    }
    try {
        const obj = JSON.parse(trimmed) as StreamPayload;
        if (
            obj &&
            typeof obj === 'object' &&
            typeof obj.type === 'string' &&
            PROTOCOL_TYPES.has(obj.type)
        ) {
            return obj;
        }
    } catch {
        return null;
    }
    return null;
}

function parseLineBuffer(
    carry: string,
    chunk: string
): {lines: string[]; carry: string} {
    const merged = carry + chunk;
    const parts = merged.split('\n');
    const nextCarry = parts.pop() ?? '';
    return {lines: parts, carry: nextCarry};
}

/** ? local-llm-engine `toolcall.think` ? thoughts ???? */
function parseThoughtsFromLogLine(line: string): string | null {
    const lower = line.toLowerCase();
    const key = 'thoughts:';
    const idx = lower.indexOf(key);
    if (idx === -1) {
        return null;
    }
    const text = line.slice(idx + key.length).trim();
    return text.length > 0 ? text : null;
}

function DiagPanel({plan, infoLines}: {plan: string; infoLines: string[]}) {
    const hasPlan = plan.trim().length > 0;
    const hasInfo = infoLines.length > 0;
    if (!hasPlan && !hasInfo) {
        return null;
    }
    return (
        <div className="chat-diag">
            {hasPlan ? (
                <details className="chat-diag-plan">
                    <summary>{'模型计划'}</summary>
                    <pre className="chat-diag-pre">{plan}</pre>
                </details>
            ) : null}
            {hasInfo ? (
                <div className="chat-diag-conn">
                    <div className="chat-diag-conn-title">{'连接信息'}</div>
                    <pre className="chat-diag-pre chat-diag-conn-pre">
                        {infoLines.join('\n')}
                    </pre>
                </div>
            ) : null}
        </div>
    );
}

export default function Chat({
    taskId,
    sessionId,
    initialMessages,
    showWelcome,
    onTaskTitleUpdated,
    onTasksChanged,
    onEnsureTask,
}: ChatProps) {
    const {user, loading: authLoading} = useAuth();
    const isLocalOnly = initialMessages === null;
    const [authModalOpen, setAuthModalOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>(() =>
        isLocalOnly
            ? [{kind: 'text', role: 'assistant', content: LOCAL_WELCOME_TEXT}]
            : buildInitialMessages(initialMessages, showWelcome)
    );

    const [busy, setBusy] = useState(false);
    const [pendingHumanInput, setPendingHumanInput] =
        useState<PendingHumanInput | null>(null);
    const [pendingPlanConfirm, setPendingPlanConfirm] =
        useState<PendingPlanConfirm | null>(null);
    const [humanDraft, setHumanDraft] = useState('');
    const humanInputRef = useRef<HTMLTextAreaElement | null>(null);
    const stdoutCarry = useRef('');
    const stderrCarry = useRef('');
    const sawProtocolPayload = useRef(false);
    const runIdRef = useRef(0);
    const streamingAssistantRef = useRef('');
    /** 当前轮次使用的任务 ID */
    const runTaskIdRef = useRef<string | null>(taskId);

    useEffect(() => {
        runTaskIdRef.current = taskId;
    }, [taskId]);

    const persistMessage = useCallback(
        async (role: 'user' | 'assistant', content: string) => {
            const id = runTaskIdRef.current;
            if (!id || !content.trim()) {
                return;
            }
            try {
                await cloudApi.appendChatMessage(id, role, content);
                onTasksChanged?.();
            } catch {
                /* ignore */
            }
        },
        [onTasksChanged]
    );

    const flushStreamingAssistant = useCallback(async () => {
        const content = streamingAssistantRef.current.trim();
        streamingAssistantRef.current = '';
        if (content) {
            await persistMessage('assistant', content);
        }
    }, [persistMessage]);

    const appendAssistant = useCallback((content: string) => {
        setMessages((prev) => [
            ...prev,
            {kind: 'text', role: 'assistant', content},
        ]);
    }, []);

    const handlePayload = useCallback(
        (msg: StreamPayload) => {
            sawProtocolPayload.current = true;
            const t = msg.type;

            if (t === 'task_title' && msg.taskId && msg.text) {
                onTaskTitleUpdated?.(msg.taskId, msg.text);
                onTasksChanged?.();
                return;
            }

            if (t === 'stream' && typeof msg.text === 'string') {
                streamingAssistantRef.current += msg.text;
                setMessages((prev) => {
                    const last = prev[prev.length - 1];
                    if (last?.kind === 'text' && last.role === 'assistant') {
                        const copy = prev.slice(0, -1);
                        return [
                            ...copy,
                            {
                                kind: 'text',
                                role: 'assistant',
                                content: last.content + msg.text,
                            },
                        ];
                    }
                    return [
                        ...prev,
                        {kind: 'text', role: 'assistant', content: msg.text!},
                    ];
                });
                return;
            }
            if (t === 'done') {
                void flushStreamingAssistant();
                setBusy(false);
                return;
            }
            if (t === 'result' && typeof msg.text === 'string') {
                streamingAssistantRef.current = msg.text;
                appendAssistant(msg.text);
                void flushStreamingAssistant();
                setBusy(false);
                return;
            }
            if (t === 'error' && typeof msg.text === 'string') {
                const errText = `[错误] ${msg.text}`;
                streamingAssistantRef.current = errText;
                appendAssistant(errText);
                void flushStreamingAssistant();
                setBusy(false);
                return;
            }
            if (t === 'need_input' && msg.id != null) {
                const prompt =
                    typeof msg.text === 'string' ? msg.text : '请输入内容';
                setHumanDraft('');
                setPendingHumanInput({id: String(msg.id), promptText: prompt});
                return;
            }
            if (t === 'need_plan_confirm' && msg.id != null) {
                const planText =
                    typeof msg.text === 'string' ? msg.text : '';
                setPendingPlanConfirm({
                    id: String(msg.id),
                    planText,
                });
            }
        },
        [appendAssistant, flushStreamingAssistant, onTaskTitleUpdated, onTasksChanged]
    );

    useEffect(() => {
        if (!pendingHumanInput) {
            return;
        }
        const t = window.setTimeout(() => humanInputRef.current?.focus(), 50);
        return () => window.clearTimeout(t);
    }, [pendingHumanInput]);

    const submitHumanInput = () => {
        if (!pendingHumanInput) {
            return;
        }
        window.api.sendPythonInput({
            id: pendingHumanInput.id,
            data: humanDraft,
        });
        setPendingHumanInput(null);
        setHumanDraft('');
    };

    const cancelHumanInput = () => {
        if (!pendingHumanInput) {
            return;
        }
        window.api.sendPythonInput({
            id: pendingHumanInput.id,
            data: '',
        });
        setPendingHumanInput(null);
        setHumanDraft('');
    };

    const isToolActionConfirm =
        pendingHumanInput?.promptText.includes('【操作确认】') ?? false;

    const submitToolActionConfirm = () => {
        if (!pendingHumanInput) {
            return;
        }
        window.api.sendPythonInput({
            id: pendingHumanInput.id,
            data: '确认',
        });
        setPendingHumanInput(null);
        setHumanDraft('');
    };

    const cancelToolActionConfirm = () => {
        if (!pendingHumanInput) {
            return;
        }
        window.api.sendPythonInput({
            id: pendingHumanInput.id,
            data: '',
        });
        setPendingHumanInput(null);
        setHumanDraft('');
    };

    const submitPlanConfirm = useCallback(() => {
        if (!pendingPlanConfirm) {
            return;
        }
        window.api.sendPythonInput({
            id: pendingPlanConfirm.id,
            data: PLAN_DECISION_CONFIRM,
        });
        setPendingPlanConfirm(null);
    }, [pendingPlanConfirm]);

    const cancelPlanConfirm = useCallback(() => {
        if (!pendingPlanConfirm) {
            return;
        }
        window.api.sendPythonInput({
            id: pendingPlanConfirm.id,
            data: PLAN_DECISION_CANCEL,
        });
        setPendingPlanConfirm(null);
    }, [pendingPlanConfirm]);

    useEffect(() => {
        if (!pendingPlanConfirm) {
            return;
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                window.api.sendPythonInput({
                    id: pendingPlanConfirm.id,
                    data: PLAN_DECISION_CANCEL,
                });
                setPendingPlanConfirm(null);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [pendingPlanConfirm]);

    const appendStderrLines = useCallback((lines: string[]) => {
        const runId = runIdRef.current;
        if (runId === 0) {
            return;
        }
        setMessages((prev) => {
            const idx = prev.findIndex(
                (m) => m.kind === 'diag' && m.runId === runId
            );
            if (idx === -1) {
                return prev;
            }
            const diag = prev[idx] as DiagMessage;
            let nextPlan = diag.plan;
            const nextInfo = [...diag.infoLines];
            for (const raw of lines) {
                const trimmed = raw.trim();
                if (!trimmed) {
                    continue;
                }
                const thought = parseThoughtsFromLogLine(trimmed);
                if (thought != null) {
                    nextPlan = nextPlan ? `${nextPlan}\n\n${thought}` : thought;
                } else {
                    nextInfo.push(trimmed);
                }
            }
            if (nextPlan === diag.plan && nextInfo.length === diag.infoLines.length) {
                return prev;
            }
            const next = [...prev];
            next[idx] = {
                ...diag,
                plan: nextPlan,
                infoLines: nextInfo,
            };
            return next;
        });
    }, []);

    const cancelRun = () => {
        if (!busy) {
            return;
        }
        window.api.cancelPython();
    };

    const needsTaskSelection = !isLocalOnly && !taskId && !onEnsureTask;

    const sendMessage = async () => {
        const text = input.trim();
        if (!text || needsTaskSelection) {
            return;
        }

        if (!user) {
            setAuthModalOpen(true);
            return;
        }

        let effectiveTaskId = taskId;
        let effectiveSessionId = sessionId;
        if (!isLocalOnly && !effectiveTaskId && onEnsureTask) {
            try {
                const ensured = await onEnsureTask();
                effectiveTaskId = ensured.taskId;
                effectiveSessionId = ensured.sessionId;
                runTaskIdRef.current = ensured.taskId;
            } catch (err) {
                const detail =
                    err instanceof Error ? err.message : '????';
                appendAssistant(
                    `[??] ???????${detail}?????????????? yolk-cloud ???? sql/patch_chat_tasks.sql ??????`
                );
                return;
            }
        } else {
            runTaskIdRef.current = effectiveTaskId;
        }

        if (busy) {
            setPendingHumanInput(null);
            setPendingPlanConfirm(null);
            setHumanDraft('');
        }

        runIdRef.current += 1;
        const runId = runIdRef.current;
        streamingAssistantRef.current = '';

        const historyForApi = messages
            .filter(
                (m): m is TextMessage =>
                    m.kind === 'text' &&
                    (m.role === 'user' || m.role === 'assistant')
            )
            .map((m) => ({role: m.role, content: m.content}))
            .slice(-40);

        const userMsgCount = historyForApi.filter((m) => m.role === 'user').length;
        const isFirstMessage = userMsgCount === 0;

        if (effectiveTaskId) {
            try {
                await cloudApi.appendChatMessage(effectiveTaskId, 'user', text);
                onTasksChanged?.();
            } catch {
                /* ignore */
            }
        }

        setMessages((prev) => [
            ...prev,
            {kind: 'text', role: 'user', content: text},
            {kind: 'diag', runId, plan: '', infoLines: []},
        ]);
        setInput('');
        setBusy(true);
        stdoutCarry.current = '';
        stderrCarry.current = '';
        sawProtocolPayload.current = false;

        const authToken = getStoredToken();
        window.api.runPython(
            {
                msg: text,
                history: historyForApi,
                interruptPrevious: busy,
                authToken: authToken ?? undefined,
                apiUrl: import.meta.env.VITE_YOLK_API_URL ?? 'http://localhost:8080',
                logSessionId: effectiveSessionId ?? String(runId),
                taskId: effectiveTaskId ?? undefined,
                isFirstMessage,
            },

            (data) => {
                const {lines, carry} = parseLineBuffer(stdoutCarry.current, data);
                stdoutCarry.current = carry;
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) {
                        continue;
                    }
                    const payload = parseProtocolLine(trimmed);
                    if (payload) {
                        handlePayload(payload);
                    }
                }
            },

            (err) => {
                const {lines, carry} = parseLineBuffer(stderrCarry.current, err);
                stderrCarry.current = carry;
                appendStderrLines(lines);
            },

            (code) => {
                setBusy(false);
                setPendingHumanInput(null);
                setPendingPlanConfirm(null);
                setHumanDraft('');
                const tailOut = stdoutCarry.current.trim();
                if (tailOut) {
                    const payload = parseProtocolLine(tailOut);
                    if (payload) {
                        handlePayload(payload);
                    }
                    stdoutCarry.current = '';
                }
                const tailErr = stderrCarry.current.trim();
                if (tailErr) {
                    appendStderrLines([tailErr]);
                }
                stderrCarry.current = '';

                setMessages((prev) =>
                    prev.filter(
                        (m) =>
                            !(
                                m.kind === 'diag' &&
                                !m.plan &&
                                m.infoLines.length === 0
                            )
                    )
                );

                if (!sawProtocolPayload.current) {
                    appendAssistant(
                        '本次运行没有在输出里收到模型结果（只有日志时会被忽略）。请确认 LLM 配置与网络，或查看开发者工具里主进程的 stderr。'
                    );
                }
                if (code !== 0 && code !== null) {
                    appendAssistant(`[进程退出码 ${code}]`);
                }
            }
        );
    };

    return (
        <div className="chat-page">
            <AuthModal
                open={authModalOpen}
                onClose={() => setAuthModalOpen(false)}
            />
            {pendingPlanConfirm ? (
                <div
                    className="chat-human-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="chat-plan-title"
                >
                    <div className="chat-human-modal">
                        <div id="chat-plan-title" className="chat-human-title">
                            {'请确认权限与执行内容'}
                        </div>
                        <p className="chat-plan-hint">
                            {
                                '以下涉及访问权限或即将执行的操作。确认后将启动智能体；取消则不会执行任何操作。'
                            }
                        </p>
                        <pre className="chat-human-prompt chat-plan-body">
                            {pendingPlanConfirm.planText}
                        </pre>
                        <div className="chat-human-actions">
                            <button
                                type="button"
                                className="chat-human-cancel"
                                onClick={cancelPlanConfirm}
                            >
                                {'取消'}
                            </button>
                            <button
                                type="button"
                                className="chat-human-ok"
                                onClick={submitPlanConfirm}
                            >
                                {'确认并执行'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : pendingHumanInput ? (
                <div
                    className="chat-human-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="chat-human-title"
                >
                    <div className="chat-human-modal">
                        <div id="chat-human-title" className="chat-human-title">
                            {isToolActionConfirm
                                ? '请确认操作'
                                : '智能体请求输入'}
                        </div>
                        {isToolActionConfirm ? (
                            <p className="chat-plan-hint">
                                {
                                    '确认后将执行上述工具调用；取消则不会执行。'
                                }
                            </p>
                        ) : null}
                        <pre
                            className={
                                isToolActionConfirm
                                    ? 'chat-human-prompt chat-plan-body'
                                    : 'chat-human-prompt'
                            }
                        >
                            {pendingHumanInput.promptText}
                        </pre>
                        {!isToolActionConfirm ? (
                            <textarea
                                ref={humanInputRef}
                                className="chat-human-textarea"
                                rows={4}
                                value={humanDraft}
                                onChange={(e) => setHumanDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        submitHumanInput();
                                    }
                                    if (e.key === 'Escape') {
                                        e.preventDefault();
                                        cancelHumanInput();
                                    }
                                }}
                                placeholder={
                                    '在此输入回复…（Enter 提交，Shift+Enter 换行，Esc 取消）'
                                }
                            />
                        ) : null}
                        <div className="chat-human-actions">
                            <button
                                type="button"
                                className="chat-human-cancel"
                                onClick={
                                    isToolActionConfirm
                                        ? cancelToolActionConfirm
                                        : cancelHumanInput
                                }
                            >
                                {'取消'}
                            </button>
                            <button
                                type="button"
                                className="chat-human-ok"
                                onClick={
                                    isToolActionConfirm
                                        ? submitToolActionConfirm
                                        : submitHumanInput
                                }
                            >
                                {isToolActionConfirm
                                    ? '确认执行'
                                    : '提交'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
            <div className="chat-body">
                {needsTaskSelection ? (
                    <div className="chat-empty-hint">
                        {
                            '请先登录，或在左侧点击「创建新任务」、选择一条历史任务后再开始对话。'
                        }
                    </div>
                ) : null}
                {messages.map((m, i) => {
                    if (m.kind === 'diag') {
                        return <DiagPanel key={i} plan={m.plan} infoLines={m.infoLines} />;
                    }
                    return (
                        <div
                            key={i}
                            className={`msg ${
                                m.role === 'user' ? 'msg-user' : 'msg-ai'
                            }`}
                        >
                            <div className="msg-role">
                                {m.role === 'user' ? '你' : 'AI'}
                            </div>
                            <div>{m.content}</div>
                        </div>
                    );
                })}
            </div>
            <div className="chat-input">
                <div className="chat-input-inner">
                    <input
                        placeholder={
                            needsTaskSelection
                                ? '请先创建或选择任务…'
                                : !user
                                  ? '输入问题后发送（需先登录）…'
                                  : '输入你的问题...'
                        }
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) =>
                            e.key === 'Enter' &&
                            !e.shiftKey &&
                            !authLoading &&
                            sendMessage()
                        }
                        disabled={needsTaskSelection || authLoading}
                    />
                    <div className="chat-input-actions">
                        {busy && !input.trim() ? (
                            <button
                                type="button"
                                className="chat-cancel"
                                onClick={cancelRun}
                            >
                                {'取消'}
                            </button>
                        ) : null}
                        <button
                            type="button"
                            className="chat-send"
                            onClick={sendMessage}
                            disabled={
                                !input.trim() ||
                                needsTaskSelection ||
                                authLoading
                            }
                        >
                            {busy
                                ? '发送（将中断当前任务）'
                                : '发送'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
