import {app, BrowserWindow, ipcMain} from 'electron'
import path from 'path'
import {spawn, ChildProcessWithoutNullStreams} from 'child_process'
import {is} from '@electron-toolkit/utils'

let py: ChildProcessWithoutNullStreams | null = null  //  正确类型

function getPythonCommand() {
    if (!app.isPackaged) {
        return {
            command: 'python',
            args: [path.join(process.cwd(), 'python/agent.py')]
        }
    } else {
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

    //  启动 Python
    ipcMain.on('run-python', (event, args) => {
        const {command, args: baseArgs} = getPythonCommand()

        py = spawn(command, [...baseArgs, JSON.stringify(args)], {
            cwd: process.cwd()
        })

        //send event to python init applicaiton.
        py.stdin.write(JSON.stringify({event:"init_app"})+'\n')

        py.stdout.on('data', data => {
            event.sender.send('python-stream', data.toString())
        })

        py.stderr.on('data', err => {
            event.sender.send('python-error', err.toString())
        })

        py.on('close', code => {
            event.sender.send('python-exit', code)
            py = null
        })
    })

    //  前端输入 → Python stdin
    ipcMain.on('python-input', (event, data) => {
        console.log('收到前端输入：', data)
        event.sender.send('python-input-echo', JSON.stringify(data));
        if (py && py.stdin.writable) {
            py.stdin.write(JSON.stringify(data) + '\n')
        }
    })
})
