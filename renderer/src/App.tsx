import React, { useState } from 'react';

declare global {
  interface Window {
    api: {
      runPython: (args: any) => Promise<string>;
    };
  }
}

export default function App() {
  const [result, setResult] = useState('');

  const handleRunPython = async () => {
    const res = await window.api.runPython({ msg: 'Hello from React' });
    setResult(res);
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Electron + React + TypeScript</h1>
      <button onClick={handleRunPython}>调用 Python</button>

      {result && (
        <pre style={{ marginTop: 20, background: '#eee', padding: 10 }}>
          {result}
        </pre>
      )}
    </div>
  );
}
