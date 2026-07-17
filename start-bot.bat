@echo off
REM =====================================================
REM  洛琪希 Minecraft Agent 启动脚本
REM =====================================================

echo ═══════════════════════════════════════════
echo  🔮 洛琪希 Minecraft Agent
echo ═══════════════════════════════════════════
echo.

cd /d "%~dp0"

REM 检查 Ollama
curl -s http://localhost:11434/api/tags >nul 2>&1
if errorlevel 1 (
    echo [!] Ollama 未运行，正在启动...
    start /b ollama serve
    timeout /t 3 >nul
)

REM 检查 MC 服务器是否运行
curl -s http://localhost:25565 >nul 2>&1
if errorlevel 1 (
    echo [提示] 请先启动 Minecraft 服务器！
    echo [提示] 运行 start-server.bat
    pause
    exit /b 1
)

echo [✓] 所有服务就绪
echo.

node_modules\.bin\tsx src\index.ts

pause
