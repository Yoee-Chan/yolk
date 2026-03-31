import React, {useState} from 'react';
import "../css/Chat.css"

interface Message {
    role: string,
    content: string
}

export default function Chat() {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([
        {role: "user", content: "你好！"},
        {role: "assistant", content: "你好，我是你的 AI 助手。"},
    ]);
    const sendMessage = () => {
        if (!input.trim()) return;

        const newMsg: Message = {role: "user", content: input};
        setMessages([...messages, newMsg]);

        setInput("");
    };
    return (
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
    )
}