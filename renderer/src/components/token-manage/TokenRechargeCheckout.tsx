import React, {useEffect, useState} from 'react';
import {Button, Card, Spin, Typography} from 'antd';
import {ArrowLeftOutlined, QrcodeOutlined} from '@ant-design/icons';
import type {RechargePackage} from './mockData';
import {formatTokens} from './mockData';

const {Text, Title} = Typography;
const Box = ('di' + 'v') as 'div';

const CURRENCY = '¥';
const TOKEN_UNIT = '词元';

export type TokenRechargeCheckoutProps = {
    pack: RechargePackage;
    /** 后续接入真实支付时传入二维码图片地址 */
    qrCodeUrl?: string;
    onBack: () => void;
    onPaid: () => void;
};

/** 占位二维码（后续可替换为接口返回的图片 URL） */
function PaymentQrPlaceholder({packId}: {packId: string}) {
    const cells = 11;
    const seed = packId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);

    return (
        <Box className="checkout-qr__placeholder" aria-hidden>
            <svg viewBox="0 0 100 100" className="checkout-qr__svg">
                <rect width="100" height="100" fill="#fff"/>
                {Array.from({length: cells * cells}, (_, i) => {
                    const x = i % cells;
                    const y = Math.floor(i / cells);
                    const filled = ((x * 7 + y * 13 + seed) % 5) > 1;
                    if (!filled) return null;
                    return (
                        <rect
                            key={i}
                            x={4 + x * 8.2}
                            y={4 + y * 8.2}
                            width="7"
                            height="7"
                            fill="#1a1a1a"
                            rx="0.5"
                        />
                    );
                })}
                <rect x="8" y="8" width="22" height="22" fill="none" stroke="#1a1a1a" strokeWidth="3"/>
                <rect x="70" y="8" width="22" height="22" fill="none" stroke="#1a1a1a" strokeWidth="3"/>
                <rect x="8" y="70" width="22" height="22" fill="none" stroke="#1a1a1a" strokeWidth="3"/>
            </svg>
            <Text type="secondary" className="checkout-qr__hint">
                演示二维码，接入支付后替换
            </Text>
        </Box>
    );
}

export default function TokenRechargeCheckout({
    pack,
    qrCodeUrl,
    onBack,
    onPaid,
}: TokenRechargeCheckoutProps) {
    const [loadingQr, setLoadingQr] = useState(Boolean(qrCodeUrl));

    useEffect(() => {
        if (!qrCodeUrl) return;
        setLoadingQr(true);
        const img = new Image();
        img.onload = () => setLoadingQr(false);
        img.onerror = () => setLoadingQr(false);
        img.src = qrCodeUrl;
    }, [qrCodeUrl, pack.id]);

    return (
        <Card className="checkout-card">
            <Button
                type="text"
                icon={<ArrowLeftOutlined/>}
                onClick={onBack}
                className="checkout-card__back"
            >
                返回加量包
            </Button>

            <Title level={4} style={{margin: '8px 0 4px'}}>
                订单结算
            </Title>
            <Text type="secondary">请使用手机扫码完成支付</Text>

            <Box className="checkout-summary">
                <Box>
                    <Text type="secondary">商品</Text>
                    <div className="checkout-summary__name">{pack.name}</div>
                </Box>
                <Box className="checkout-summary__tokens">
                    {formatTokens(pack.tokens)} {TOKEN_UNIT}
                </Box>
                <Box className="checkout-summary__price">
                    <Text type="secondary">应付金额</Text>
                    <span>
                        {CURRENCY}
                        {pack.price.toFixed(2)}
                    </span>
                </Box>
            </Box>

            <Box className="checkout-qr">
                <Text strong>
                    <QrcodeOutlined style={{marginRight: 6}}/>
                    扫码支付
                </Text>
                <Spin spinning={loadingQr && Boolean(qrCodeUrl)}>
                    {qrCodeUrl ? (
                        <img
                            src={qrCodeUrl}
                            alt="支付二维码"
                            className="checkout-qr__image"
                        />
                    ) : (
                        <PaymentQrPlaceholder packId={pack.id}/>
                    )}
                </Spin>
                <Text type="secondary" style={{fontSize: 13}}>
                    支持微信、支付宝（接入后生效）
                </Text>
            </Box>

            <Button
                type="primary"
                size="large"
                block
                className="checkout-card__pay-btn"
                onClick={onPaid}
            >
                我已完成支付
            </Button>
        </Card>
    );
}
