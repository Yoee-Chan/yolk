import type { WechatArticleDraft, AnnotationRequest } from './types-article';

export interface AgentRunRequest {
  msg: string;
  history?: unknown[];
  authToken?: string;
  apiUrl?: string;
  logSessionId?: string;
  taskId?: string;
  isFirstMessage?: boolean;
  interruptPrevious?: boolean;
  /** 流水线「立即执行」：用户点击即视为确认，跳过规划确认弹窗 */
  skipPlan?: boolean;
  pipelineId?: string;
}

export interface DesktopApi {
  runAgent(args: AgentRunRequest | string, onData: (data: string) => void, onError: (err: string) => void, onExit: (code: number | null) => void): void;
  cancelAgent(): void;
  sendAgentInput(data: unknown): void;
  onAgentInputEcho?(callback: (data: string) => void): void | (() => void);
  selectFolder(): Promise<string | null>;
  importWechatDocx(): Promise<{ fileName: string; markdown: string; title: string; outline: Array<{ level: number; text: string }> } | null>;
  loadWechatArticle(): Promise<WechatArticleDraft | null>;
  saveWechatArticle(article: WechatArticleDraft): Promise<boolean>;
  annotateWechatArticle(request: AnnotationRequest): Promise<{ replacement: string }>;
  llmSetting(param: string): Promise<string>;
  jiraOAuthLogin(options?: { default_project_key?: string }): Promise<unknown>;
  loadPipelineStore(): Promise<unknown>;
  savePipelineStore(store: unknown): Promise<string>;
}
