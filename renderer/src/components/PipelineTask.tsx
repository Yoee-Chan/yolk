import React, {useMemo, useState} from 'react';
import {Tabs, Typography, message} from 'antd';
import './pipeline-task/pipeline-task.css';
import PipelineStatusSummary, {type StatusFilter} from './pipeline-task/PipelineStatusSummary';
import PipelineDefinitionList from './pipeline-task/PipelineDefinitionList';
import PipelineExecutionList from './pipeline-task/PipelineExecutionList';
import PipelineDefinitionForm, {
    buildDefinitionFromForm,
    type DefinitionFormValues,
} from './pipeline-task/PipelineDefinitionForm';
import {INITIAL_DEFINITIONS, INITIAL_EXECUTIONS} from './pipeline-task/mockData';
import type {ExecutionStatus, PipelineDefinition, PipelineExecution} from './pipeline-task/types';
import {newId} from './pipeline-task/utils';

const {Paragraph} = Typography;

export default function PipelineTask() {
    const [definitions, setDefinitions] = useState<PipelineDefinition[]>(INITIAL_DEFINITIONS);
    const [executions, setExecutions] = useState<PipelineExecution[]>(INITIAL_EXECUTIONS);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<PipelineDefinition | null>(null);
    const [activeTab, setActiveTab] = useState('executions');

    const counts = useMemo(() => {
        const base: Record<ExecutionStatus, number> = {
            running: 0,
            completed: 0,
            error: 0,
            abandoned: 0,
        };
        for (const e of executions) base[e.status] += 1;
        return base;
    }, [executions]);

    const filteredExecutions = useMemo(() => {
        if (statusFilter === 'all') return executions;
        return executions.filter((e) => e.status === statusFilter);
    }, [executions, statusFilter]);

    const handleCancelExecution = (executionId: string) => {
        setExecutions((prev) =>
            prev.map((e) =>
                e.id === executionId && e.status === 'running'
                    ? {
                          ...e,
                          status: 'abandoned',
                          finishedAt: new Date().toISOString(),
                          stageResults: e.stageResults.map((s) =>
                              s.status === 'pending' || s.status === 'running'
                                  ? {...s, status: 'skipped' as const}
                                  : s,
                          ),
                      }
                    : e,
            ),
        );
        message.success('已取消执行，状态记为已弃用');
    };

    const handleToggleEnabled = (id: string, enabled: boolean) => {
        setDefinitions((prev) => prev.map((d) => (d.id === id ? {...d, enabled} : d)));
    };

    const handleRunNow = (def: PipelineDefinition) => {
        const exec: PipelineExecution = {
            id: newId('exec'),
            pipelineId: def.id,
            pipelineName: def.name,
            status: 'running',
            currentStageIndex: 0,
            startedAt: new Date().toISOString(),
            stageResults: def.stages.map((s, i) => ({
                stageId: s.id,
                status: i === 0 ? 'running' : 'pending',
            })),
        };
        setExecutions((prev) => [exec, ...prev]);
        setActiveTab('executions');
        setStatusFilter('running');
        message.info('已启动执行（演示数据，后端接入后将真实跑流程）');
    };

    const handleFormSubmit = (values: DefinitionFormValues) => {
        const next = buildDefinitionFromForm(values, editing ?? undefined);
        if (editing) {
            setDefinitions((prev) => prev.map((d) => (d.id === editing.id ? next : d)));
            message.success('流水线已更新');
        } else {
            setDefinitions((prev) => [...prev, next]);
            message.success('流水线已创建');
        }
        setFormOpen(false);
        setEditing(null);
    };

    return (
        <main className="pipeline-task">
            <header className="pipeline-task__header">
                <h2>{'流水线任务'}</h2>
                <Paragraph type="secondary">
                    {
                        '定义多个流程任务，查看执行记录（进行中、已完成、错误、已弃用），未完成前可取消'
                    }
                </Paragraph>
            </header>

            <PipelineStatusSummary
                counts={counts}
                total={executions.length}
                activeFilter={statusFilter}
                onFilterChange={(f) => {
                    setStatusFilter(f);
                    setActiveTab('executions');
                }}
            />

            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={[
                    {
                        key: 'executions',
                        label: `执行记录 (${executions.length})`,
                        children: (
                            <PipelineExecutionList
                                executions={filteredExecutions}
                                definitions={definitions}
                                onCancel={handleCancelExecution}
                            />
                        ),
                    },
                    {
                        key: 'definitions',
                        label: `流程定义 (${definitions.length})`,
                        children: (
                            <PipelineDefinitionList
                                definitions={definitions}
                                onCreate={() => {
                                    setEditing(null);
                                    setFormOpen(true);
                                }}
                                onEdit={(def) => {
                                    setEditing(def);
                                    setFormOpen(true);
                                }}
                                onToggleEnabled={handleToggleEnabled}
                                onRunNow={handleRunNow}
                            />
                        ),
                    },
                ]}
            />

            <PipelineDefinitionForm
                open={formOpen}
                editing={editing}
                onCancel={() => {
                    setFormOpen(false);
                    setEditing(null);
                }}
                onSubmit={handleFormSubmit}
            />
        </main>
    );
}
