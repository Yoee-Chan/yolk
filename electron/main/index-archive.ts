import {app, BrowserWindow, ipcMain} from 'electron'
import path from 'path'
import {is} from '@electron-toolkit/utils'
import {spawn} from 'child_process'

function getPythonCommand() {
    if (!app.isPackaged) {
        // dev 模式：直接运行 python agent_stream.py
        return {
            command: 'python',
            args: [path.join(process.cwd(), 'python/agent_stream.py')]
        }
    } else {
        // prod 模式：运行打包后的 agent.exe
        return {
            command: path.join(process.resourcesPath, 'agent.exe'),
            args: []
        }
    }
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js')
        }
    })

    if (is.dev) {
        win.loadURL(process.env['ELECTRON_RENDERER_URL']!)
        win.webContents.openDevTools()
    } else {
        win.loadFile(path.join(__dirname, '../../dist/renderer/index.html'))
    }
}

app.whenReady().then(() => {
    createWindow()

    ipcMain.on('run-python', (event, args) => {
        const {command, args: baseArgs} = getPythonCommand()

        const py = spawn(command, [...baseArgs, JSON.stringify(args)])

        py.stdout.on('data', data => {
            event.sender.send('python-result', data.toString())
        })

        py.stderr.on('data', err => {
            event.sender.send('python-error', err.toString())
        })
    })
})
