import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  runPython: (args: any) => {
    return new Promise((resolve, reject) => {
      ipcRenderer.once('python-result', (_, data) => resolve(data))
      ipcRenderer.once('python-error', (_, err) => reject(err))
      ipcRenderer.send('run-python', args)
    })
  }
})
