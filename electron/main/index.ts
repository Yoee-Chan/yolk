import {app, BrowserWindow, ipcMain, dialog} from 'electron'
import path from 'path'
import {spawn, ChildProcessWithoutNullStreams} from 'child_process'
import {is} from '@electron-toolkit/utils'

let py: ChildProcessWithoutNullStreams | null = null  //  正确类型

function getStreamPythonCommand() {
    if (!app.isPackaged) {
        return {
            command: 'agent-controller',
            args: [path.join(process.cwd(), 'agent-controller/agent_stream.py')]
        }
    } else {
        return {
            command: path.join(process.resourcesPath, 'agent_stream.exe'),
            args: []
        }
    }
}

function getToolsPythonCommand() {
    if (!app.isPackaged) {
        return {
            command: 'agent-controller',
            args: [path.join(process.cwd(), 'agent-controller/agent_tools.py')]
        }
    } else {
        return {
            command: path.join(process.resourcesPath, 'agent_tools.exe'),
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

    //  启动流式的Python
    ipcMain.on('run-agent-controller', (event, args) => {
        const {command, args: baseArgs} = getStreamPythonCommand()

        py = spawn(command, baseArgs, {
            cwd: process.cwd()
        })

        py.stdin.write(JSON.stringify({event: "init_app"}) + '\n')

        py.stdout.on('data', data => {
            event.sender.send('agent-controller-stream', data.toString())
        })

        py.stderr.on('data', err => {
            event.sender.send('agent-controller-error', err.toString())
        })

        py.on('close', code => {
            event.sender.send('agent-controller-exit', code)
            py = null
        })
    })


    //  前端输入 → Python stdin
    ipcMain.on('agent-controller-input', (event, data) => {
        console.log('收到前端输入：', data)
        event.sender.send('agent-controller-input-echo', JSON.stringify(data));
        if (py && py.stdin.writable) {
            py.stdin.write(JSON.stringify(data) + '\n')
        }
    })
    //文件夹选择
    ipcMain.handle('select-folder', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory']
        })
        return result.filePaths?.[0] || null
    })

    //扫描子目录
    ipcMain.handle("scan-workspace", async (event, workspacePath: string) => {
        return new Promise((resolve, reject) => {
            const {command, args} = getToolsPythonCommand()

            const py = spawn(command, args, {
                cwd: process.cwd()
            })

            let output = ""
            let error = ""

            // 把参数写入 stdin
            py.stdin.write(JSON.stringify({
                cmd: "list_files",
                args: {path: workspacePath}
            }) + "\n")
            py.stdin.end()

            py.stdout.on("data", (data) => {
                output += data.toString()
            })

            py.stderr.on("data", (data) => {
                error += data.toString()
            })

            py.on("close", (code) => {
                if (code !== 0) {
                    reject(new Error("Python exited with code " + code + "\n" + error))
                    return
                }

                try {
                    const parsed = JSON.parse(output)
                    resolve(parsed.result)
                } catch (e) {
                    reject(new Error("JSON parse error: " + e))
                }
            })
        })
    })


})
