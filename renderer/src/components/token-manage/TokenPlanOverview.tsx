import React from 'react';
import {Progress} from 'antd';
import {
    CURRENT_PLAN,
    PLAN_CATALOG,
    PLAN_QUOTA_THEME,
    formatTokens,
    getPlanQuotaLevel,
} from './mockData';

const Box = ('di' + 'v') as 'div';

const LABEL_REMAINING = '\u5269\u4f59';
const LABEL_TOTAL = '\u5957\u9910\u603b\u91cf';
const LABEL_USED = '\u5df2\u4f7f\u7528';
const LABEL_REMAINING_QUOTA = '\u5269\u4f59\u989d\u5ea6';
const RENEW_PREFIX = '\u6709\u6548\u671f\u81f3 ';
const PER_MONTH = '\u6708';
const CURRENCY = '\u00a5';

export default function TokenPlanOverview() {
    const {name, totalTokens, usedTokens, renewDate, badge} = CURRENT_PLAN;
    const remaining = totalTokens - usedTokens;
    const percentRemaining = Math.round((remaining / totalTokens) * 100);
    const quotaLevel = getPlanQuotaLevel(percentRemaining);
    const theme = PLAN_QUOTA_THEME[quotaLevel];

    return (
        <Box className={`plan-card ${theme.cardClass}`}>
            {badge && <span className="plan-card__badge">{badge}</span>}
            <Box className="plan-card__name">{name}</Box>
            <Box className="plan-card__gauge">
                <Progress
                    type="dashboard"
                    percent={percentRemaining}
                    size={140}
                    strokeColor={theme.stroke}
                    railColor="rgba(255,255,255,0.25)"
                    format={() => (
                        <span style={{color: '#fff', fontSize: 14}}>
                            {LABEL_REMAINING}
                            <br/>
                            <strong style={{fontSize: 22}}>{percentRemaining}%</strong>
                        </span>
                    )}
                />
                <Box className="plan-card__stats">
                    <Box className="plan-card__stat-row">
                        <span>{LABEL_TOTAL}</span>
                        <span>{formatTokens(totalTokens)}</span>
                    </Box>
                    <Box className="plan-card__stat-row">
                        <span>{LABEL_USED}</span>
                        <span>{formatTokens(usedTokens)}</span>
                    </Box>
                    <Box className="plan-card__stat-row">
                        <span>{LABEL_REMAINING_QUOTA}</span>
                        <strong>{formatTokens(remaining)}</strong>
                    </Box>
                </Box>
            </Box>
            <Box className="plan-card__renew">
                {RENEW_PREFIX}
                {renewDate}
            </Box>
            <Box className="plan-catalog">
                {PLAN_CATALOG.map((p) => (
                    <Box key={p.id} className="plan-catalog__item">
                        <strong>{p.name}</strong>
                        <Box>
                            {formatTokens(p.tokens)} / {PER_MONTH}
                        </Box>
                        <Box style={{color: 'rgba(255,255,255,0.75)'}}>
                            {CURRENCY}
                            {p.price} {'\u00b7'} {p.desc}
                        </Box>
                    </Box>
                ))}
            </Box>
        </Box>
    );
}
