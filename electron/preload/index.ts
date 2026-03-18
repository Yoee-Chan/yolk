import {contextBridge, ipcRenderer} from 'electron'

contextBridge.exposeInMainWorld('api', {
    runPython: (
        args: any,
        onData: (data: string) => void,
        onError: (err: string) => void,
        onExit: (code: number) => void
    ) => {
        // 发送启动指令
        ipcRenderer.send('run-python', args)

        // 持续监听 Python stdout
        ipcRenderer.on('python-stream', (_, data) => {
            onData(data)
        })

        // 持续监听 Python stderr
        ipcRenderer.on('python-error', (_, err) => {
            onError(err)
        })

        // 监听 Python 退出
        ipcRenderer.on('python-exit', (_, code) => {
            onExit(code)
        })
    }
})
