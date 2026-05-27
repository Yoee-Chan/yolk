import React from 'react';
import type {ExecutionStatus} from './types';

export type StatusFilter = 'all' | ExecutionStatus;

interface Props {
    counts: Record<ExecutionStatus, number>;
    total: number;
    activeFilter: StatusFilter;
    onFilterChange: (filter: StatusFilter) => void;
}

const CARDS: {
    key: StatusFilter;
    label: string;
    className: string;
    countKey?: ExecutionStatus;
}[] = [
    {key: 'all', label: '全部记录', className: ''},
    {key: 'running', label: '进行中', className: 'summary-card--running', countKey: 'running'},
    {key: 'completed', label: '已完成', className: 'summary-card--completed', countKey: 'completed'},
    {key: 'error', label: '发生错误', className: 'summary-card--error', countKey: 'error'},
    {key: 'abandoned', label: '已弃用', className: 'summary-card--abandoned', countKey: 'abandoned'},
];

export default function PipelineStatusSummary({
    counts,
    total,
    activeFilter,
    onFilterChange,
}: Props) {
    return (
        <section className="pipeline-task__summary">
            {CARDS.map((card) => {
                const value = card.key === 'all' ? total : counts[card.countKey!];
                const active = activeFilter === card.key;
                return (
                    <button
                        key={card.key}
                        type="button"
                        className={`summary-card ${card.className} ${active ? 'summary-card--active' : ''}`}
                        onClick={() => onFilterChange(card.key)}
                    >
                        <span className="summary-card__label">{card.label}</span>
                        <span className="summary-card__value">{value}</span>
                    </button>
                );
            })}
        </section>
    );
}
