import React, {useCallback, useEffect, useState} from 'react';
import {message, Modal} from 'antd';
import '../../css/main/main.css';
import Assistant from '../../components/Assistant';
import History from '../../components/History';
import Chat from '../../components/Chat';
import Found from '../../components/Found';
import NewTask from '../../components/NewTask';
import PipelineTask from '../../components/PipelineTask';
import TokenMange from '../../components/TokenMange';
import Setting from '../../components/Setting';
import Connectors from '../../components/Connectors';
import WeChatArticleComposer from '../../components/WeChatArticleComposer';
import UserProfileBar from '../../components/auth/UserProfileBar';
import {cloudApi, type ChatTaskSummary} from '../../api/cloudApi';
import {useAuth} from '../../context/AuthContext';
import {SHOW_PIPELINE_TASK, SHOW_TOKEN_MANAGE} from '../../config/featureFlags';

const PageMap = {
    chat: Chat,
    newTask: NewTask,
    wechatArticle: WeChatArticleComposer,
    pipelineTask: PipelineTask,
    tokenMange: TokenMange,
    skill: Found,
    connection: Connectors,
    setting: Setting,
};

export default function MainPage() {
    const {user} = useAuth();
    const [activeKey, setActiveKey] = useState<keyof typeof PageMap>('chat');
    const [tasks, setTasks] = useState<ChatTaskSummary[]>([]);
    const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [restoredMessages, setRestoredMessages] = useState<
        Array<{role: 'user' | 'assistant'; content: string}> | null
    >(null);
    const [showWelcome, setShowWelcome] = useState(true);
    const [chatKey, setChatKey] = useState(0);
    const [tasksLoading, setTasksLoading] = useState(false);

    const refreshTasks = useCallback(async () => {
        if (!user) {
            setTasks([]);
            return;
        }
        const list = await cloudApi.listChatTasks();
        setTasks(list);
    }, [user]);

    useEffect(() => {
        if (
            (!SHOW_TOKEN_MANAGE && activeKey === 'tokenMange') ||
            (!SHOW_PIPELINE_TASK && activeKey === 'pipelineTask')
        ) {
            setActiveKey('chat');
        }
    }, [activeKey]);

    useEffect(() => {
        if (!user) {
            setTasks([]);
            setActiveTaskId(null);
            setSessionId(null);
            setRestoredMessages(null);
            setShowWelcome(true);
            return;
        }
        setRestoredMessages((prev) => (prev === null ? [] : prev));
        setTasksLoading(true);
        refreshTasks()
            .catch(() => setTasks([]))
            .finally(() => setTasksLoading(false));
    }, [user, refreshTasks]);

    const ensureActiveTask = useCallback(async () => {
        if (!user) {
            throw new Error('未登录');
        }
        if (activeTaskId && sessionId) {
            return {taskId: activeTaskId, sessionId};
        }
        const task = await cloudApi.createChatTask();
        setTasks((prev) => [task, ...prev]);
        setActiveTaskId(task.id);
        setSessionId(task.sessionId);
        setRestoredMessages([]);
        setShowWelcome(false);
        setActiveKey('chat');
        return {taskId: task.id, sessionId: task.sessionId};
    }, [user, activeTaskId, sessionId]);

    const openNewTask = useCallback(async () => {
        if (!user) {
            return;
        }
        const task = await cloudApi.createChatTask();
        setTasks((prev) => [task, ...prev]);
        setActiveTaskId(task.id);
        setSessionId(task.sessionId);
        setRestoredMessages([]);
        setShowWelcome(true);
        setActiveKey('chat');
        setChatKey((k) => k + 1);
    }, [user]);

    const selectTask = useCallback(async (id: string) => {
        const detail = await cloudApi.getChatTask(id);
        setActiveTaskId(detail.id);
        setSessionId(detail.sessionId);
        setRestoredMessages(
            detail.messages.map((m) => ({
                role: m.role,
                content: m.content,
            }))
        );
        setShowWelcome(detail.messages.length === 0);
        setActiveKey('chat');
        setChatKey((k) => k + 1);
    }, []);

    const handleTaskTitleUpdated = useCallback((taskId: string, title: string) => {
        setTasks((prev) =>
            prev.map((t) => (t.id === taskId ? {...t, title} : t))
        );
    }, []);

    const handleTogglePin = useCallback(async (id: string, pinned: boolean) => {
        const updated = await cloudApi.updateChatTaskPin(id, pinned);
        setTasks((prev) => {
            const next = prev.map((t) => (t.id === id ? updated : t));
            next.sort((a, b) => {
                if (a.pinned !== b.pinned) {
                    return a.pinned ? -1 : 1;
                }
                return b.updatedAt.localeCompare(a.updatedAt);
            });
            return next;
        });
    }, []);

    const handleDeleteTask = useCallback(
        (id: string) => {
            Modal.confirm({
                title: '删除此任务？',
                content: '任务将从列表中移除，聊天记录在后台保留（软删除）。',
                okText: '删除',
                okType: 'danger',
                cancelText: '取消',
                onOk: async () => {
                    try {
                        await cloudApi.deleteChatTask(id);
                        setTasks((prev) => prev.filter((t) => t.id !== id));
                        if (activeTaskId === id) {
                            setActiveTaskId(null);
                            setSessionId(null);
                            setRestoredMessages([]);
                            setShowWelcome(true);
                            setChatKey((k) => k + 1);
                        }
                        message.success('任务已删除');
                    } catch (e) {
                        message.error(
                            e instanceof Error ? e.message : '删除失败'
                        );
                    }
                },
            });
        },
        [activeTaskId]
    );

    const ActiveComponent = PageMap[activeKey];

    return (
        <div className={activeKey === 'wechatArticle' ? 'layout layout--composer' : 'layout'}>
            {activeKey !== 'wechatArticle' ? <aside className="sidebar">
                <Assistant activeItem={activeKey} onClickItem={setActiveKey}/>
                <div className="sidebar-divider" role="separator"/>
                <History
                    tasks={tasks}
                    activeTaskId={activeTaskId}
                    onSelect={selectTask}
                    onNewTask={openNewTask}
                    onTogglePin={user ? handleTogglePin : undefined}
                    onDelete={user ? handleDeleteTask : undefined}
                    disabled={!user || tasksLoading}
                />
                <div className="sidebar-footer">
                    <UserProfileBar
                        onUpgrade={
                            SHOW_TOKEN_MANAGE
                                ? () => setActiveKey('tokenMange')
                                : undefined
                        }
                    />
                </div>
            </aside> : null}
            <div className="main-panel">
                {activeKey === 'chat' ? (
                    <Chat
                        key={chatKey}
                        taskId={user ? activeTaskId : null}
                        sessionId={user ? sessionId : null}
                        initialMessages={user ? restoredMessages : null}
                        showWelcome={showWelcome}
                        onTaskTitleUpdated={handleTaskTitleUpdated}
                        onTasksChanged={refreshTasks}
                        onEnsureTask={user ? ensureActiveTask : undefined}
                    />
                ) : activeKey === 'wechatArticle' ? (
                    <WeChatArticleComposer onBack={() => setActiveKey('chat')}/>
                ) : (
                    <ActiveComponent/>
                )}
            </div>
        </div>
    );
}
