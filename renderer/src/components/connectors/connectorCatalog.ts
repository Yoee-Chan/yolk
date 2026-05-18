export type ConnectorField = {
    key: string;
    label: string;
    description?: string;
};

export type ConnectorDefinition = {
    id: string;
    name: string;
    description: string;
    /** 淡色背景，参考 Power Automate 连接器色板 */
    accent: string;
    accentBorder: string;
    iconLetter: string;
    available: boolean;
    requiredFields: ConnectorField[];
    optionalFields: ConnectorField[];
};

export const CONNECTORS: ConnectorDefinition[] = [
    {
        id: 'jira',
        name: 'Jira',
        description: '通过 OAuth 登录 Atlassian，获取访问令牌并在任务中创建、查询 Issue。',
        accent: '#e8f4fd',
        accentBorder: '#b6d9f5',
        iconLetter: 'J',
        available: true,
        requiredFields: [
            {
                key: 'client_id',
                label: 'Client ID',
                description: 'Atlassian OAuth 应用的客户端 ID',
            },
            {
                key: 'client_secret',
                label: 'Client Secret',
                description: '仅保存在本机，用于换取访问令牌',
            },
            {
                key: 'oauth_login',
                label: 'OAuth 授权登录',
                description: '在浏览器中完成 Atlassian 账户授权',
            },
        ],
        optionalFields: [
            {
                key: 'default_project_key',
                label: '默认项目键',
                description: '未在对话中指定项目时使用，例如 PROJ',
            },
        ],
    },
    {
        id: 'outlook',
        name: 'Outlook',
        description: '连接 Microsoft 365 邮箱，发送与读取邮件。',
        accent: '#f3ecfa',
        accentBorder: '#d4c2eb',
        iconLetter: 'O',
        available: false,
        requiredFields: [
            {key: 'tenant_id', label: '租户 ID'},
            {key: 'client_id', label: '应用程序 ID'},
        ],
        optionalFields: [{key: 'mailbox', label: '邮箱地址'}],
    },
    {
        id: 'slack',
        name: 'Slack',
        description: '向频道发送消息或读取对话上下文。',
        accent: '#eaf8ef',
        accentBorder: '#b8e6c8',
        iconLetter: 'S',
        available: false,
        requiredFields: [
            {key: 'workspace', label: '工作区'},
            {key: 'bot_token', label: 'Bot Token'},
        ],
        optionalFields: [{key: 'default_channel', label: '默认频道'}],
    },
    {
        id: 'github',
        name: 'GitHub',
        description: '访问仓库、Issue 与 Pull Request。',
        accent: '#fff4e8',
        accentBorder: '#f5d4b0',
        iconLetter: 'G',
        available: false,
        requiredFields: [
            {key: 'pat', label: 'Personal Access Token'},
        ],
        optionalFields: [
            {key: 'org', label: '组织'},
            {key: 'default_repo', label: '默认仓库'},
        ],
    },
];

export function getConnectorById(id: string): ConnectorDefinition | undefined {
    return CONNECTORS.find((c) => c.id === id);
}
