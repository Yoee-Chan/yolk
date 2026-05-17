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
        message.success('\u5df2\u53d6\u6d88\u6267\u884c\uff0c\u72b6\u6001\u8bb0\u4e3a\u5df2\u5f03\u7528');
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
        message.info('\u5df2\u542f\u52a8\u6267\u884c\uff08\u6f14\u793a\u6570\u636e\uff0c\u540e\u7aef\u63a5\u5165\u540e\u5c06\u771f\u5b9e\u8dd1\u6d41\u7a0b\uff09');
    };

    const handleFormSubmit = (values: DefinitionFormValues) => {
        const next = buildDefinitionFromForm(values, editing ?? undefined);
        if (editing) {
            setDefinitions((prev) => prev.map((d) => (d.id === editing.id ? next : d)));
            message.success('\u6d41\u6c34\u7ebf\u5df2\u66f4\u65b0');
        } else {
            setDefinitions((prev) => [...prev, next]);
            message.success('\u6d41\u6c34\u7ebf\u5df2\u521b\u5efa');
        }
        setFormOpen(false);
        setEditing(null);
    };

    return (
        <main className="pipeline-task">
            <header className="pipeline-task__header">
                <h2>{'\u6d41\u6c34\u7ebf\u4efb\u52a1'}</h2>
                <Paragraph type="secondary">
                    {
                        '\u5b9a\u4e49\u591a\u4e2a\u6d41\u7a0b\u4efb\u52a1\uff0c\u67e5\u770b\u6267\u884c\u8bb0\u5f55\uff08\u8fdb\u884c\u4e2d\u3001\u5df2\u5b8c\u6210\u3001\u9519\u8bef\u3001\u5df2\u5f03\u7528\uff09\uff0c\u672a\u5b8c\u6210\u524d\u53ef\u53d6\u6d88'
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
                        label: `\u6267\u884c\u8bb0\u5f55 (${executions.length})`,
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
                        label: `\u6d41\u7a0b\u5b9a\u4e49 (${definitions.length})`,
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
