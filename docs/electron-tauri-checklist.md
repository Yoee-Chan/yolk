# Electron / Tauri 对照验收清单

> 基线来源：`electron/main/index.ts`、`electron/preload/index.ts`、`package.json`。
> 目标：Tauri 2 行为与 Electron 一致，React/Python 不变。

- [ ] 应用启动，主窗口 1200x800、标题 Yolk助手、图标正确
- [ ] 开发模式加载 React，生产模式加载构建产物
- [ ] 应用菜单已禁用
- [ ] 普通 Agent 请求（含 history/taskId/authToken/apiUrl）
- [ ] Agent 流式输出与 Electron 一致
- [ ] Agent stderr 错误透出
- [ ] Agent 退出码通知
- [ ] 中断 Agent
- [ ] 人工输入转发 + input-echo
- [ ] 中文 UTF-8 输入输出
- [ ] 选择文件夹
- [ ] `llm-Setting` 调用 agent_tools
- [ ] 微信文章读取/保存，重启后可恢复
- [ ] DOCX 导入标题/正文/大纲/Markdown 一致
- [ ] 文章批注改写返回 replacement
- [ ] Jira OAuth 登录、取消、重复登录、token 保存
- [ ] Windows 安装包安装/启动/卸载正常
- [ ] 干净 Windows 机器无需 Node/Python 即可运行
