import React, {useCallback, useEffect, useRef, useState} from 'react';
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
};

const PROTOCOL_TYPES = new Set([
    'result',
    'error',
    'stream',
    'need_input',
    'need_plan_confirm',
    'done',
]);

/** 与 agent-controller / human_input_bridge 约定 */
const PLAN_DECISION_CONFIRM = '__PLAN_CONFIRM__';
const PLAN_DECISION_CANCEL = '__PLAN_CANCEL__';

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

/** 与 local-llm-engine `toolcall.think` 中 `logger.info(f"✨ {self.name}'s thoughts: ...")` 对齐 */
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
                    <summary>模型计划</summary>
                    <pre className="chat-diag-pre">{plan}</pre>
                </details>
            ) : null}
            {hasInfo ? (
                <div className="chat-diag-conn">
                    <div className="chat-diag-conn-title">连接信息</div>
                    <pre className="chat-diag-pre chat-diag-conn-pre">
                        {infoLines.join('\n')}
                    </pre>
                </div>
            ) : null}
        </div>
    );
}

export default function Chat() {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            kind: 'text',
            role: 'assistant',
            content:
                '在下方输入问题后，系统会先请模型整理「执行计划、所需权限、将使用的程序」并请你确认；确认后才会启动 Agent 与工具。取消则不会执行任何操作。模型通过 agent-controller 连接 local-llm-engine（请在 local-llm-engine/config/config.toml 配置 base_url）；应用启动时会预热 Python 子进程。',
        },
    ]);
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
            if (t === 'stream' && typeof msg.text === 'string') {
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
                // 子进程常驻等下一条 run；单次推理结束以 done 为准，否则 busy 会一直为 true
                setBusy(false);
                return;
            }
            if (t === 'result' && typeof msg.text === 'string') {
                appendAssistant(msg.text);
                setBusy(false);
                return;
            }
            if (t === 'error' && typeof msg.text === 'string') {
                appendAssistant(`[错误] ${msg.text}`);
                setBusy(false);
                return;
            }
            if (t === 'need_input' && msg.id != null) {
                const prompt =
                    typeof msg.text === 'string' ? msg.text : '需要你的输入';
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
        [appendAssistant]
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

    const sendMessage = () => {
        const text = input.trim();
        if (!text) {
            return;
        }

        if (busy) {
            setPendingHumanInput(null);
            setPendingPlanConfirm(null);
            setHumanDraft('');
        }

        runIdRef.current += 1;
        const runId = runIdRef.current;

        const historyForApi = messages
            .filter(
                (m): m is TextMessage =>
                    m.kind === 'text' &&
                    (m.role === 'user' || m.role === 'assistant')
            )
            .map((m) => ({role: m.role, content: m.content}))
            .slice(-40);

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

        window.api.runPython(
            {
                msg: text,
                history: historyForApi,
                interruptPrevious: busy,
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
            {pendingPlanConfirm ? (
                <div
                    className="chat-human-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="chat-plan-title"
                >
                    <div className="chat-human-modal">
                        <div id="chat-plan-title" className="chat-human-title">
                            请确认执行计划
                        </div>
                        <p className="chat-plan-hint">
                            确认后将启动智能体并按计划调用工具；取消则不会执行任何操作。
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
                                取消
                            </button>
                            <button
                                type="button"
                                className="chat-human-ok"
                                onClick={submitPlanConfirm}
                            >
                                确认执行
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
                            智能体请求输入
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
                            placeholder="在此输入回复…（Enter 提交，Shift+Enter 换行，Esc 取消）"
                        />
                        <div className="chat-human-actions">
                            <button
                                type="button"
                                className="chat-human-cancel"
                                onClick={cancelHumanInput}
                            >
                                跳过（发送空内容）
                            </button>
                            <button
                                type="button"
                                className="chat-human-ok"
                                onClick={submitHumanInput}
                            >
                                提交
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
            <div className="chat-body">
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
                        placeholder="输入你的问题..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) =>
                            e.key === 'Enter' && !e.shiftKey && sendMessage()
                        }
                    />
                    <div className="chat-input-actions">
                        {busy && !input.trim() ? (
                            <button
                                type="button"
                                className="chat-cancel"
                                onClick={cancelRun}
                            >
                                取消
                            </button>
                        ) : null}
                        <button
                            type="button"
                            className="chat-send"
                            onClick={sendMessage}
                            disabled={!input.trim()}
                        >
                            {busy ? '发送（将中断当前任务）' : '发送'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
