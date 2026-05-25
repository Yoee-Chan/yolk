# -*- coding: utf-8 -*-
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "renderer" / "src" / "components" / "Chat.tsx"
lines = path.read_text(encoding="utf-8").splitlines()

# Keep lines 0-27 (through ChatMessage type), then inject new block
head = lines[:28]

new_block = r'''type StreamPayload = {
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
}

const WELCOME_TEXT =
    '\u5728\u4e0b\u65b9\u8f93\u5165\u95ee\u9898\u540e\uff0c\u7cfb\u7edf\u4f1a\u5148\u8bf7\u6a21\u578b\u6574\u7406\u300c\u6267\u884c\u8ba1\u5212\u3001\u6240\u9700\u6743\u9650\u3001\u5c06\u4f7f\u7528\u7684\u7a0b\u5e8f\u300d\u5e76\u8bf7\u4f60\u786e\u8ba4\uff1b\u786e\u8ba4\u540e\u624d\u4f1a\u542f\u52a8 Agent \u4e0e\u5de5\u5177\u3002\u53d6\u6d88\u5219\u4e0d\u4f1a\u6267\u884c\u4efb\u4f55\u64cd\u4f5c\u3002\u8bf7\u5148\u70b9\u51fb\u5de6\u4fa7\u300c\u521b\u5efa\u65b0\u4efb\u52a1\u300d\uff0c\u6216\u9009\u62e9\u4e00\u6761\u5386\u53f2\u4efb\u52a1\u3002';

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

/** \u4e0e agent-controller / human_input_bridge \u7ea6\u5b9a */
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
'''.splitlines()

# Find tail starting from parseProtocolLine (was line 48, index 47)
start = next(i for i, l in enumerate(lines) if l.startswith("function parseProtocolLine"))
tail = lines[start:]

# Fix import
tail[0] = tail[0]  # parseProtocolLine stays
out = [
    "import React, {useCallback, useEffect, useRef, useState} from 'react';",
    "import {cloudApi, getStoredToken} from '../api/cloudApi';",
    "import '../css/Chat.css';",
    "",
] + lines[3:28] + new_block + tail

text = "\n".join(out) + "\n"

# Component signature
text = text.replace(
    "export default function Chat() {\n    const [input, setInput] = useState('');\n    const [messages, setMessages] = useState<ChatMessage[]>([\n        {\n            kind: 'text',\n            role: 'assistant',\n            content:\n                '",
    "export default function Chat({\n    taskId,\n    sessionId,\n    initialMessages,\n    showWelcome,\n    onTaskTitleUpdated,\n    onTasksChanged,\n}: ChatProps) {\n    const isLocalOnly = initialMessages === null;\n    const [input, setInput] = useState('');\n    const [messages, setMessages] = useState<ChatMessage[]>(() =>\n        isLocalOnly\n            ? [{kind: 'text', role: 'assistant', content: LOCAL_WELCOME_TEXT}]\n            : buildInitialMessages(initialMessages, showWelcome)\n    );\n    const __REMOVE_WELCOME__ = '",
    1,
)
# Remove old welcome message block
import re
text = re.sub(
    r"    const __REMOVE_WELCOME__ = '[^']*',\n        \},\n    \]\);",
    "",
    text,
    count=1,
)

text = text.replace(
    "    const runIdRef = useRef(0);\n\n    const appendAssistant = useCallback((content: string) => {",
    """    const runIdRef = useRef(0);
    const streamingAssistantRef = useRef('');

    const persistMessage = useCallback(
        async (role: 'user' | 'assistant', content: string) => {
            if (!taskId || !content.trim()) {
                return;
            }
            try {
                await cloudApi.appendChatMessage(taskId, role, content);
                onTasksChanged?.();
            } catch {
                /* ignore */
            }
        },
        [taskId, onTasksChanged]
    );

    const flushStreamingAssistant = useCallback(async () => {
        const content = streamingAssistantRef.current.trim();
        streamingAssistantRef.current = '';
        if (content) {
            await persistMessage('assistant', content);
        }
    }, [persistMessage]);

    const appendAssistant = useCallback((content: string) => {""",
    1,
)

