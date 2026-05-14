import {contextBridge, ipcRenderer} from 'electron'

contextBridge.exposeInMainWorld('api', {
    runPython: (
        args: any,
        onData: (data: string) => void,
        onError: (err: string) => void,
        onExit: (code: number | null) => void
    ) => {
        ipcRenderer.removeAllListeners('agent-controller-stream')
        ipcRenderer.removeAllListeners('agent-controller-error')
        ipcRenderer.removeAllListeners('agent-controller-exit')

        ipcRenderer.send('run-agent-controller', args)

        ipcRenderer.on('agent-controller-stream', (_, data) => {
            onData(data)
        })

        ipcRenderer.on('agent-controller-error', (_, err) => {
            onError(err)
        })

        ipcRenderer.on('agent-controller-exit', (_, code) => {
            onExit(code)
        })

    },
    cancelPython: () => {
        ipcRenderer.send('cancel-agent-controller')
    },
    sendPythonInput: (data: any) => {
        ipcRenderer.send('agent-controller-input', data)

    },
    onPythonInputEcho: (callback: (data: string) => void) => {
        ipcRenderer.on('agent-controller-input-echo', (_, data) => callback(data));
    },
    selectFolder: () => ipcRenderer.invoke('select-folder'),

    llmSetting: (param: string) => ipcRenderer.invoke("llm-Setting", param)
})
