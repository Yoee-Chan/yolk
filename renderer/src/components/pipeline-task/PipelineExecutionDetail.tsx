import React from 'react';
import {Alert, Collapse, Empty, Steps, Tag, Typography} from 'antd';
import type {PipelineDefinition, PipelineExecution, StageRunStatus} from './types';
import {PERMISSION_OPTIONS} from './types';

interface Props {
    execution: PipelineExecution;
    definition: PipelineDefinition;
}

function stageStepStatus(status: StageRunStatus): 'wait' | 'process' | 'finish' | 'error' {
    switch (status) {
        case 'done':
            return 'finish';
        case 'running':
            return 'process';
        case 'error':
            return 'error';
        default:
            return 'wait';
    }
}

function permissionLabel(value: string): string {
    return PERMISSION_OPTIONS.find((p) => p.value === value)?.label ?? value;
}

export default function PipelineExecutionDetail({execution, definition}: Props) {
    const items = definition.stages.map((stage, index) => {
        const run = execution.stageResults.find((r) => r.stageId === stage.id);
        const status = run?.status ?? 'pending';
        return {
            title: `${index + 1}. ${stage.name}`,
            status: stageStepStatus(status),
            content: (
                <>
                    {stage.description && <p style={{margin: '0 0 6px'}}>{stage.description}</p>}
                    {stage.permissions.length > 0 && (
                        <span className="permission-tags">
                            {stage.permissions.map((p) => (
                                <Tag key={p}>{permissionLabel(p)}</Tag>
                            ))}
                        </span>
                    )}
                    {status === 'error' && (
                        <p style={{margin: '6px 0 0', color: '#cf1322'}}>
                            {'失败原因：'}
                            {run?.errorMessage || '未知原因'}
                        </p>
                    )}
                    {status === 'skipped' && (
                        <p style={{margin: '6px 0 0', color: '#8c8c8c'}}>{'已跳过'}</p>
                    )}
                </>
            ),
        };
    });

    const artifacts = execution.artifacts ?? [];
    const logs = execution.logs ?? [];

    return (
        <section className="stage-timeline">
            <Steps
                orientation="vertical"
                size="small"
                current={execution.currentStageIndex}
                items={items}
            />

            {execution.errorMessage && (
                <Alert
                    style={{marginTop: 12}}
                    type="error"
                    showIcon
                    title={'执行错误'}
                    description={execution.errorMessage}
                />
            )}

            <section style={{marginTop: 12}}>
                <p className="form-section-title">{'已保存到本机的文件'}</p>
                {artifacts.length === 0 ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={'暂无产物（Agent 尚未报告文件路径）'}
                    />
                ) : (
                    <ul className="artifact-list">
                        {artifacts.map((path) => (
                            <li key={path}>
                                <Typography.Text copyable={{text: path}} style={{fontSize: 13}}>
                                    {path}
                                </Typography.Text>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <Collapse
                style={{marginTop: 12}}
                size="small"
                items={[
                    {
                        key: 'logs',
                        label: `Agent 执行日志 (${logs.length} 行)`,
                        children:
                            logs.length === 0 ? (
                                <Typography.Text type="secondary">{'暂无日志'}</Typography.Text>
                            ) : (
                                <pre className="agent-log">{logs.join('\n')}</pre>
                            ),
                    },
                ]}
            />
        </section>
    );
}
