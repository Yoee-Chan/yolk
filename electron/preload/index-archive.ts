import {contextBridge, ipcRenderer} from 'electron'

contextBridge.exposeInMainWorld('api', {
    runPython: (
        args: any,
        onData: (data: string) => void,
        onError: (err: string) => void,
        onExit: (code: number) => void
    ) => {
        ipcRenderer.send('run-agent-runtime', args)

        ipcRenderer.on('agent-runtime-stream', (_, data) => onData(data))
        ipcRenderer.on('agent-runtime-error', (_, err) => onError(err))
        ipcRenderer.on('agent-runtime-exit', (_, code) => onExit(code))
    }
})
