import React, {useState} from 'react';
import '../../css/main/main.css';
import Assistant from '../../components/Assistant';
import History, {Message} from '../../components/History';
import Chat from '../../components/Chat';
import Found from '../../components/Found';
import NewTask from '../../components/NewTask';
import PipelineTask from '../../components/PipelineTask';
import TokenMange from '../../components/TokenMange';
import Setting from '../../components/Setting';
import Connectors from '../../components/Connectors';
import UserProfileBar from '../../components/auth/UserProfileBar';

const PageMap = {
    chat: Chat,
    newTask: NewTask,
    pipelineTask: PipelineTask,
    tokenMange: TokenMange,
    skill: Found,
    connection: Connectors,
    setting: Setting,
};

export default function MainPage() {
    const [activeKey, setActiveKey] = useState<keyof typeof PageMap>('chat');
    const ActiveComponent = PageMap[activeKey];
    const [messages] = useState<Message[]>([
        {id: '001', content: '发送邮件', pinned: true},
        {id: '002', content: '爬取100张川菜的图片'},
        {id: '003', content: '类人记忆压缩机制EMC解析'},
        {id: '004', content: 'OpenManus 本地部署与配置'},
        {id: '005', content: "JavaScript 'await' 在非 async 函数中的用法"},
        {id: '006', content: 'Python KeyError 排查思路'},
        {id: '007', content: 'asdict() 错误解析与解决方法'},
    ]);

    return (
        <div className="layout">
            <aside className="sidebar">
                <Assistant activeItem={activeKey} onClickItem={setActiveKey}/>
                <div className="sidebar-divider" role="separator"/>
                <History messages={messages}/>
                <div className="sidebar-footer">
                    <UserProfileBar onUpgrade={() => setActiveKey('tokenMange')}/>
                </div>
            </aside>
            <div className="main-panel">
                <ActiveComponent/>
            </div>
        </div>
    );
}
