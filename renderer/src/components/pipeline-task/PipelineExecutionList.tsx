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
        return <Empty description={'\u5f53\u524d\u7b5b\u9009\u4e0b\u6682\u65e0\u6267\u884c\u8bb0\u5f55'}/>;
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
                                    {'\u5f00\u59cb '}{formatDateTime(exec.startedAt)}
                                    {exec.finishedAt && ` \u00b7 \u7ed3\u675f ${formatDateTime(exec.finishedAt)}`}
                                </p>
                                <p style={{marginTop: 8}}>
                                    <Tag color={executionStatusColor(exec.status)}>
                                        {'\u7ed3\u679c \u00b7 '}{executionStatusLabel(exec.status)}
                                    </Tag>
                                    {exec.status === 'running' && def && (
                                        <Tag color="blue">
                                            {'\u8fc7\u7a0b \u00b7 \u7b2c '}
                                            {exec.currentStageIndex + 1}
                                            {' / '}
                                            {def.stages.length}
                                            {' \u9636\u6bb5'}
                                        </Tag>
                                    )}
                                </p>
                            </section>
                            <aside className="exec-item__actions">
                                {exec.status === 'running' && (
                                    <Popconfirm
                                        title={'\u786e\u5b9a\u53d6\u6d88\u8be5\u6d41\u6c34\u7ebf\uff1f'}
                                        description={
                                            '\u672a\u5b8c\u6210\u524d\u53ef\u968f\u65f6\u53d6\u6d88\uff0c\u72b6\u6001\u5c06\u8bb0\u4e3a\u300c\u5df2\u5f03\u7528\u300d\u3002'
                                        }
                                        onConfirm={() => onCancel(exec.id)}
                                        okText={'\u53d6\u6d88\u6267\u884c'}
                                        cancelText={'\u8fd4\u56de'}
                                    >
                                        <Button danger size="small" icon={<StopOutlined/>}>
                                            {'\u53d6\u6d88'}
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
