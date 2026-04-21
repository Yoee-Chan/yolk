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
