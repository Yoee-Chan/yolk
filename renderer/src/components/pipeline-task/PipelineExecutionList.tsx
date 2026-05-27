import React, {useState} from 'react';
import {Button, Empty, Popconfirm, Tag} from 'antd';
import {StopOutlined} from '@ant-design/icons';
import type {PipelineDefinition, PipelineExecution} from './types';
import PipelineExecutionDetail from './PipelineExecutionDetail';
import {executionStatusColor, executionStatusLabel, formatDateTime} from './utils';

interface Props {
    executions: PipelineExecution[];
    definitions: PipelineDefinition[];
    onCancel: (executionId: string) => void;
}

export default function PipelineExecutionList({
    executions,
    definitions,
    onCancel,
}: Props) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    if (executions.length === 0) {
        return <Empty description={'当前筛选下暂无执行记录'}/>;
    }

    return (
        <section>
            {executions.map((exec) => {
                const def = definitions.find((d) => d.id === exec.pipelineId);
                const expanded = expandedId === exec.id;
                const toggle = () => setExpandedId(expanded ? null : exec.id);
                return (
                    <article key={exec.id} className="exec-item">
                        <header className="exec-item__top">
                            <section
                                style={{flex: 1, cursor: 'pointer'}}
                                onClick={toggle}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') toggle();
                                }}
                            >
                                <h4 className="exec-item__title">{exec.pipelineName}</h4>
                                <p className="exec-item__meta">
                                    {'开始 '}{formatDateTime(exec.startedAt)}
                                    {exec.finishedAt && ` · 结束 ${formatDateTime(exec.finishedAt)}`}
                                </p>
                                <p style={{marginTop: 8}}>
                                    <Tag color={executionStatusColor(exec.status)}>
                                        {'结果 · '}{executionStatusLabel(exec.status)}
                                    </Tag>
                                    {exec.status === 'running' && def && (
                                        <Tag color="blue">
                                            {'过程 · 第 '}
                                            {exec.currentStageIndex + 1}
                                            {' / '}
                                            {def.stages.length}
                                            {' 阶段'}
                                        </Tag>
                                    )}
                                </p>
                            </section>
                            <aside className="exec-item__actions">
                                {exec.status === 'running' && (
                                    <Popconfirm
                                        title={'确定取消该流水线？'}
                                        description={
                                            '未完成前可随时取消，状态将记为「已弃用」。'
                                        }
                                        onConfirm={() => onCancel(exec.id)}
                                        okText={'取消执行'}
                                        cancelText={'返回'}
                                    >
                                        <Button danger size="small" icon={<StopOutlined/>}>
                                            {'取消'}
                                        </Button>
                                    </Popconfirm>
                                )}
                            </aside>
                        </header>
                        {expanded && def && (
                            <PipelineExecutionDetail execution={exec} definition={def}/>
                        )}
                    </article>
                );
            })}
        </section>
    );
}
