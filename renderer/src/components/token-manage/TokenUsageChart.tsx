import React, {useMemo, useState} from 'react';
import {Card, Segmented, Statistic, Typography} from 'antd';
import {LineChartOutlined} from '@ant-design/icons';
import {
    UsagePeriod,
    formatTokens,
    getUsageSeries,
} from './mockData';

const {Text} = Typography;
const Box = ('di' + 'v') as keyof JSX.IntrinsicElements;

const PERIOD_OPTIONS = [
    {label: '\u6309\u5929', value: 'day'},
    {label: '\u6309\u5468', value: 'week'},
    {label: '\u6309\u6708', value: 'month'},
];

const TITLE = '\u8bcd\u5143\u4f7f\u7528\u91cf';
const TOKEN_UNIT = '\u8bcd\u5143';

const CHART_W = 640;
const CHART_H = 180;
const PAD = {top: 12, right: 16, bottom: 8, left: 8};

function buildLinePath(
    values: number[],
    maxVal: number,
    width: number,
    height: number,
): string {
    if (values.length === 0) return '';
    const innerW = width - PAD.left - PAD.right;
    const innerH = height - PAD.top - PAD.bottom;
    const step = values.length > 1 ? innerW / (values.length - 1) : 0;

    return values
        .map((v, i) => {
            const x = PAD.left + i * step;
            const y = PAD.top + innerH - (v / maxVal) * innerH;
            return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(' ');
}

function buildAreaPath(
    linePath: string,
    values: number[],
    width: number,
    height: number,
): string {
    if (values.length === 0) return '';
    const innerW = width - PAD.left - PAD.right;
    const innerH = height - PAD.top - PAD.bottom;
    const step = values.length > 1 ? innerW / (values.length - 1) : 0;
    const baseY = PAD.top + innerH;
    const lastX = PAD.left + (values.length - 1) * step;
    const firstX = PAD.left;
    return `${linePath} L ${lastX.toFixed(1)} ${baseY} L ${firstX.toFixed(1)} ${baseY} Z`;
}

export default function TokenUsageChart() {
    const [period, setPeriod] = useState<UsagePeriod>('week');
    const series = useMemo(() => getUsageSeries(period), [period]);
    const maxVal = Math.max(...series.map((p) => p.value), 1);
    const total = series.reduce((s, p) => s + p.value, 0);
    const avg = Math.round(total / series.length);
    const peak = Math.max(...series.map((p) => p.value));

    const values = series.map((p) => p.value);
    const linePath = buildLinePath(values, maxVal, CHART_W, CHART_H);
    const areaPath = buildAreaPath(linePath, values, CHART_W, CHART_H);

    const innerW = CHART_W - PAD.left - PAD.right;
    const innerH = CHART_H - PAD.top - PAD.bottom;
    const step = values.length > 1 ? innerW / (values.length - 1) : 0;

    const showEveryNth = period === 'month' ? 5 : period === 'day' ? 3 : 1;

    const periodHint =
        period === 'day'
            ? '\u4eca\u65e5 24 \u5c0f\u65f6\u8d8b\u52bf'
            : period === 'week'
              ? '\u8fd1 7 \u65e5\u8d8b\u52bf'
              : '\u8fd1 30 \u65e5\u8d8b\u52bf';

    const gridYs = [0.25, 0.5, 0.75].map(
        (ratio) => PAD.top + innerH * (1 - ratio),
    );

    return (
        <Card
            title={
                <span>
                    <LineChartOutlined style={{marginRight: 8}}/>
                    {TITLE}
                </span>
            }
            className="token-manage__section"
        >
            <Box className="usage-chart__toolbar">
                <Segmented
                    options={PERIOD_OPTIONS}
                    value={period}
                    onChange={(v) => setPeriod(v as UsagePeriod)}
                />
                <Text type="secondary">{periodHint}</Text>
            </Box>
            <Box className="usage-chart__plot">
                <svg
                    className="usage-chart__svg"
                    viewBox={`0 0 ${CHART_W} ${CHART_H + 24}`}
                    preserveAspectRatio="xMidYMid meet"
                    role="img"
                    aria-label={TITLE}
                >
                    <defs>
                        <linearGradient
                            id="usage-line-gradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop offset="0%" stopColor="#ff4d4f"/>
                            <stop offset="100%" stopColor="#ff4d4f" stopOpacity="0"/>
                        </linearGradient>
                    </defs>
                    {gridYs.map((y) => (
                        <line
                            key={y}
                            className="usage-chart__grid-line"
                            x1={PAD.left}
                            y1={y}
                            x2={CHART_W - PAD.right}
                            y2={y}
                        />
                    ))}
                    <path className="usage-chart__area" d={areaPath}/>
                    <path className="usage-chart__line" d={linePath}/>
                    {series.map((point, i) => {
                        const x = PAD.left + i * step;
                        const y =
                            PAD.top + innerH - (point.value / maxVal) * innerH;
                        return (
                            <g key={`${period}-${point.label}`}>
                                <circle
                                    className="usage-chart__dot"
                                    cx={x}
                                    cy={y}
                                    r={3.5}
                                >
                                    <title>
                                        {`${point.label}: ${formatTokens(point.value)} ${TOKEN_UNIT}`}
                                    </title>
                                </circle>
                                {(i % showEveryNth === 0 || period === 'week') && (
                                    <text
                                        className="usage-chart__axis-label"
                                        x={x}
                                        y={CHART_H + 20}
                                    >
                                        {point.label}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </svg>
            </Box>
            <Box className="usage-chart__summary">
                <Statistic title={'\u5408\u8ba1\u6d88\u8017'} value={formatTokens(total)} suffix={TOKEN_UNIT}/>
                <Statistic title={'\u65e5\u5747 / \u5747\u503c'} value={formatTokens(avg)} suffix={TOKEN_UNIT}/>
                <Statistic title={'\u5cf0\u503c'} value={formatTokens(peak)} suffix={TOKEN_UNIT}/>
            </Box>
        </Card>
    );
}
