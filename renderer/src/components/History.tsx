import React from 'react';
import {PushpinOutlined} from '@ant-design/icons';

export interface Message {
    id: string;
    content: string;
    pinned?: boolean;
}

interface HistoryProps {
    messages: Message[];
    onSelect?: (id: string) => void;
}

export default function History({messages, onSelect}: HistoryProps) {
    return (
        <div className="sidebar-history">
            <ul className="sidebar-history-list">
                {messages.map((m) => (
                    <li key={m.id}>
                        <button
                            type="button"
                            className="sidebar-history-item"
                            onClick={() => onSelect?.(m.id)}
                            title={m.content}
                        >
                            <span className="sidebar-history-item__text">
                                {m.content.length > 28
                                    ? `${m.content.slice(0, 28)}…`
                                    : m.content}
                            </span>
                            {m.pinned ? (
                                <PushpinOutlined
                                    className="sidebar-history-item__pin"
                                    aria-label="已置顶"
                                />
                            ) : null}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
