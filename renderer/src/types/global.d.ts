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
            scanWorkspace: (Param: string) => Promise<WorkingSpace>;
        };
    }
}
export {};
