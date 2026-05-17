import React, {useState} from 'react';
import {Button, Card, InputNumber, Progress, Slider, Typography, message} from 'antd';
import {SaveOutlined, ThunderboltOutlined} from '@ant-design/icons';
import {DEFAULT_DAILY_LIMIT, formatTokens} from './mockData';

const {Text} = Typography;

const MIN_LIMIT = 5_000;
const MAX_LIMIT = 500_000;
const STEP = 5_000;

const TITLE = '\u6bcf\u65e5\u9650\u989d';
const HINT =
    '\u62d6\u52a8\u6ed1\u5757\u6216\u8f93\u5165\u6570\u503c\uff0c\u8bbe\u7f6e Agent \u6bcf\u65e5\u8bcd\u5143\u6d88\u8017\u4e0a\u9650\uff0c\u8d85\u51fa\u540e\u5f53\u65e5\u5c06\u505c\u6b62\u8c03\u7528\u3002';
const SAVE_BTN = '\u4fdd\u5b58\u8bbe\u7f6e';
const TODAY_USAGE = '\u4eca\u65e5\u7528\u91cf';
const TOKEN_UNIT = '\u8bcd\u5143';
const SAVE_MSG_PREFIX = '\u6bcf\u65e5\u9650\u989d\u5df2\u4fdd\u5b58\u4e3a ';
const REMAINING_PREFIX = '\u4eca\u65e5\u5269\u4f59 ';
const NEAR_LIMIT = ' \u00b7 \u5373\u5c06\u8fbe\u5230\u4e0a\u9650';

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
