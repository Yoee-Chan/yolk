import React from "react";

export interface Message {
    role: "user" | "assistant";
    content: string;
}

interface HistoryProps {
    messages: Message[];
}

export default function History({ messages }: HistoryProps) {
    return (
        <div className="history">
            <h2>聊天记录</h2>
            {messages.map((m, i) => (
                <div key={i} className="history-item">
                    <strong>{m.role === "user" ? "你：" : "AI："}</strong>
                    {m.content.slice(0, 20)}...
                </div>
            ))}
        </div>
    );
}
