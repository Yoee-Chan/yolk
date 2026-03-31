import React from "react";

export interface Message {
    id: string;
    content: string;
}

interface HistoryProps {
    messages: Message[];
}

export default function History({messages}: HistoryProps) {
    return (
        <div className="history">
            <h3>任务记录</h3>
            {messages.map((m, i) => (
                <div key={i} className="history-item">
                    {
                        m.content.length > 20 ? m.content.slice(0, 20) + "..." : m.content
                    }
                </div>
            ))}
        </div>
    );
}
