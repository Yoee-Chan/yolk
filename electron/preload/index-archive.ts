import {contextBridge, ipcRenderer} from 'electron'

contextBridge.exposeInMainWorld('api', {
    runPython: (
        args: any,
        onData: (data: string) => void,
        onError: (err: string) => void,
        onExit: (code: number) => void
    ) => {
        ipcRenderer.send('run-agent-controller', args)

        ipcRenderer.on('agent-controller-stream', (_, data) => onData(data))
        ipcRenderer.on('agent-controller-error', (_, err) => onError(err))
        ipcRenderer.on('agent-controller-exit', (_, code) => onExit(code))
    }
})
