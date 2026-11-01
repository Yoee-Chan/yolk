import type { DesktopApi } from './types';

function requireWindowApi(): Window['api'] {
  if (!window.api) throw new Error('Electron api unavailable');
  return window.api;
}

export const electronApi: DesktopApi = {
  runAgent: (args, onData, onError, onExit) => requireWindowApi().runPython(args, onData, onError, onExit),
  cancelAgent: () => requireWindowApi().cancelPython(),
  sendAgentInput: (data) => requireWindowApi().sendPythonInput(data),
  onAgentInputEcho: (cb) => requireWindowApi().onPythonInputEcho?.(cb),
  selectFolder: () => requireWindowApi().selectFolder(),
  importWechatDocx: () => requireWindowApi().importWechatDocx(),
  loadWechatArticle: () => requireWindowApi().loadWechatArticle(),
  saveWechatArticle: (a) => requireWindowApi().saveWechatArticle(a),
  annotateWechatArticle: (r) => requireWindowApi().annotateWechatArticle(r),
  llmSetting: (p) => requireWindowApi().llmSetting(p),
  jiraOAuthLogin: (o) => requireWindowApi().jiraOAuthLogin(o),
  async loadPipelineStore() {
    const api = requireWindowApi() as unknown as {
      loadPipelineStore?: () => Promise<unknown>;
    };
    if (!api.loadPipelineStore) throw new Error('当前运行时不支持流水线本地存储');
    return api.loadPipelineStore();
  },
  async savePipelineStore(store) {
    const api = requireWindowApi() as unknown as {
      savePipelineStore?: (value: unknown) => Promise<string>;
    };
    if (!api.savePipelineStore) throw new Error('当前运行时不支持流水线本地存储');
    return api.savePipelineStore(store);
  },
};
