将 Windows 安装包放到此目录，并命名为 release.json 中的 fileName（默认 Yolk助手-Setup-1.0.0.exe，与 npm run build:installer 产物一致）。

打包步骤（在项目根目录 yolk）：
  1. cd agent-controller && build_exe.bat
  2. npm run build:installer
  3. 从 dist/ 目录复制 *.exe 到本目录

注意：*.exe 体积较大，已加入 .gitignore，部署时通过 scp / CI 上传到服务器即可。

上传完成后，请将 ../release.json 中的 "available" 改为 true，官网下载按钮才会启用。
