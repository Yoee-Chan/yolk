import React from 'react';
import '../css/Setting.css';
import WorkSpaceSetting from './setting/WorkSpaceSetting';
import McpServerSetting from './setting/McpServerSetting';
import LlmProviderSetting from './setting/LlmProviderSetting';
import RiskSetting from './setting/RiskSetting';

export default function Setting() {
    return (
        <div className="setting">
            <WorkSpaceSetting/>
            <McpServerSetting/>
            <LlmProviderSetting/>
            <RiskSetting/>
        </div>
    );
}
