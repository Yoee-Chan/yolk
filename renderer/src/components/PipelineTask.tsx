import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Tabs, Typography, message} from 'antd';
import './pipeline-task/pipeline-task.css';
import PipelineStatusSummary, {type StatusFilter} from './pipeline-task/PipelineStatusSummary';
import PipelineDefinitionList from './pipeline-task/PipelineDefinitionList';
import PipelineExecutionList from './pipeline-task/PipelineExecutionList';
import PipelineDefinitionForm, {
    buildDefinitionFromForm,
    type DefinitionFormValues,
} from './pipeline-task/PipelineDefinitionForm';
import {loadPipelineStore, savePipelineStore} from './pipeline-task/store';
import {cancelPipelineRun, startPipelineRun} from './pipeline-task/runPipeline';
import type {
    ExecutionStatus,
    PipelineDefinition,
    PipelineExecution,
} from './pipeline-task/types';
import {newId} from './pipeline-task/utils';

const {Paragraph} = Typography;

const MAX_LOG_LINES = 2000;

export default function PipelineTask() {
    const [definitions, setDefinitions] = useState<PipelineDefinition[]>([]);
    const [executions, setExecutions] = useState<PipelineExecution[]>([]);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<PipelineDefinition | null>(null);
    const [activeTab, setActiveTab] = useState('executions');
    const [storePath, setStorePath] = useState('');
    const [loading, setLoading] = useState(true);

    const loadedRef = useRef(false);
    const runningExecutionIdRef = useRef<string | null>(null);
    const cancelledExecutionIdRef = useRef<string | null>(null);
    const logBufferRef = useRef<Map<string, string[]>>(new Map());
    const flushTimerRef = useRef<number | null>(null);

    useEffect(() => {
        let alive = true;
        loadPipelineStore()
            .then((store) => {
                if (!alive) return;
                setDefinitions(store.definitions);
                setExecutions(store.executions);
                loadedRef.current = true;
                setLoading(false);
            })
            .catch((e) => {
                if (!alive) return;
                setLoading(false);
                message.error(`读取本机流水线数据失败：${String(e)}`);
            });
        return () => {
            alive = false;
            if (flushTimerRef.current !== null) {
                window.clearTimeout(flushTimerRef.current);
            }
        };
    }, []);

    // 数据落盘：`<workspace>/流水线任务/pipelines.json`
    // 执行期间日志会高频变化，这里做 1 秒防抖，并且只保留最近 500 行日志，避免频繁写盘。
    useEffect(() => {
        if (!loadedRef.current) return;
        const timer = window.setTimeout(() => {
            savePipelineStore({
                version: 1,
                updatedAt: new Date().toISOString(),
                definitions,
                executions: executions.map((e) => ({
                    ...e,
                    logs: (e.logs ?? []).slice(-500),
                })),
            })
                .then((path) => {
                    if (path) setStorePath(path);
                })
                .catch((e) => message.error(`保存流水线数据失败：${String(e)}`));
        }, 1000);
        return () => window.clearTimeout(timer);
    }, [definitions, executions]);

    const patchExecution = useCallback(
        (id: string, updater: (exec: PipelineExecution) => PipelineExecution) => {
            setExecutions((prev) => prev.map((e) => (e.id === id ? updater(e) : e)));
        },
        []
    );

    const flushLogs = useCallback(() => {
        flushTimerRef.current = null;
        const buffer = logBufferRef.current;
        if (buffer.size === 0) return;
        const snapshot = new Map(buffer);
        buffer.clear();
        setExecutions((prev) =>
            prev.map((exec) => {
                const incoming = snapshot.get(exec.id);
                if (!incoming || incoming.length === 0) return exec;
                const merged = [...(exec.logs ?? []), ...incoming];
                return {
                    ...exec,
                    logs: merged.length > MAX_LOG_LINES ? merged.slice(-MAX_LOG_LINES) : merged,
                };
            })
        );
    }, []);

    const appendLog = useCallback(
        (executionId: string, line: string) => {
            const buffer = logBufferRef.current;
            const list = buffer.get(executionId) ?? [];
            list.push(line);
            buffer.set(executionId, list);
            if (flushTimerRef.current === null) {
                flushTimerRef.current = window.setTimeout(flushLogs, 250);
            }
        },
        [flushLogs]
    );

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
        cancelledExecutionIdRef.current = executionId;
        if (runningExecutionIdRef.current === executionId) {
            cancelPipelineRun();
        }
        patchExecution(executionId, (e) =>
            e.status === 'running'
                ? {
                      ...e,
                      status: 'abandoned',
                      finishedAt: new Date().toISOString(),
                      stageResults: e.stageResults.map((s) =>
                          s.status === 'pending' || s.status === 'running'
                              ? {...s, status: 'skipped' as const}
                              : s
                      ),
                  }
                : e
        );
        message.success('已取消执行，状态记为已弃用');
    };

    const handleToggleEnabled = (id: string, enabled: boolean) => {
        setDefinitions((prev) => prev.map((d) => (d.id === id ? {...d, enabled} : d)));
    };

    const handleRunNow = (def: PipelineDefinition) => {
        if (runningExecutionIdRef.current) {
            message.warning('已有流水线正在执行，请等待完成或先取消');
            return;
        }
        if (def.stages.length === 0) {
            message.warning('该流水线还没有配置阶段，请先编辑再执行');
            return;
        }

        const executionId = newId('exec');
        const exec: PipelineExecution = {
            id: executionId,
            pipelineId: def.id,
            pipelineName: def.name,
            status: 'running',
            currentStageIndex: 0,
            startedAt: new Date().toISOString(),
            stageResults: def.stages.map((s, i) => ({
                stageId: s.id,
                status: i === 0 ? 'running' : 'pending',
            })),
            logs: [],
            artifacts: [],
        };

        runningExecutionIdRef.current = executionId;
        cancelledExecutionIdRef.current = null;
        setExecutions((prev) => [exec, ...prev]);
        setActiveTab('executions');
        setStatusFilter('running');
        message.info('已启动 Agent 执行流水线');

        startPipelineRun(def, {
            onLog: (line) => appendLog(executionId, line),
            onStageDone: (index) => {
                patchExecution(executionId, (current) => ({
                    ...current,
                    currentStageIndex: Math.min(index + 1, def.stages.length - 1),
                    stageResults: current.stageResults.map((s, i) => {
                        if (i === index) return {...s, status: 'done' as const};
                        if (i === index + 1) return {...s, status: 'running' as const};
                        return s;
                    }),
                }));
            },
            onStageError: (index, reason) => {
                patchExecution(executionId, (current) => ({
                    ...current,
                    currentStageIndex: index,
                    stageResults: current.stageResults.map((s, i) => {
                        if (i === index) {
                            return {stageId: s.stageId, status: 'error' as const, errorMessage: reason};
                        }
                        return s;
                    }),
                }));
            },
            onArtifacts: (paths) => {
                patchExecution(executionId, (current) => ({
                    ...current,
                    artifacts: [...new Set([...(current.artifacts ?? []), ...paths])],
                }));
            },
            onFinish: (status, errorMessage, failedStageIndex) => {
                runningExecutionIdRef.current = null;
                flushLogs();
                // 结束时记录不再是「进行中」，把只看进行中的筛选切回全部，避免记录凭空消失。
                setStatusFilter((f) => (f === 'running' ? 'all' : f));
                const cancelled = cancelledExecutionIdRef.current === executionId;
                patchExecution(executionId, (current) => {
                    const errorIndex =
                        failedStageIndex ??
                        current.stageResults.findIndex((s) => s.status === 'error');
                    return {
                        ...current,
                        status: cancelled ? 'abandoned' : status,
                        finishedAt: new Date().toISOString(),
                        errorMessage: cancelled ? undefined : errorMessage,
                        currentStageIndex:
                            errorIndex >= 0 ? errorIndex : current.currentStageIndex,
                        // 没跑完的阶段一律不算完成：失败阶段标失败，其余标跳过。
                        stageResults: current.stageResults.map((s, i) => {
                            if (s.status === 'done') return s;
                            if (!cancelled && i === errorIndex) {
                                return {
                                    ...s,
                                    status: 'error' as const,
                                    errorMessage: s.errorMessage ?? errorMessage,
                                };
                            }
                            return {...s, status: 'skipped' as const};
                        }),
                    };
                });
                if (cancelled) {
                    message.success('已取消执行，状态记为已弃用');
                } else if (status === 'completed') {
                    message.success('流水线执行完成');
                } else if (failedStageIndex !== undefined) {
                    message.error(
                        `第 ${failedStageIndex + 1} 阶段「${
                            def.stages[failedStageIndex]?.name ?? ''
                        }」失败：${errorMessage ?? '未知原因'}`
                    );
                } else {
                    message.error(errorMessage || '流水线执行失败');
                }
            },
        });
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
                        '定义多个流程任务，点击「立即执行」后由 Agent 按阶段调用本机工具完成（如检索 Outlook 并保存附件）'
                    }
                </Paragraph>
                {storePath && (
                    <Paragraph type="secondary" style={{fontSize: 12, marginTop: 4}}>
                        {'本机数据：'}
                        {storePath}
                    </Paragraph>
                )}
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
                                loading={loading}
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
