@echo off
REM 需要先安装 pyinstaller:  pip install pyinstaller
pyinstaller --onefile hello.py
echo.
echo Build finished. Check the dist folder for hello.exe
pause
