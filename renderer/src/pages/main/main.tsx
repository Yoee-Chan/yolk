import React, {useState} from "react";
import "../../css/main/main.css";
import Assistant from "../../components/Assistant";
import History, {Message} from "../../components/History";
import Chat from "../../components/Chat";
import Found from "../../components/Found";
import NewTask from "../../components/NewTask";
import PipelineTask from "../../components/PipelineTask";
import TokenMange from "../../components/TokenMange";
import Setting from "../../components/Setting";




const PageMap = {
    chat: Chat,
    newTask: NewTask,
    pipelineTask: PipelineTask,
    tokenMange: TokenMange,
    found: Found,
    setting: Setting
}

export default function MainPage() {
    const [activeKey, setActiveKey] = useState<keyof typeof PageMap>("chat");
    const ActiveComponent = PageMap[activeKey]
    const SettingClickHandler = (item: any) => {
        setActiveKey(item)
    }
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '001',
            content: '发送邮件'
        }, {
            id: "002",
            content: '爬取100张川菜的图片'
        }

    ]);
    return (
        <div className="layout">
            {/* 左侧 Sidebar */}
            <div className="sidebar">
                <Assistant onClickItem={SettingClickHandler}/>
                <History messages={messages}/>
            </div>
            {/* 主要的 main */}
            <div className="chat">
                <ActiveComponent/>
            </div>
        </div>
    );
}
