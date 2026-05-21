import React, {useCallback, useEffect, useState} from 'react';
import {Button, Typography} from 'antd';
import {ArrowLeftOutlined} from '@ant-design/icons';
import '../css/Connectors.css';
import {
    CONNECTORS,
    ConnectorDefinition,
    getConnectorById,
} from './connectors/connectorCatalog';
import JiraConnector from './JiraConnector';
import WeChatConnector from './WeChatConnector';
import {callSetting} from './setting/settingApi';

const {Paragraph} = Typography;

function ConnectorFieldsSummary({connector}: {connector: ConnectorDefinition}) {
    return (
        <div className="connector-fields">
            <div className="connector-fields__section">
                <div className="connector-fields__title">必填项</div>
                <div className="connector-fields__list">
                    {connector.requiredFields.map((field) => (
                        <div
                            key={field.key}
                            className="connector-field-row"
                        >
                            <span className="connector-field-row__label">
                                {field.label}
                            </span>
                            {field.description && (
                                <span className="connector-field-row__desc">
                                    {field.description}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            {connector.optionalFields.length > 0 && (
                <div className="connector-fields__section">
                    <div className="connector-fields__title">选填项</div>
                    <div className="connector-fields__list">
                        {connector.optionalFields.map((field) => (
                            <div
                                key={field.key}
                                className="connector-field-row"
                            >
                                <span className="connector-field-row__label">
                                    {field.label}
                                </span>
                                {field.description && (
                                    <span className="connector-field-row__desc">
                                        {field.description}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function ConnectorDetail({
    connector,
    onBack,
}: {
    connector: ConnectorDefinition;
    onBack: () => void;
}) {
    return (
        <div className="connectors-page connectors-page--wide">
            <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                onClick={onBack}
                className="connector-detail__back"
            >
                返回连接器
            </Button>

            <div
                className="connector-detail__hero"
                style={{
                    background: connector.accent,
                    borderColor: connector.accentBorder,
                }}
            >
                <div
                    className="connector-detail__hero-icon"
                    style={{
                        background: '#fff',
                        borderColor: connector.accentBorder,
                    }}
                >
                    {connector.iconLetter}
                </div>
                <div className="connector-detail__hero-text">
                    <h3>{connector.name}</h3>
                    <p>{connector.description}</p>
                </div>
            </div>

            <ConnectorFieldsSummary connector={connector} />

            {connector.id === 'jira' && connector.available ? (
                <div className="connector-detail-form">
                    <JiraConnector embedded />
                </div>
            ) : connector.id === 'wechat' && connector.available ? (
                <div className="connector-detail-form">
                    <WeChatConnector embedded />
                </div>
            ) : (
                <div className="connector-coming-soon">
                    <Paragraph style={{margin: 0}}>
                        该连接器即将推出，敬请期待。
                    </Paragraph>
                </div>
            )}
        </div>
    );
}

function ConnectorTile({
    connector,
    connected,
    onSelect,
}: {
    connector: ConnectorDefinition;
    connected?: boolean;
    onSelect: (id: string) => void;
}) {
    const disabled = !connector.available;

    return (
        <button
            type="button"
            className={
                disabled
                    ? 'connector-tile connector-tile--disabled'
                    : 'connector-tile'
            }
            style={{
                background: connector.accent,
                borderColor: connector.accentBorder,
            }}
            onClick={() => !disabled && onSelect(connector.id)}
            disabled={disabled}
            aria-label={connector.name}
        >
            {connected && (
                <span className="connector-tile__badge">已连接</span>
            )}
            {!connector.available && (
                <span className="connector-tile__soon">即将推出</span>
            )}
            <div
                className="connector-tile__icon"
                style={{
                    background: '#fff',
                    borderColor: connector.accentBorder,
                }}
            >
                {connector.iconLetter}
            </div>
            <span className="connector-tile__name">{connector.name}</span>
            <span className="connector-tile__desc">{connector.description}</span>
        </button>
    );
}

export default function Connectors() {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [jiraConnected, setJiraConnected] = useState(false);
    const [wechatConnected, setWechatConnected] = useState(false);

    const loadConnectorStatus = useCallback(async () => {
        try {
            const jira = await callSetting({
                SettingType: 'jira_connector',
                cmd: 'search',
            });
            setJiraConnected(Boolean((jira as {connected?: boolean}).connected));
        } catch {
            setJiraConnected(false);
        }
        try {
            const wechat = await callSetting({
                SettingType: 'wechat_connector',
                cmd: 'search',
            });
            setWechatConnected(Boolean((wechat as {connected?: boolean}).connected));
        } catch {
            setWechatConnected(false);
        }
    }, []);

    useEffect(() => {
        loadConnectorStatus().catch(console.error);
    }, [loadConnectorStatus]);

    const selected = selectedId ? getConnectorById(selectedId) : undefined;

    if (selected) {
        return (
            <ConnectorDetail
                connector={selected}
                onBack={() => {
                    setSelectedId(null);
                    loadConnectorStatus().catch(console.error);
                }}
            />
        );
    }

    return (
        <div className="connectors-page">
            <header className="connectors-page__header">
                <h2>连接器</h2>
                <p>
                    选择要接入的服务并完成授权。配置完成后，Agent
                    可通过对应令牌访问外部系统（例如 Jira 创建任务）。
                </p>
            </header>
            <div className="connectors-grid">
                {CONNECTORS.map((connector) => (
                    <ConnectorTile
                        key={connector.id}
                        connector={connector}
                        connected={
                            connector.id === 'jira'
                                ? jiraConnected
                                : connector.id === 'wechat'
                                  ? wechatConnected
                                  : false
                        }
                        onSelect={setSelectedId}
                    />
                ))}
            </div>
        </div>
    );
}
