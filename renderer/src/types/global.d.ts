declare module '*.png' {
    const src: string;
    export default src;
}

type WechatArticleDraft = {
    title: string;
    subtitle: string;
    content: string;
    outlineTree: unknown[];
    updatedAt: string;
};

declare global {
    interface Window {
        api: {
            runPython: (
                args: any,
                onData: (data: string) => void,
                onError: (err: string) => void,
                onExit: (code: number | null) => void
            ) => void;

            cancelPython: () => void;

            sendPythonInput: (data: any) => void;

            onPythonInputEcho?: (callback: (data: string) => void) => void;

            selectFolder: () => Promise<string | null>;
            importWechatDocx: () => Promise<{fileName: string; html: string} | null>;
            loadWechatArticle: () => Promise<WechatArticleDraft | null>;
            saveWechatArticle: (article: WechatArticleDraft) => Promise<boolean>;
            annotateWechatArticle: (request: {
                selectedText: string;
                annotation: string;
                articleTitle?: string;
                articleContent?: string;
                authToken?: string;
                apiUrl?: string;
            }) => Promise<{replacement: string}>;
            llmSetting: (Param: string) => Promise<string>;
            jiraOAuthLogin: (options?: {
                default_project_key?: string;
            }) => Promise<unknown>;
            scanWorkspace: (Param: string) => Promise<WorkingSpace>;
        };
    }
}
export {};
