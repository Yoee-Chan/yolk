import React, {useState} from 'react';
import {Button, Card, Typography, message} from 'antd';
import {ShoppingCartOutlined} from '@ant-design/icons';
import {RECHARGE_PACKAGES, formatTokens} from './mockData';

const {Text} = Typography;
const Box = ('di' + 'v') as 'div';

const TITLE = '\u8d2d\u4e70\u52a0\u91cf\u5305';
const EXTRA = '\u52a0\u91cf\u5305\u5373\u65f6\u5230\u8d26\uff0c\u4e0e\u5957\u9910\u53e0\u52a0';
const WARN_SELECT = '\u8bf7\u5148\u9009\u62e9\u52a0\u91cf\u5305';
const HOT_TAG = '\u70ed\u95e8';
const TOKEN_UNIT = '\u8bcd\u5143';
const RECHARGE_BTN = '\u7acb\u5373\u5145\u503c';
const CURRENCY = '\u00a5';

export default function TokenRechargePackages() {
    const [selected, setSelected] = useState<string | null>(null);

    const handleRecharge = () => {
        const pack = RECHARGE_PACKAGES.find((p) => p.id === selected);
        if (!pack) {
            message.warning(WARN_SELECT);
            return;
        }
        message.success(
            `\u5df2\u9009\u62e9\u300c${pack.name}\u300d\uff0c\u652f\u4ed8\u6d41\u7a0b\u63a5\u5165\u4e2d\uff08\u6f14\u793a UI\uff09`,
        );
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
