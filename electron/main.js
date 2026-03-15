const {app, BrowserWindow, ipcMain} = require('electron');
const path = require('path');
const {spawn} = require('child_process');

function createWindow() {
    const win = new BrowserWindow({
        width: 600,
        height: 400,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });

    win.loadFile('index.html');

    ipcMain.handle('call-python', async (event, payload) => {
        return new Promise((resolve, reject) => {
            const isDev = !app.isPackaged;

            let pyExe;

            if (isDev) {
                // 开发环境：使用 python/dist/hello.exe
                pyExe = path.join(__dirname, '..', 'python', 'dist', 'hello.exe');
            } else {
                // 生产环境：使用打包后的 hello.exe
                pyExe = path.join(process.resourcesPath, 'python', 'hello.exe');
            }

            console.log("Using Python exe:", pyExe);

            const py = spawn(pyExe);

            let output = '';

            py.stdout.on('data', (data) => {
                output += data.toString();
            });

            py.stderr.on('data', (data) => {
                console.error('Python error:', data.toString());
            });

            py.on('close', (code) => {
                try {
                    const res = JSON.parse(output || '{}');
                    resolve(res);
                } catch (e) {
                    reject(e);
                }
            });

            py.stdin.write(JSON.stringify(payload) + '\n');
            py.stdin.end();
        });
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
