import React, { useState } from "react";
import "../../css/main/main.css";

import Setting, { ConfigState } from "../../component/Setting";
import History, { Message } from "../../component/History";

export default function MainPage() {
    const [messages, setMessages] = useState<Message[]>([
        { role: "user", content: "你好！" },
        { role: "assistant", content: "你好，我是你的 AI 助手。" },
    ]);

    const [input, setInput] = useState("");

    const [config, setConfig] = useState<ConfigState>({
        safetyLevel: "medium",
        provider: "openai",
        model: "gpt-4",
    });

    const sendMessage = () => {
        if (!input.trim()) return;

        const newMsg: Message = { role: "user", content: input };
        setMessages([...messages, newMsg]);

        setInput("");
    };

    return (
        <div className="layout">
            {/* 左侧 Sidebar */}
            <div className="sidebar">
                <Setting config={config} setConfig={setConfig} />
                <History messages={messages} />
            </div>

            {/* 右侧聊天主区域 */}
            <div className="chat">
                <div className="chat-body">
                    {messages.map((m, i) => (
                        <div
                            key={i}
                            className={`msg ${m.role === "user" ? "msg-user" : "msg-ai"}`}
                        >
                            <div className="msg-role">
                                {m.role === "user" ? "你" : "AI"}
                            </div>
                            <div>{m.content}</div>
                        </div>
                    ))}
                </div>

                <div className="chat-input">
                    <input
                        placeholder="输入你的问题..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    />
                    <button onClick={sendMessage}>发送</button>
                </div>
            </div>
        </div>
    );
}
