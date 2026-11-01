import { electronApi } from './electronApi';
import { tauriApi, isTauri } from './tauriApi';
import type { DesktopApi } from './types';

function hasElectronApi() {
  return typeof window !== 'undefined' && !!(window as unknown as { api?: unknown }).api;
}

export const desktopApi: DesktopApi =
  typeof window !== 'undefined' && (isTauri() || !hasElectronApi()) ? tauriApi : electronApi;

export const activeDesktopBackend: 'tauri' | 'electron' =
  typeof window !== 'undefined' && (isTauri() || !hasElectronApi()) ? 'tauri' : 'electron';

if (typeof window !== 'undefined' && !(window as any).api) {
  const t: any = tauriApi as any;
  (window as any).api = {
    runPython: (a: any, d: any, e: any, x: any) => t.runAgent(a, d, e, x),
    cancelPython: () => t.cancelAgent(),
    sendPythonInput: (d: any) => t.sendAgentInput(d),
    onPythonInputEcho: (cb: any) => t.onAgentInputEcho?.(cb),
    selectFolder: () => t.selectFolder(),
    importWechatDocx: () => t.importWechatDocx(),
    loadWechatArticle: () => t.loadWechatArticle(),
    saveWechatArticle: (a: any) => t.saveWechatArticle(a),
    annotateWechatArticle: (r: any) => t.annotateWechatArticle(r),
    llmSetting: (p: any) => t.llmSetting(p),
    jiraOAuthLogin: (o: any) => t.jiraOAuthLogin(o),
    loadPipelineStore: () => t.loadPipelineStore(),
    savePipelineStore: (s: any) => t.savePipelineStore(s),
  };
}
