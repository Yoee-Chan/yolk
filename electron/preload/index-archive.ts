import {contextBridge, ipcRenderer} from 'electron'

contextBridge.exposeInMainWorld('api', {
    runPython: (
        args: any,
        onData: (data: string) => void,
        onError: (err: string) => void,
        onExit: (code: number) => void
    ) => {
        ipcRenderer.send('run-python', args)

        ipcRenderer.on('python-stream', (_, data) => onData(data))
        ipcRenderer.on('python-error', (_, err) => onError(err))
        ipcRenderer.on('python-exit', (_, code) => onExit(code))
    }
})
