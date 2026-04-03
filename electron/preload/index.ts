import {contextBridge, ipcRenderer} from 'electron'

contextBridge.exposeInMainWorld('api', {
    runPython: (
        args: any,
        onData: (data: string) => void,
        onError: (err: string) => void,
        onExit: (code: number) => void
    ) => {
        // 发送启动指令
        ipcRenderer.send('run-agent-runtime', args)

        // 持续监听 Python stdout
        ipcRenderer.on('agent-runtime-stream', (_, data) => {
            onData(data)
        })

        // 持续监听 Python stderr
        ipcRenderer.on('agent-runtime-error', (_, err) => {
            onError(err)
        })

        // 监听 Python 退出
        ipcRenderer.on('agent-runtime-exit', (_, code) => {
            onExit(code)
        })

    },
    sendPythonInput: (data: any) => {
        ipcRenderer.send('agent-runtime-input', data)

    },
    onPythonInputEcho: (callback: (data: string) => void) => {
        ipcRenderer.on('agent-runtime-input-echo', (_, data) => callback(data));
    },
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    scanWorkspace: (path: string) => ipcRenderer.invoke("scan-workspace", path)
})
