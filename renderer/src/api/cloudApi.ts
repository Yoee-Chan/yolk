const BASE_URL = import.meta.env.VITE_YOLK_API_URL ?? 'http://localhost:8080';

export interface ApiResponse<T> {
    code: number;
    message: string;
    data: T | null;
}

export interface UserProfile {
    id: number;
    email: string | null;
    phone: string | null;
    nickname: string;
    avatarUrl: string | null;
}

export interface AuthResult {
    token: string;
    user: UserProfile;
}

export interface ChatTaskSummary {
    id: string;
    title: string;
    sessionId: string;
    pinned: boolean;
    updatedAt: string;
}

export interface ChatMessageRecord {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    createdAt: string;
}

export interface ChatTaskDetail {
    id: string;
    title: string;
    sessionId: string;
    pinned: boolean;
    createdAt: string;
    updatedAt: string;
    messages: ChatMessageRecord[];
}

const TOKEN_KEY = 'yolk_auth_token';

export function getStoredToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
    if (token) {
        localStorage.setItem(TOKEN_KEY, token);
    } else {
        localStorage.removeItem(TOKEN_KEY);
    }
}

async function request<T>(
    path: string,
    options: RequestInit = {},
    auth = true
): Promise<T> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
    };
    const token = getStoredToken();
    if (auth && token) {
        headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(`${BASE_URL}${path}`, {...options, headers});
    let body: ApiResponse<T> | null = null;
    try {
        body = (await res.json()) as ApiResponse<T>;
    } catch {
        /* 非 JSON 响应（如请求体过大被网关拒绝） */
    }
    if (!res.ok || !body || body.code !== 0 || body.data === null) {
        throw new Error(
            body?.message ||
                (res.status === 413 ? '上传内容过大，请换一张较小的图片' : `请求失败 (${res.status})`)
        );
    }
    return body.data;
}

export const cloudApi = {
    registerEmail: (email: string, password: string, nickname?: string) =>
        request<AuthResult>('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({email, password, nickname}),
        }, false),

    registerPhone: (phone: string, password: string, nickname?: string) =>
        request<AuthResult>('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({phone, password, nickname}),
        }, false),

    login: (account: string, password: string) =>
        request<AuthResult>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({account, password}),
        }, false),

    me: () => request<UserProfile>('/api/auth/me'),

    updateProfile: (payload: {nickname?: string; avatarUrl?: string | null}) =>
        request<UserProfile>('/api/auth/profile', {
            method: 'PUT',
            body: JSON.stringify(payload),
        }),

    updatePassword: (oldPassword: string, newPassword: string) =>
        request<null>('/api/auth/password', {
            method: 'PUT',
            body: JSON.stringify({oldPassword, newPassword}),
        }),

    listChatTasks: () => request<ChatTaskSummary[]>('/api/chat/tasks'),

    createChatTask: () =>
        request<ChatTaskSummary>('/api/chat/tasks', {method: 'POST'}),

    getChatTask: (id: string) => request<ChatTaskDetail>(`/api/chat/tasks/${id}`),

    appendChatMessage: (taskId: string, role: 'user' | 'assistant', content: string) =>
        request<ChatMessageRecord>(`/api/chat/tasks/${taskId}/messages`, {
            method: 'POST',
            body: JSON.stringify({role, content}),
        }),

    updateChatTaskTitle: (taskId: string, title: string) =>
        request<ChatTaskSummary>(`/api/chat/tasks/${taskId}/title`, {
            method: 'PUT',
            body: JSON.stringify({title}),
        }),

    updateChatTaskPin: (taskId: string, pinned: boolean) =>
        request<ChatTaskSummary>(`/api/chat/tasks/${taskId}/pin`, {
            method: 'PUT',
            body: JSON.stringify({pinned}),
        }),
};
