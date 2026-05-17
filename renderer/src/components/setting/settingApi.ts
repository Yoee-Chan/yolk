export interface SettingRequest {
    SettingType: string;
    cmd: string;
    Param?: Record<string, string | number>;
}

export interface MCPServer {
    type: string;
    url: string;
}

export interface MCPConfig {
    mcpServers: Record<string, MCPServer>;
}

export interface ProviderConfig {
    provider: string;
    model: string;
    base_url: string;
    api_key: string;
    max_tokens: number;
    temperature: number;
}

export interface SubPathItem {
    name: string;
    fullPath: string;
    permission: string;
}

export interface WorkspaceData {
    workSpace: string;
    subPath: { subPathName: string; permission: string }[];
}

export const providerOptions = [
    {value: 'openai', label: 'OpenAI 兼容'},
    {value: 'azure', label: 'Azure OpenAI'},
    {value: 'ollama', label: 'Ollama'},
    {value: 'aws', label: 'AWS Bedrock'},
];

export async function callSetting(req: SettingRequest): Promise<unknown> {
    const raw = await window.api.llmSetting(JSON.stringify(req));
    const parsed = JSON.parse(raw);
    if (parsed.type === 'command_error') {
        throw new Error(parsed.error || '请求失败');
    }
    return parsed.result;
}
