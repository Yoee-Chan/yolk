import React, {useState} from "react";
import "../../css/main/main.css";


export default function MainPage() {
    const [messages, setMessages] = useState([
        {role: "user", content: "你好！"},
        {role: "assistant", content: "你好，我是你的 AI 助手。"},
    ]);

    const [input, setInput] = useState("");
    const [config, setConfig] = useState({
        safetyLevel: "medium",
        provider: "openai",
        model: "gpt-4",
    });

    const sendMessage = () => {
        if (!input.trim()) return;

        const newMsg = {role: "user", content: input};
        setMessages([...messages, newMsg]);

        setInput("");
    };

    return (
        <div className="layout">
            {/* 左侧 Sidebar */}
            <div className="sidebar">
                {/* 配置区 */}
                <div className="config">
                    <h2>配置</h2>

                    <label>安全等级</label>
                    <select
                        value={config.safetyLevel}
                        onChange={(e) =>
                            setConfig({...config, safetyLevel: e.target.value})
                        }
                    >
                        <option value="low">低</option>
                        <option value="medium">中</option>
                        <option value="high">高</option>
                    </select>

                    <label>Token 厂商</label>
                    <select
                        value={config.provider}
                        onChange={(e) =>
                            setConfig({...config, provider: e.target.value})
                        }
                    >
                        <option value="openai">OpenAI</option>
                        <option value="deepseek">DeepSeek</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="local">本地模型</option>
                    </select>

                    <label>模型</label>
                    <select
                        value={config.model}
                        onChange={(e) =>
                            setConfig({...config, model: e.target.value})
                        }
                    >
                        <option value="gpt-4">GPT‑4</option>
                        <option value="gpt-4-mini">GPT‑4 Mini</option>
                        <option value="deepseek-chat">DeepSeek Chat</option>
                        <option value="claude-3">Claude 3</option>
                    </select>
                </div>

                {/* 聊天记录 */}
                <div className="history">
                    <h2>聊天记录</h2>
                    {messages.map((m, i) => (
                        <div key={i} className="history-item">
                            <strong>{m.role === "user" ? "你：" : "AI："}</strong>
                            {m.content.slice(0, 20)}...
                        </div>
                    ))}
                </div>
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
