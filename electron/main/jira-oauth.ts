import http from 'http'
import {URL} from 'url'
import {BrowserWindow} from 'electron'

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000

/**
 * 打开 Atlassian 授权页，本地回调接收 authorization code。
 */
export function runAtlassianOAuthFlow(
    authorizeUrl: string,
    redirectUri: string
): Promise<string> {
    return new Promise((resolve, reject) => {
        let settled = false
        const redirect = new URL(redirectUri)
        const port = Number(redirect.port || 8765)
        const callbackPath = redirect.pathname || '/callback'

        const finish = (fn: () => void) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            try {
                server.close()
            } catch {
                /* ignore */
            }
            if (authWin && !authWin.isDestroyed()) {
                authWin.close()
            }
            fn()
        }

        const server = http.createServer((req, res) => {
            if (!req.url) return
            const incoming = new URL(req.url, `http://127.0.0.1:${port}`)
            if (incoming.pathname !== callbackPath) {
                res.writeHead(404)
                res.end()
                return
            }
            const code = incoming.searchParams.get('code')
            const error = incoming.searchParams.get('error')
            res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'})
            if (code) {
                res.end(
                    '<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:48px">' +
                        '<h2>✓ Jira 登录成功</h2><p>可以关闭此窗口并返回 Yolk。</p></body></html>'
                )
                finish(() => resolve(code))
            } else {
                res.end(
                    '<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:48px">' +
                        `<h2>登录失败</h2><p>${error || '未收到授权码'}</p></body></html>`
                )
                finish(() => reject(new Error(error || 'OAuth 未返回 code')))
            }
        })

        server.on('error', (err) => finish(() => reject(err)))

        const authWin = new BrowserWindow({
            width: 520,
            height: 720,
            title: '登录 Jira',
            autoHideMenuBar: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        })

        const handleNav = (targetUrl: string) => {
            if (!targetUrl.startsWith(`http://127.0.0.1:${port}`) &&
                !targetUrl.startsWith(`http://localhost:${port}`)) {
                return
            }
            const u = new URL(targetUrl)
            if (u.pathname !== callbackPath) return
            const code = u.searchParams.get('code')
            const error = u.searchParams.get('error')
            if (code) {
                finish(() => resolve(code))
            } else if (error) {
                finish(() => reject(new Error(error)))
            }
        }

        authWin.webContents.on('will-redirect', (_e, url) => handleNav(url))
        authWin.webContents.on('will-navigate', (_e, url) => handleNav(url))
        authWin.on('closed', () => {
            finish(() => reject(new Error('用户关闭了登录窗口')))
        })

        server.listen(port, '127.0.0.1', () => {
            authWin.loadURL(authorizeUrl).catch((err) => finish(() => reject(err)))
        })

        const timer = setTimeout(() => {
            finish(() => reject(new Error('Jira 登录超时，请重试')))
        }, LOGIN_TIMEOUT_MS)
    })
}
