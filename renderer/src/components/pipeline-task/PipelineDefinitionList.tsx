import React from 'react';
import {Button, Card, Col, Empty, Row, Switch, Tag, Typography} from 'antd';
import {EditOutlined, PlayCircleOutlined, PlusOutlined} from '@ant-design/icons';
import type {PipelineDefinition} from './types';
import {formatScheduleLabel} from './utils';

const {Text, Paragraph} = Typography;

interface Props {
    definitions: PipelineDefinition[];
    onCreate: () => void;
    onEdit: (def: PipelineDefinition) => void;
    onToggleEnabled: (id: string, enabled: boolean) => void;
    onRunNow: (def: PipelineDefinition) => void;
}

export default function PipelineDefinitionList({
    definitions,
    onCreate,
    onEdit,
    onToggleEnabled,
    onRunNow,
}: Props) {
    return (
        <section>
            <header className="pipeline-task__toolbar">
                <section>
                    <Text strong style={{fontSize: 16}}>{'\u6d41\u7a0b\u5b9a\u4e49'}</Text>
                    <Paragraph type="secondary" style={{margin: '4px 0 0'}}>
                        {
                            '\u914d\u7f6e\u5f00\u59cb\u65f6\u95f4\u3001\u8fc7\u7a0b\u9636\u6bb5\u4e0e\u6743\u9650\uff1b\u53ef\u542f\u7528\u591a\u4e2a\u6d41\u6c34\u7ebf\u4efb\u52a1'
                        }
                    </Paragraph>
                </section>
                <Button type="primary" icon={<PlusOutlined/>} onClick={onCreate}>
                    {'\u65b0\u5efa\u6d41\u6c34\u7ebf'}
                </Button>
            </header>

            {definitions.length === 0 ? (
                <Empty description={'\u6682\u65e0\u6d41\u7a0b\u5b9a\u4e49\uff0c\u70b9\u51fb\u4e0a\u65b9\u6309\u94ae\u521b\u5efa'}/>
            ) : (
                <Row gutter={[16, 16]}>
                    {definitions.map((def) => (
                        <Col key={def.id} xs={24} lg={12}>
                            <Card
                                className="def-card"
                                title={def.name}
                                extra={
                                    <Switch
                                        checked={def.enabled}
                                        checkedChildren={'\u542f\u7528'}
                                        unCheckedChildren={'\u505c\u7528'}
                                        onChange={(checked) => onToggleEnabled(def.id, checked)}
                                    />
                                }
                                actions={[
                                    <Button
                                        key="edit"
                                        type="link"
                                        icon={<EditOutlined/>}
                                        onClick={() => onEdit(def)}
                                    >
                                        {'\u7f16\u8f91'}
                                    </Button>,
                                    <Button
                                        key="run"
                                        type="link"
                                        icon={<PlayCircleOutlined/>}
                                        disabled={!def.enabled}
                                        onClick={() => onRunNow(def)}
                                    >
                                        {'\u7acb\u5373\u6267\u884c'}
                                    </Button>,
                                ]}
                            >
                                <Paragraph type="secondary" ellipsis={{rows: 2}}>
                                    {def.description || '\u6682\u65e0\u63cf\u8ff0'}
                                </Paragraph>
                                <p className="def-card__meta">
                                    <Tag color="blue">
                                        {'\u5f00\u59cb \u00b7 '}
                                        {formatScheduleLabel(def.schedule)}
                                    </Tag>
                                    <Tag>
                                        {'\u8fc7\u7a0b \u00b7 '}
                                        {def.stages.length}
                                        {' \u4e2a\u9636\u6bb5'}
                                    </Tag>
                                </p>
                                <Text type="secondary" style={{fontSize: 12}}>
                                    {'\u8fc7\u7a0b\u9636\u6bb5\u9884\u89c8'}
                                </Text>
                                <ol className="def-card__stages">
                                    {def.stages.map((s, i) => (
                                        <li key={s.id}>
                                            {i + 1}. {s.name}
                                            {s.permissions.length > 0 && (
                                                <Text type="secondary">
                                                    {'\uff08'}
                                                    {s.permissions.length}
                                                    {' \u9879\u6743\u9650\uff09'}
                                                </Text>
                                            )}
                                        </li>
                                    ))}
                                </ol>
                            </Card>
                        </Col>
                    ))}
                </Row>
            )}
        </section>
    );
}
