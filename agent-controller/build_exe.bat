@echo off
REM 需要先安装 pyinstaller:  pip install pyinstaller
REM 生成结果在 dist\agent_stream.exe 与 dist\agent_tools.exe，供 electron-builder extraResources 使用

py -3 -m PyInstaller --clean agent_stream.spec
py -3 -m PyInstaller --onefile --clean agent_tools.py

echo.
echo Build finished. Check the dist folder for agent_stream.exe and agent_tools.exe
pause
