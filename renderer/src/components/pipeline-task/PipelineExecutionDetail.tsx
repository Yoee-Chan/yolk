import React from 'react';
import {Alert, Steps, Tag} from 'antd';
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
                </>
            ),
        };
    });

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
                    title={'\u6267\u884c\u9519\u8bef'}
                    description={execution.errorMessage}
                />
            )}
        </section>
    );
}
