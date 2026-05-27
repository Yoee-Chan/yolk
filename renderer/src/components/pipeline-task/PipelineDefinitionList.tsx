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
                    <Text strong style={{fontSize: 16}}>{'流程定义'}</Text>
                    <Paragraph type="secondary" style={{margin: '4px 0 0'}}>
                        {
                            '配置开始时间、过程阶段与权限；可启用多个流水线任务'
                        }
                    </Paragraph>
                </section>
                <Button type="primary" icon={<PlusOutlined/>} onClick={onCreate}>
                    {'新建流水线'}
                </Button>
            </header>

            {definitions.length === 0 ? (
                <Empty description={'暂无流程定义，点击上方按钮创建'}/>
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
                                        checkedChildren={'启用'}
                                        unCheckedChildren={'停用'}
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
                                        {'编辑'}
                                    </Button>,
                                    <Button
                                        key="run"
                                        type="link"
                                        icon={<PlayCircleOutlined/>}
                                        disabled={!def.enabled}
                                        onClick={() => onRunNow(def)}
                                    >
                                        {'立即执行'}
                                    </Button>,
                                ]}
                            >
                                <Paragraph type="secondary" ellipsis={{rows: 2}}>
                                    {def.description || '暂无描述'}
                                </Paragraph>
                                <p className="def-card__meta">
                                    <Tag color="blue">
                                        {'开始 · '}
                                        {formatScheduleLabel(def.schedule)}
                                    </Tag>
                                    <Tag>
                                        {'过程 · '}
                                        {def.stages.length}
                                        {' 个阶段'}
                                    </Tag>
                                </p>
                                <Text type="secondary" style={{fontSize: 12}}>
                                    {'过程阶段预览'}
                                </Text>
                                <ol className="def-card__stages">
                                    {def.stages.map((s, i) => (
                                        <li key={s.id}>
                                            {i + 1}. {s.name}
                                            {s.permissions.length > 0 && (
                                                <Text type="secondary">
                                                    {'（'}
                                                    {s.permissions.length}
                                                    {' 项权限）'}
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
