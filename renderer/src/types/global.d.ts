interface ImportMetaEnv {
    readonly VITE_YOLK_API_URL?: string;
}

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
            llmSetting: (Param: string) => Promise<string>;
            jiraOAuthLogin: (options?: {
                default_project_key?: string;
            }) => Promise<unknown>;
            scanWorkspace: (Param: string) => Promise<WorkingSpace>;
        };
    }
}
export {};