text = text.replace(
    "            sawProtocolPayload.current = true;\n            const t = msg.type;\n            if (t === 'stream' && typeof msg.text === 'string') {",
    """            sawProtocolPayload.current = true;
            const t = msg.type;

            if (t === 'task_title' && msg.taskId && msg.text) {
                onTaskTitleUpdated?.(msg.taskId, msg.text);
                onTasksChanged?.();
                return;
            }

            if (t === 'stream' && typeof msg.text === 'string') {
                streamingAssistantRef.current += msg.text;""",
    1,
)

text = re.sub(
    r"            if \(t === 'done'\) \{.*?\n            \}\n            if \(t === 'need_input'",
    """            if (t === 'done') {
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
            if (t === 'need_input'""",
    text,
    count=1,
    flags=re.DOTALL,
)

text = text.replace("        [appendAssistant]\n    );", "        [appendAssistant, flushStreamingAssistant, onTaskTitleUpdated, onTasksChanged]\n    );", 1)

text = text.replace(
    "    const sendMessage = () => {\n        const text = input.trim();\n        if (!text) {\n            return;\n        }",
    "    const needsTaskSelection = !isLocalOnly && !taskId;\n\n    const sendMessage = () => {\n        const text = input.trim();\n        if (!text || needsTaskSelection) {\n            return;\n        }",
    1,
)

text = text.replace(
    "        runIdRef.current += 1;\n        const runId = runIdRef.current;\n\n        const historyForApi = messages",
    "        runIdRef.current += 1;\n        const runId = runIdRef.current;\n        streamingAssistantRef.current = '';\n\n        const historyForApi = messages",
    1,
)

text = text.replace(
    "            .slice(-40);\n\n        setMessages((prev) => [",
    "            .slice(-40);\n\n        const userMsgCount = historyForApi.filter((m) => m.role === 'user').length;\n        const isFirstMessage = userMsgCount === 0;\n\n        void persistMessage('user', text);\n\n        setMessages((prev) => [",
    1,
)

text = text.replace(
    "        window.api.runPython(\n            {\n                msg: text,\n                history: historyForApi,\n                interruptPrevious: busy,\n            },",
    "        const authToken = getStoredToken();\n        window.api.runPython(\n            {\n                msg: text,\n                history: historyForApi,\n                interruptPrevious: busy,\n                authToken: authToken ?? undefined,\n                apiUrl: import.meta.env.VITE_YOLK_API_URL ?? 'http://localhost:8080',\n                logSessionId: sessionId ?? String(runId),\n                taskId: taskId ?? undefined,\n                isFirstMessage,\n            },",
    1,
)

text = text.replace(
    "            <div className=\"chat-body\">\n                {messages.map((m, i) => {",
    "            <div className=\"chat-body\">\n                {needsTaskSelection ? (\n                    <div className=\"chat-empty-hint\">\n                        \u8bf7\u5148\u5728\u5de6\u4fa7\u70b9\u51fb\u300c\u521b\u5efa\u65b0\u4efb\u52a1\u300d\uff0c\u6216\u9009\u62e9\u4e00\u6761\u5386\u53f2\u4efb\u52a1\u540e\u518d\u5f00\u59cb\u5bf9\u8bdd\u3002\n                    </div>\n                ) : null}\n                {messages.map((m, i) => {",
    1,
)

text = text.replace(
    '                        placeholder="\u8f93\u5165\u4f60\u7684\u95ee\u9898..."',
    "                        placeholder={\n                            needsTaskSelection\n                                ? '\u8bf7\u5148\u521b\u5efa\u6216\u9009\u62e9\u4efb\u52a1\u2026'\n                                : '\u8f93\u5165\u4f60\u7684\u95ee\u9898...'\n                        }",
    1,
)

text = text.replace(
    "                        onKeyDown={(e) =>\n                            e.key === 'Enter' && !e.shiftKey && sendMessage()\n                        }\n                    />",
    "                        onKeyDown={(e) =>\n                            e.key === 'Enter' && !e.shiftKey && sendMessage()\n                        }\n                        disabled={needsTaskSelection}\n                    />",
    1,
)

text = text.replace(
    "                            disabled={!input.trim()}",
    "                            disabled={!input.trim() || needsTaskSelection}",
    1,
)

path.write_text(text, encoding="utf-8")
print("ok", path.stat().st_size)
