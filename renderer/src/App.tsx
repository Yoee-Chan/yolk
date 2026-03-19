import React, { useState } from 'react';

declare global {
  interface Window {
    api: {
      runPython: (
        args: any,
        onData: (data: string) => void,
        onError: (err: string) => void,
        onExit: (code: number) => void
      ) => void;
    };
  }
}

export default function App() {
  const [result, setResult] = useState('');

  const handleRunPython = () => {
    setResult(''); // 清空旧内容

    window.api.runPython(
      { msg: 'Hello from React' },

      // ⭐ Python stdout（流式输出）
      (data) => {
        setResult(prev => prev + data + '\n');
      },

      // ⭐ Python stderr（warning、错误）
      (err) => {
        setResult(prev => prev + '\n[ERROR] ' + err);
      },

      // ⭐ Python 进程结束
      (code) => {
        setResult(prev => prev + `\n[Python exited with code ${code}]`);
      }
    );
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Electron + React + TypeScript</h1>
      <button onClick={handleRunPython}>调用 Python</button>

      <pre style={{ marginTop: 20, background: '#eee', padding: 10, whiteSpace: 'pre-wrap' }}>
        {result}
      </pre>
    </div>
  );
}
