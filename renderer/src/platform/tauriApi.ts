import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { convertDocxFile } from '../utils/docx/packageService';
import type { DesktopApi, AgentRunRequest } from './types';

function normalizeArgs(args: AgentRunRequest | string): AgentRunRequest {
  return typeof args === 'string' ? { msg: args } : args;
}

// Rust 端把子进程输出按行拆成事件（不含换行符），而前端解析器沿用 Electron 的
// 流式语义按 '\n' 切分，所以这里必须补回行尾换行符，否则永远解析不出完整行。
// 同时每轮开始前先解绑上一轮的监听器，避免重复消息累积。
let activeUnlistens: UnlistenFn[] = [];
function releaseListeners() {
  activeUnlistens.forEach((u) => u());
  activeUnlistens = [];
}

export const tauriApi: DesktopApi = {
  runAgent(args, onData, onError, onExit) {
    const payload = normalizeArgs(args);
    (async () => {
      releaseListeners();
      const unlistens: UnlistenFn[] = [];
      unlistens.push(await listen<string>('agent-controller-stream', (e) => onData(e.payload + '\n')));
      unlistens.push(await listen<string>('agent-controller-error', (e) => onError(e.payload + '\n')));
      unlistens.push(await listen<number | null>('agent-controller-exit', (e) => {
        onExit(e.payload);
        releaseListeners();
      }));
      activeUnlistens = unlistens;
      await invoke('run_agent_controller', { args: payload });
    })().catch((e) => onError(String(e) + '\n'));
  },
  cancelAgent() { invoke('cancel_agent_controller').catch(() => {}); },
  sendAgentInput(data) { invoke('agent_controller_input', { data }).catch(() => {}); },
  onAgentInputEcho(callback) {
    let unlisten: UnlistenFn | undefined;
    listen<string>('agent-controller-input-echo', (e) => callback(e.payload)).then((u) => { unlisten = u; });
    return () => unlisten?.();
  },
  selectFolder: () => invoke<string | null>('select_folder'),
  async importWechatDocx() {
    // 打包环境不保证有 Node.js，DOCX 解析改在前端完成：
    // Rust 只负责弹选择框并回传文件字节（base64）。
    const picked = await invoke<{ fileName: string; base64: string } | null>('pick_docx_file');
    if (!picked) return null;
    const bytes = Uint8Array.from(atob(picked.base64), (c) => c.charCodeAt(0));
    const converted = await convertDocxFile(new Blob([bytes]), picked.fileName);
    return {
      fileName: picked.fileName,
      markdown: converted.displayMarkdown,
      title: converted.title,
      outline: converted.outline,
    };
  },
  loadWechatArticle: () => invoke('load_wechat_article'),
  saveWechatArticle: (article) => invoke<boolean>('save_wechat_article', { article }),
  annotateWechatArticle: (request) => invoke('annotate_wechat_article', { request }),
  llmSetting: (param) => invoke<string>('llm_setting', { param }),
  jiraOAuthLogin: (options) => invoke('jira_oauth_login', { options: options ?? {} }),
  loadPipelineStore: () => invoke('load_pipeline_store'),
  savePipelineStore: (store) => invoke<string>('save_pipeline_store', { store }),
};

export const isTauri = () => '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
