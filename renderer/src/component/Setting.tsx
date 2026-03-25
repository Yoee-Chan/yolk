import React from "react";

export interface ConfigState {
    safetyLevel: string;
    provider: string;
    model: string;
}

interface ConfigProps {
    config: ConfigState;
    setConfig: (config: ConfigState) => void;
}

export default function Setting({ config, setConfig }: ConfigProps) {
    return (
        <div className="config">
            <h2>配置</h2>

            <label>安全等级</label>
            <select
                value={config.safetyLevel}
                onChange={(e) =>
                    setConfig({ ...config, safetyLevel: e.target.value })
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
                    setConfig({ ...config, provider: e.target.value })
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
                    setConfig({ ...config, model: e.target.value })
                }
            >
                <option value="gpt-4">GPT‑4</option>
                <option value="gpt-4-mini">GPT‑4 Mini</option>
                <option value="deepseek-chat">DeepSeek Chat</option>
                <option value="claude-3">Claude 3</option>
            </select>
        </div>
    );
}
