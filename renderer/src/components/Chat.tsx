import React, {useCallback, useEffect, useRef, useState} from 'react';
import {cloudApi, getStoredToken} from '../api/cloudApi';
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
    /** \u5df2\u767b\u5f55\u4e14\u5c1a\u672a\u9009\u4e2d\u4efb\u52a1\u65f6\uff0c\u53d1\u9001\u524d\u81ea\u52a8\u521b\u5efa\u4efb\u52a1 */
    onEnsureTask?: () => Promise<{taskId: string; sessionId: string}>;
}

const WELCOME_TEXT =
    '\u5728\u4e0b\u65b9\u8f93\u5165\u95ee\u9898\u540e\uff0c\u7cfb\u7edf\u4f1a\u5148\u8bf7\u6a21\u578b\u6574\u7406\u300c\u6267\u884c\u8ba1\u5212\u3001\u6240\u9700\u6743\u9650\u3001\u5c06\u4f7f\u7528\u7684\u7a0b\u5e8f\u300d\u5e76\u8bf7\u4f60\u786e\u8ba4\uff1b\u786e\u8ba4\u540e\u624d\u4f1a\u542f\u52a8 Agent \u4e0e\u5de5\u5177\u3002\u53d6\u6d88\u5219\u4e0d\u4f1a\u6267\u884c\u4efb\u4f55\u64cd\u4f5c\u3002\u9996\u6b21\u53d1\u9001\u6d88\u606f\u5c06\u81ea\u52a8\u5728\u5de6\u4fa7\u521b\u5efa\u4efb\u52a1\u8bb0\u5f55\u3002';

