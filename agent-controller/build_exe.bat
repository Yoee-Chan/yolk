@echo off
REM 需要先安装 pyinstaller:  pip install pyinstaller
pyinstaller --onefile agent.py
echo.
echo Build finished. Check the dist folder for agent.exe
pause
