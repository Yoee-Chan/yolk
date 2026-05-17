import React from 'react';
import './token-manage/token-manage.css';
import TokenUsageChart from './token-manage/TokenUsageChart';
import DailyTokenLimit from './token-manage/DailyTokenLimit';
import TokenPlanOverview from './token-manage/TokenPlanOverview';
import TokenRechargePackages from './token-manage/TokenRechargePackages';

export default function TokenMange() {
    return (
        <div className="token-manage">
            <header className="token-manage__header">
                <h2>词元流量管理</h2>
                <p>查看用量趋势、管理每日限额、掌握套餐余量并购买加量包</p>
            </header>

            <section className="token-manage__grid-top">
                <TokenPlanOverview/>
                <DailyTokenLimit/>
            </section>

            <TokenUsageChart/>
            <div style={{marginTop: 20}}>
                <TokenRechargePackages/>
            </div>
        </div>
    );
}
