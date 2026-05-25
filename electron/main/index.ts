import {app, BrowserWindow, ipcMain, dialog, WebContents, session, Menu} from 'electron'
import path from 'path'
import {spawn, ChildProcessWithoutNullStreams} from 'child_process'
import {is} from '@electron-toolkit/utils'
import {runAtlassianOAuthFlow} from './jira-oauth'

let py: ChildProcessWithoutNullStreams | null = null
/** 最近一次发起 agent 渲染进程的 WebContents，用于复用子进程时仍能推送 stdout/stderr */
let streamSender: WebContents | null = null
let mainWindow: BrowserWindow | null = null

/** Windows 默认控制台编码为 GBK；子进程与前端统一使用 UTF-8，避免中文乱码 */
function getPythonChildEnv(): NodeJS.ProcessEnv {
    return {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
    }
}

function attachAgentChildListeners(child: ChildProcessWithoutNullStreams) {
    child.stdout.on('data', data => {
        streamSender?.send('agent-controller-stream', data.toString('utf8'))
    })
    child.stderr.on('data', err => {
        streamSender?.send('agent-controller-error', err.toString('utf8'))
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

function callAgentTools(param: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const {command, args} = getToolsPythonCommand()
        let output = ''
        let error = ''
        const child = spawn(command, args, {
            cwd: process.cwd(),
            env: getPythonChildEnv(),
        })
        child.stdin.write(Buffer.from(param + '\n', 'utf8'))
        child.stdin.end()
        child.stdout.on('data', (data) => {
            output += data.toString('utf8')
        })
        child.stderr.on('data', (data) => {
            error += data.toString('utf8')
        })
        child.on('error', (err) => {
            reject(new Error('Failed to spawn Python: ' + err.message))
        })
        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Python exited with code ${code}\n${error}`))
                return
            }
            resolve(output)
        })
    })
}

function parseAgentToolsOutput(output: string): unknown {
    const parsed = JSON.parse(output)
    if (parsed.type === 'command_error') {
        throw new Error(parsed.error || 'agent_tools 执行失败')
    }
    return parsed.result
}


/** 仅对 Yolk 渲染页注入 CSP；OAuth 弹窗等外部页面不能加，否则 Atlassian 登录页会白屏。 */
function isYolkRendererUrl(url: string): boolean {
    if (url.startsWith('file://')) {
        return true
    }
    try {
        const u = new URL(url)
        const host = u.hostname
        if (host !== 'localhost' && host !== '127.0.0.1') {
            return false
        }
        if (is.dev) {
            return true
        }
        return u.protocol === 'http:' || u.protocol === 'https:'
    } catch {
        return false
    }
}

function registerContentSecurityPolicy() {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        if (!isYolkRendererUrl(details.url)) {
            callback({responseHeaders: details.responseHeaders})
            return
        }

        const devConnect =
            "connect-src 'self' http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:*"
        const csp = [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self' data:",
            devConnect,
        ].join('; ')

        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [csp],
            },
        })
    })
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js')
        }
    })
    mainWindow = win

    if (is.dev) {
        win.loadURL(process.env['ELECTRON_RENDERER_URL']!)
        win.webContents.openDevTools()
    } else {
        win.loadFile(path.join(__dirname, '../../dist/renderer/index.html'))
    }
}

/** 启动 agent_stream 子进程（阻塞在 stdin 等首条 run）；应用启动时预热，首条消息可更快开始推理 */
function ensureAgentStreamProcess() {
    if (py && !py.killed) {
        return
    }
    const {command, args: baseArgs} = getStreamPythonCommand()
    const child = spawn(command, baseArgs, {
        cwd: process.cwd(),
        env: getPythonChildEnv(),
    })
    py = child
    attachAgentChildListeners(child)
    if (!streamSender && mainWindow && !mainWindow.isDestroyed()) {
        streamSender = mainWindow.webContents
    }
}

app.whenReady().then(() => {
    Menu.setApplicationMenu(null)
    registerContentSecurityPolicy()
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

        ensureAgentStreamProcess()

        const payload = JSON.stringify({event: 'run', msg, history}) + '\n'
        const payloadBuf = Buffer.from(payload, 'utf8')
        try {
            py!.stdin.write(payloadBuf)
        } catch {
            py = null
            ensureAgentStreamProcess()
            py!.stdin.write(payloadBuf)
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
            py.stdin.write(Buffer.from(JSON.stringify(data) + '\n', 'utf8'))
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
    ipcMain.handle("llm-Setting", async (_event, param: string) => {
        console.log("llm-Setting param:", param)
        return callAgentTools(param)
    })

    /** Jira OAuth：弹窗登录 → 换票 → 加密存本地 */
    ipcMain.handle(
        'jira-oauth-login',
        async (_event, options: {default_project_key?: string}) => {
            const defaultProjectKey = options?.default_project_key || ''
            const startOut = await callAgentTools(
                JSON.stringify({
                    SettingType: 'jira_connector',
                    cmd: 'oauth_start',
                    Param: {default_project_key: defaultProjectKey}
                })
            )
            const start = parseAgentToolsOutput(startOut) as {
                authorize_url: string
                state: string
                redirect_uri: string
            }
            const code = await runAtlassianOAuthFlow(
                start.authorize_url,
                start.redirect_uri
            )
            const finishOut = await callAgentTools(
                JSON.stringify({
                    SettingType: 'jira_connector',
                    cmd: 'oauth_finish',
                    Param: {
                        code,
                        state: start.state,
                        default_project_key: defaultProjectKey
                    }
                })
            )
            return parseAgentToolsOutput(finishOut)
        }
    )

    ensureAgentStreamProcess()
})
