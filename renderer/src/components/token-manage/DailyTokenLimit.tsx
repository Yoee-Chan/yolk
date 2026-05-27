import React, {useState} from 'react';
import {Button, Card, InputNumber, Progress, Slider, Typography, message} from 'antd';
import {SaveOutlined, ThunderboltOutlined} from '@ant-design/icons';
import {DEFAULT_DAILY_LIMIT, formatTokens} from './mockData';

const {Text} = Typography;

const MIN_LIMIT = 5_000;
const MAX_LIMIT = 500_000;
const STEP = 5_000;

const TITLE = '每日限额';
const HINT =
    '拖动滑块或输入数值，设置 Agent 每日词元消耗上限，超出后当日将停止调用。';
const SAVE_BTN = '保存设置';
const TODAY_USAGE = '今日用量';
const TOKEN_UNIT = '词元';
const SAVE_MSG_PREFIX = '每日限额已保存为 ';
const REMAINING_PREFIX = '今日剩余 ';
const NEAR_LIMIT = ' · 即将达到上限';

interface DailyTokenLimitProps {
    todayUsed?: number;
}

export default function DailyTokenLimit({todayUsed = 28_640}: DailyTokenLimitProps) {
    const [limit, setLimit] = useState(DEFAULT_DAILY_LIMIT);
    const [savedLimit, setSavedLimit] = useState(DEFAULT_DAILY_LIMIT);

    const percent = Math.min(100, Math.round((todayUsed / limit) * 100));
    const remaining = Math.max(0, limit - todayUsed);

    const handleSave = () => {
        setSavedLimit(limit);
        message.success(`${SAVE_MSG_PREFIX}${formatTokens(limit)}`);
    };

    return (
        <Card
            title={
                <span>
                    <ThunderboltOutlined style={{marginRight: 8}}/>
                    {TITLE}
                </span>
            }
        >
            <p className="daily-limit__hint">{HINT}</p>
            <div style={{display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8}}>
                <Slider
                    min={MIN_LIMIT}
                    max={MAX_LIMIT}
                    step={STEP}
                    value={limit}
                    onChange={setLimit}
                    style={{flex: 1}}
                    tooltip={{formatter: (v) => `${formatTokens(v ?? 0)} ${TOKEN_UNIT}`}}
                />
                <InputNumber
                    min={MIN_LIMIT}
                    max={MAX_LIMIT}
                    step={STEP}
                    value={limit}
                    onChange={(v) => v != null && setLimit(v)}
                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    style={{width: 140}}
                />
            </div>
            <Button type="primary" icon={<SaveOutlined/>} onClick={handleSave}>
                {SAVE_BTN}
            </Button>
            <div className="daily-limit__preview">
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 8}}>
                    <Text>{TODAY_USAGE}</Text>
                    <Text strong>
                        {formatTokens(todayUsed)} / {formatTokens(savedLimit)}
                    </Text>
                </div>
                <Progress
                    percent={percent}
                    strokeColor={percent >= 90 ? '#ff4d4f' : '#e60012'}
                    format={() => `${percent}%`}
                />
                <Text type="secondary" style={{fontSize: 12, marginTop: 8, display: 'block'}}>
                    {REMAINING_PREFIX}
                    {formatTokens(remaining)} {TOKEN_UNIT}
                    {percent >= 90 && NEAR_LIMIT}
                </Text>
            </div>
        </Card>
    );
}
