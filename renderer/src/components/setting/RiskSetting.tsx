import React, {useCallback, useEffect, useState} from 'react';
import {Button, Card, Radio, Slider, Space, Typography, message} from 'antd';
import {SaveOutlined} from '@ant-design/icons';
import {callSetting} from './settingApi';

const {Text} = Typography;

export default function RiskSetting() {
    const [riskLevel, setRiskLevel] = useState<number>(5);
    const [confirmStrategy, setConfirmStrategy] = useState<string>('high');
    const [loading, setLoading] = useState(false);

    const loadRisk = useCallback(async () => {
        const result = await callSetting({SettingType: 'risk', cmd: 'search'});
        const cfg = result as { risk_level: number; confirm_strategy: string };
        if (cfg) {
            setRiskLevel(cfg.risk_level ?? 5);
            setConfirmStrategy(cfg.confirm_strategy ?? 'high');
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                await loadRisk();
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        init().catch(console.error);
    }, [loadRisk]);

    const handleSaveRisk = async () => {
        try {
            await callSetting({
                SettingType: 'risk',
                cmd: 'update',
                Param: {risk_level: riskLevel, confirm_strategy: confirmStrategy},
            });
            message.success('风险等级配置已保存');
        } catch (e) {
            message.error(e instanceof Error ? e.message : '保存失败');
        }
    };

    return (
        <Card title="风险等级配置" className="setting-section" loading={loading}>
            <div style={{marginBottom: 24}}>
                <Text strong>风险等级：</Text>
                <Slider
                    min={1}
                    max={10}
                    step={1}
                    value={riskLevel}
                    onChange={setRiskLevel}
                    marks={{1: '更灵活', 5: '模糊', 10: '精确'}}
                />
                <Text>当前等级: {riskLevel}</Text>
            </div>
            <div>
                <Text strong>动作确认策略：</Text>
                <Radio.Group
                    onChange={(e) => setConfirmStrategy(e.target.value)}
                    value={confirmStrategy}
                    style={{marginTop: 12, display: 'block'}}
                >
                    <Space orientation="vertical">
                        <Radio value="all">每个动作都确认</Radio>
                        <Radio value="high">只有高风险动作确认</Radio>
                        <Radio value="llm">LLM 自己决定什么时候问人类</Radio>
                    </Space>
                </Radio.Group>
            </div>
            <Button
                type="primary"
                icon={<SaveOutlined/>}
                style={{marginTop: 16}}
                onClick={handleSaveRisk}
            >
                保存风险配置
            </Button>
        </Card>
    );
}
