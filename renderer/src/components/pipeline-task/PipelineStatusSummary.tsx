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
    {key: 'all', label: '\u5168\u90e8\u8bb0\u5f55', className: ''},
    {key: 'running', label: '\u8fdb\u884c\u4e2d', className: 'summary-card--running', countKey: 'running'},
    {key: 'completed', label: '\u5df2\u5b8c\u6210', className: 'summary-card--completed', countKey: 'completed'},
    {key: 'error', label: '\u53d1\u751f\u9519\u8bef', className: 'summary-card--error', countKey: 'error'},
    {key: 'abandoned', label: '\u5df2\u5f03\u7528', className: 'summary-card--abandoned', countKey: 'abandoned'},
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