const LOCAL_WELCOME_TEXT =
    '\u5728\u4e0b\u65b9\u8f93\u5165\u95ee\u9898\u540e\uff0c\u7cfb\u7edf\u4f1a\u5148\u8bf7\u6a21\u578b\u6574\u7406\u300c\u6267\u884c\u8ba1\u5212\u3001\u6240\u9700\u6743\u9650\u3001\u5c06\u4f7f\u7528\u7684\u7a0b\u5e8f\u300d\u5e76\u8bf7\u4f60\u786e\u8ba4\uff1b\u786e\u8ba4\u540e\u624d\u4f1a\u542f\u52a8 Agent \u4e0e\u5de5\u5177\u3002\u53d6\u6d88\u5219\u4e0d\u4f1a\u6267\u884c\u4efb\u4f55\u64cd\u4f5c\u3002\u767b\u5f55\u540e\u53ef\u4fdd\u5b58\u4efb\u52a1\u5386\u53f2\u3002';

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
                    <summary>{'\u6a21\u578b\u8ba1\u5212'}</summary>
                    <pre className="chat-diag-pre">{plan}</pre>
                </details>
            ) : null}
            {hasInfo ? (
                <div className="chat-diag-conn">
                    <div className="chat-diag-conn-title">{'\u8fde\u63a5\u4fe1\u606f'}</div>
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
    const isLocalOnly = initialMessages === null;
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
    /** \u5f53\u524d\u8f6e\u6b21\u4f7f\u7528\u7684\u4efb\u52a1 ID */
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
                const errText = `[\u9519\u8bef] ${msg.text}`;
                streamingAssistantRef.current = errText;
                appendAssistant(errText);
                void flushStreamingAssistant();
                setBusy(false);
                return;
            }
            if (t === 'need_input' && msg.id != null) {
                const prompt =
                    typeof msg.text === 'string' ? msg.text : '\u8bf7\u8f93\u5165\u5185\u5bb9';
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
                        '\u672c\u6b21\u8fd0\u884c\u6ca1\u6709\u5728\u8f93\u51fa\u91cc\u6536\u5230\u6a21\u578b\u7ed3\u679c\uff08\u53ea\u6709\u65e5\u5fd7\u65f6\u4f1a\u88ab\u5ffd\u7565\uff09\u3002\u8bf7\u786e\u8ba4 LLM \u914d\u7f6e\u4e0e\u7f51\u7edc\uff0c\u6216\u67e5\u770b\u5f00\u53d1\u8005\u5de5\u5177\u91cc\u4e3b\u8fdb\u7a0b\u7684 stderr\u3002'
                    );
                }
                if (code !== 0 && code !== null) {
                    appendAssistant(`[\u8fdb\u7a0b\u9000\u51fa\u7801 ${code}]`);
                }
            }
        );
    };

    return (
        <div className="chat-page">
            {pendingPlanConfirm ? (
                <div
                    className="chat-human-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="chat-plan-title"
                >
                    <div className="chat-human-modal">
                        <div id="chat-plan-title" className="chat-human-title">
                            {'\u8bf7\u786e\u8ba4\u6267\u884c\u8ba1\u5212'}
                        </div>
                        <p className="chat-plan-hint">
                            {
                                '\u786e\u8ba4\u540e\u5c06\u542f\u52a8\u667a\u80fd\u4f53\u5e76\u6309\u8ba1\u5212\u8c03\u7528\u5de5\u5177\uff1b\u53d6\u6d88\u5219\u4e0d\u4f1a\u6267\u884c\u4efb\u4f55\u64cd\u4f5c\u3002'
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
                                {'\u53d6\u6d88'}
                            </button>
                            <button
                                type="button"
                                className="chat-human-ok"
                                onClick={submitPlanConfirm}
                            >
                                {'\u786e\u8ba4\u6267\u884c'}
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
                            {'\u667a\u80fd\u4f53\u8bf7\u6c42\u8f93\u5165'}
                        </div>
                        <pre className="chat-human-prompt">
                            {pendingHumanInput.promptText}
                        </pre>
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
                            placeholder={'\u5728\u6b64\u8f93\u5165\u56de\u590d\u2026\uff08Enter \u63d0\u4ea4\uff0cShift+Enter \u6362\u884c\uff0cEsc \u53d6\u6d88\uff09'}
                        />
                        <div className="chat-human-actions">
                            <button
                                type="button"
                                className="chat-human-cancel"
                                onClick={cancelHumanInput}
                            >
                                {'\u8df3\u8fc7\uff08\u53d1\u9001\u7a7a\u5185\u5bb9\uff09'}
                            </button>
                            <button
                                type="button"
                                className="chat-human-ok"
                                onClick={submitHumanInput}
                            >
                                {'\u63d0\u4ea4'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
            <div className="chat-body">
                {needsTaskSelection ? (
                    <div className="chat-empty-hint">
                        {
                            '\u8bf7\u5148\u767b\u5f55\uff0c\u6216\u5728\u5de6\u4fa7\u70b9\u51fb\u300c\u521b\u5efa\u65b0\u4efb\u52a1\u300d\u3001\u9009\u62e9\u4e00\u6761\u5386\u53f2\u4efb\u52a1\u540e\u518d\u5f00\u59cb\u5bf9\u8bdd\u3002'
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
                                {m.role === 'user' ? '\u4f60' : 'AI'}
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
                                ? '\u8bf7\u5148\u521b\u5efa\u6216\u9009\u62e9\u4efb\u52a1\u2026'
                                : '\u8f93\u5165\u4f60\u7684\u95ee\u9898...'
                        }
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) =>
                            e.key === 'Enter' && !e.shiftKey && sendMessage()
                        }
                        disabled={needsTaskSelection}
                    />
                    <div className="chat-input-actions">
                        {busy && !input.trim() ? (
                            <button
                                type="button"
                                className="chat-cancel"
                                onClick={cancelRun}
                            >
                                {'\u53d6\u6d88'}
                            </button>
                        ) : null}
                        <button
                            type="button"
                            className="chat-send"
                            onClick={sendMessage}
                            disabled={!input.trim() || needsTaskSelection}
                        >
                            {busy
                                ? '\u53d1\u9001\uff08\u5c06\u4e2d\u65ad\u5f53\u524d\u4efb\u52a1\uff09'
                                : '\u53d1\u9001'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
