declare global {
    interface Window {
        api: {
            runPython: (
                args: any,
                onData: (data: string) => void,
                onError: (err: string) => void,
                onExit: (code: number) => void
            ) => void;

            sendPythonInput: (data: any) => void;

            onPythonInputEcho?: (callback: (data: string) => void) => void;

            selectFolder: () => Promise<string | null>;
            scanWorkspace: (path: string) => Promise<string[]>;
        };
    }
}
export {};
