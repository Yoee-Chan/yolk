import React, {useState} from 'react';
import {message} from 'antd';
import './token-manage/token-manage.css';
import TokenUsageChart from './token-manage/TokenUsageChart';
import DailyTokenLimit from './token-manage/DailyTokenLimit';
import TokenPlanOverview from './token-manage/TokenPlanOverview';
import TokenRechargePackages from './token-manage/TokenRechargePackages';
import TokenRechargeCheckout from './token-manage/TokenRechargeCheckout';
import type {RechargePackage} from './token-manage/mockData';

export default function TokenMange() {
    const [checkoutPack, setCheckoutPack] = useState<RechargePackage | null>(null);

    const handlePaymentComplete = () => {
        if (!checkoutPack) return;
        message.success(`「${checkoutPack.name}」充值成功，词元已到账`);
        setCheckoutPack(null);
    };

    if (checkoutPack) {
        return (
            <div className="token-manage token-manage--checkout">
                <header className="token-manage__header">
                    <h2>词元流量管理</h2>
                    <p>完成支付后词元将即时到账</p>
                </header>
                <TokenRechargeCheckout
                    pack={checkoutPack}
                    onBack={() => setCheckoutPack(null)}
                    onPaid={handlePaymentComplete}
                />
            </div>
        );
    }

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
                <TokenRechargePackages onProceedToCheckout={setCheckoutPack}/>
            </div>
        </div>
    );
}
