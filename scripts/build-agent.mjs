// Non-interactive agent exe build (replaces build_exe.bat which pauses).
// Usage: node scripts/build-agent.mjs [--stream-only | --tools-only]
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const agentDir = path.join(projectRoot, 'agent-controller');
const args = process.argv.slice(2);

function run(cmd, cmdArgs, cwd) {
  const r = spawnSync(cmd, cmdArgs, { cwd, stdio: 'inherit', shell: false });
  if (r.status !== 0) {
    console.error(`FAILED: ${cmd} ${cmdArgs.join(' ')}`);
    process.exit(r.status ?? 1);
  }
}

const targets = [];
if (args.includes('--stream-only')) targets.push('stream');
else if (args.includes('--tools-only')) targets.push('tools');
else targets.push('stream', 'tools');

const PY = process.env.PYTHON ?? 'py -3';
const [pyCmd, ...pyPrefix] = PY.split(' ');

if (targets.includes('stream')) {
  run(pyCmd, [...pyPrefix, '-m', 'PyInstaller', '--clean', '--noconfirm', 'agent_stream.spec'], agentDir);
}
if (targets.includes('tools')) {
  run(pyCmd, [...pyPrefix, '-m', 'PyInstaller', '--clean', '--noconfirm', '--onefile', 'agent_tools.py'], agentDir);
}

console.log('Agent exes built in agent-controller/dist');
