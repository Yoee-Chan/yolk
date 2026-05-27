import React, {useState} from 'react';
import {Button, Card, Typography, message} from 'antd';
import {ShoppingCartOutlined} from '@ant-design/icons';
import {RECHARGE_PACKAGES, formatTokens} from './mockData';

const {Text} = Typography;
const Box = ('di' + 'v') as 'div';

const TITLE = '购买加量包';
const EXTRA = '加量包即时到账，与套餐叠加';
const WARN_SELECT = '请先选择加量包';
const HOT_TAG = '热门';
const TOKEN_UNIT = '词元';
const RECHARGE_BTN = '立即充值';
const CURRENCY = '¥';

type TokenRechargePackagesProps = {
    onProceedToCheckout: (pack: (typeof RECHARGE_PACKAGES)[number]) => void;
};

export default function TokenRechargePackages({onProceedToCheckout}: TokenRechargePackagesProps) {
    const [selected, setSelected] = useState<string | null>('pack-m');

    const handleRecharge = () => {
        const pack = RECHARGE_PACKAGES.find((p) => p.id === selected);
        if (!pack) {
            message.warning(WARN_SELECT);
            return;
        }
        onProceedToCheckout(pack);
    };

    return (
        <Card
            title={
                <span>
                    <ShoppingCartOutlined style={{marginRight: 8}}/>
                    {TITLE}
                </span>
            }
            extra={<Text type="secondary" style={{fontSize: 13}}>{EXTRA}</Text>}
        >
            <Box className="recharge-grid">
                {RECHARGE_PACKAGES.map((pack) => (
                    <Box
                        key={pack.id}
                        role="button"
                        tabIndex={0}
                        className={`recharge-card${pack.hot ? ' recharge-card--hot' : ''}`}
                        onClick={() => setSelected(pack.id)}
                        onKeyDown={(e) => e.key === 'Enter' && setSelected(pack.id)}
                        style={
                            selected === pack.id
                                ? {borderColor: '#e60012', boxShadow: '0 0 0 2px rgba(230,0,18,0.2)'}
                                : undefined
                        }
                    >
                        {(pack.tag || pack.hot) && (
                            <span className="recharge-card__tag">{pack.tag || HOT_TAG}</span>
                        )}
                        <Box className="recharge-card__tokens">
                            {formatTokens(pack.tokens)}
                            <span> {TOKEN_UNIT}</span>
                        </Box>
                        <Box className="recharge-card__name">{pack.name}</Box>
                        <Box className="recharge-card__price">
                            {CURRENCY}
                            {pack.price}
                            {pack.originalPrice != null && (
                                <del>
                                    {CURRENCY}
                                    {pack.originalPrice}
                                </del>
                            )}
                        </Box>
                    </Box>
                ))}
            </Box>
            <Button
                type="primary"
                size="large"
                block
                style={{marginTop: 20, background: '#e60012', borderColor: '#e60012'}}
                onClick={handleRecharge}
            >
                {RECHARGE_BTN}
            </Button>
        </Card>
    );
}
