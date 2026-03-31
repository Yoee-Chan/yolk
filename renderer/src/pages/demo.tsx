import React, {useEffect, useState} from 'react';

// declare global {
//     interface Window {
//         api: {
//             runPython: (
//                 args: any,
//                 onData: (data: string) => void,
//                 onError: (err: string) => void,
//                 onExit: (code: number) => void
//             ) => void;
//
//             sendPythonInput: (data: any) => void;
//
//             //  新增：监听 main.js 回传的输入回显
//             onPythonInputEcho?: (callback: (data: string) => void) => void;
//         };
//     }
// }

export default function App() {
    const [result, setResult] = useState('');

    //  弹窗状态
    const [modalVisible, setModalVisible] = useState(false);
    const [modalText, setModalText] = useState('');
    const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
    const [inputValue, setInputValue] = useState('');

    //  启动 Python
    const handleRunPython = () => {
        setResult('');

        window.api.runPython(
            {msg: 'Hello from React'},

            (data) => {
                try {
                    const msg = JSON.parse(data);

                    if (msg.type === 'stream') {
                        setResult(prev => prev + msg.text + '\n');
                    }

                    //  Python 请求前端输入
                    if (msg.type === 'need_input') {
                        setModalText(msg.text);
                        setCurrentRequestId(msg.id);
                        setInputValue('');
                        setModalVisible(true);
                    }
                } catch (e) {
                    setResult(prev => prev + data + '\n');
                }
            },

            (err) => {
                setResult(prev => prev + '\n[ERROR] ' + err);
            },

            (code) => {
                setResult(prev => prev + `\n[Python exited with code ${code}]`);
            }
        );
    };

    //  用户点击确认
    const handleConfirm = () => {
        if (currentRequestId) {
            window.api.sendPythonInput({
                id: currentRequestId,
                data: inputValue
            });
        }
        setModalVisible(false);
    };

    //  用户点击取消
    const handleCancel = () => {
        if (currentRequestId) {
            window.api.sendPythonInput({
                id: currentRequestId,
                data: null
            });
        }
        setModalVisible(false);
    };

    // 监听 main.js 回传的输入回显
    useEffect(() => {
        if (window.api.onPythonInputEcho) {
            window.api.onPythonInputEcho((data) => {
                setResult(prev => prev + `\n[前端输入回显] ${data}`);
            });
        }
    }, []);

    return (
        <div style={{padding: 20}}>
            <h1>Electron + React + TypeScript</h1>
            <button onClick={handleRunPython}>调用 Python</button>

            <pre style={{marginTop: 20, background: '#eee', padding: 10, whiteSpace: 'pre-wrap'}}>
        {result}
      </pre>

            {/*  自定义弹窗 */}
            {modalVisible && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <div style={{
                        background: '#fff',
                        padding: 20,
                        borderRadius: 8,
                        width: 300
                    }}>
                        <h3>需要确认</h3>
                        <p>{modalText}</p>

                        <input
                            style={{width: '100%', marginBottom: 10}}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="请输入内容"
                        />

                        <div style={{textAlign: 'right'}}>
                            <button onClick={handleCancel} style={{marginRight: 10}}>取消</button>
                            <button onClick={handleConfirm}>确认</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
