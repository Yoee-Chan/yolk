import {contextBridge, ipcRenderer} from 'electron'

contextBridge.exposeInMainWorld('api', {
    runPython: (
        args: any,
        onData: (data: string) => void,
        onError: (err: string) => void,
        onExit: (code: number) => void
    ) => {
        // 发送启动指令
        ipcRenderer.send('run-agent-controller', args)

        // 持续监听 Python stdout
        ipcRenderer.on('agent-controller-stream', (_, data) => {
            onData(data)
        })

        // 持续监听 Python stderr
        ipcRenderer.on('agent-controller-error', (_, err) => {
            onError(err)
        })

        // 监听 Python 退出
        ipcRenderer.on('agent-controller-exit', (_, code) => {
            onExit(code)
        })

    },
    sendPythonInput: (data: any) => {
        ipcRenderer.send('agent-controller-input', data)

    },
    onPythonInputEcho: (callback: (data: string) => void) => {
        ipcRenderer.on('agent-controller-input-echo', (_, data) => callback(data));
    },
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    scanWorkspace: (path: string) => ipcRenderer.invoke("scan-workspace", path)
})
