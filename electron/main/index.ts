import {app, BrowserWindow, ipcMain, dialog, WebContents} from 'electron'
import path from 'path'
import {spawn, ChildProcessWithoutNullStreams} from 'child_process'
import {is} from '@electron-toolkit/utils'

let py: ChildProcessWithoutNullStreams | null = null
/** 最近一次发起 agent 渲染进程的 WebContents，用于复用子进程时仍能推送 stdout/stderr */
let streamSender: WebContents | null = null

function attachAgentChildListeners(child: ChildProcessWithoutNullStreams) {
    child.stdout.on('data', data => {
        streamSender?.send('agent-controller-stream', data.toString())
    })
    child.stderr.on('data', err => {
        streamSender?.send('agent-controller-error', err.toString())
    })
    child.on('error', () => {
        if (py !== child) {
            return
        }
        py = null
        streamSender?.send('agent-controller-exit', -1)
    })
    child.on('close', code => {
        if (py !== child) {
            return
        }
        streamSender?.send('agent-controller-exit', code)
        py = null
    })
}

function getStreamPythonCommand() {
    if (!app.isPackaged) {
        return {
            command: 'python',//agent-controller
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
            command: 'python',//python  agent-controller
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

    ipcMain.on('run-agent-controller', (event, args) => {
        streamSender = event.sender
        const interruptPrevious = Boolean(
            (args as {interruptPrevious?: unknown})?.interruptPrevious
        )

        if (interruptPrevious && py && !py.killed) {
            try {
                py.kill('SIGTERM')
            } catch {
                /* ignore */
            }
            py = null
        }

        const msg =
            typeof args?.msg === 'string' ? args.msg : typeof args === 'string' ? args : ''
        const history = Array.isArray((args as {history?: unknown})?.history)
            ? (args as {history: unknown[]}).history
            : []

        const needSpawn = !py || py.killed
        if (needSpawn) {
            const {command, args: baseArgs} = getStreamPythonCommand()
            const child = spawn(command, baseArgs, {
                cwd: process.cwd()
            })
            py = child
            attachAgentChildListeners(child)
        }

        const payload = JSON.stringify({event: 'run', msg, history}) + '\n'
        try {
            py!.stdin.write(payload)
        } catch {
            const {command, args: baseArgs} = getStreamPythonCommand()
            const child = spawn(command, baseArgs, {
                cwd: process.cwd()
            })
            py = child
            attachAgentChildListeners(child)
            py.stdin.write(payload)
        }
    })

    ipcMain.on('cancel-agent-controller', () => {
        if (!py) {
            return
        }
        try {
            py.kill('SIGTERM')
        } catch {
            /* ignore */
        }
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

    //call llm setting
    ipcMain.handle("llm-Setting", async (event, param: string) => {
        console.log("llm-Setting param:", param);
        return new Promise((resolve, reject) => {
            const {command, args} = getToolsPythonCommand()

            let output = ""
            let error = ""

            // 启动 Python 子进程
            const py = spawn(command, args, {cwd: process.cwd()})

            // 写入参数
            py.stdin.write(param + "\n")
            py.stdin.end()

            // 捕获标准输出
            py.stdout.on("data", (data) => {
                output += data.toString()
            })

            // 捕获错误输出
            py.stderr.on("data", (data) => {
                error += data.toString()
            })

            // 捕获 spawn 错误（比如 ENOENT）
            py.on("error", (err) => {
                reject(new Error("Failed to spawn Python: " + err.message))
            })

            // 子进程关闭时返回结果
            py.on("close", (code) => {
                if (code !== 0) {
                    reject(new Error(`Python exited with code ${code}\n${error}`))
                    return
                }

                try {
                    //  const parsed = JSON.parse(output)
                    resolve(output)
                } catch (e) {
                    reject(new Error("JSON parse error: " + (e as Error).message + "\nOutput: " + output))
                }
            })
        })
    })


})
