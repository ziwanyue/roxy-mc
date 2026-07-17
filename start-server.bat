@echo off
REM =====================================================
REM  Minecraft 原版服务器启动脚本 (26.2)
REM =====================================================

set "JAVA_PATH=C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot\bin\java.exe"
set "SERVER_DIR=%~dp0server"
set "SERVER_JAR=%SERVER_DIR%\server.jar"

cd /d "%SERVER_DIR%"

if not exist "%SERVER_JAR%" (
    echo [错误] 找不到 server.jar
    echo 请运行 setup-server.bat 下载
    pause
    exit /b 1
)

echo ═══════════════════════════════════════════
echo  Minecraft 26.2 服务器
echo  地址: localhost:25565
echo ═══════════════════════════════════════════
echo.

"%JAVA_PATH%" -Xms2G -Xmx4G -jar server.jar --nogui

pause
