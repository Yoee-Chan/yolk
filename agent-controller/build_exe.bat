@echo off
REM 需要先安装 pyinstaller:  pip install pyinstaller
pyinstaller --onefile agent_tools.py
echo.
echo Build finished. Check the dist folder for agent_tools.exe
pause
