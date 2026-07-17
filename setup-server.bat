@echo off
REM =====================================================
REM  Minecraft Paper 服务器下载 & 安装脚本
REM  下载 Paper 1.21.x 服务端
REM =====================================================

set SERVER_DIR=%~dp0server

echo ═══════════════════════════════════════════
echo  Minecraft Paper 服务器安装器
echo ═══════════════════════════════════════════

if not exist "%SERVER_DIR%" mkdir "%SERVER_DIR%"
cd /d "%SERVER_DIR%"

echo.
echo [1/3] 下载 Paper API 信息...

REM Paper 1.21.4 最新版（稳定版）
set PAPER_VERSION=1.21.4
set PAPER_BUILD=latest

REM 使用 Paper API 下载
set PAPER_URL=https://api.papermc.io/v2/projects/paper/versions/%PAPER_VERSION%/builds/%PAPER_BUILD%/downloads/paper-%PAPER_VERSION%-%PAPER_BUILD%.jar

echo [2/3] 下载 Paper %PAPER_VERSION% 服务端...
echo URL: %PAPER_URL%

powershell -Command "& { $ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri '%PAPER_URL%' -OutFile 'paper.jar' }"

if not exist "paper.jar" (
    echo [错误] 下载失败，请检查网络连接
    pause
    exit /b 1
)

echo [3/3] 首次启动（生成 eula.txt 和世界文件）...
echo 启动后会报错，这是正常的，因为需要先同意 EULA
echo.

set "JAVA_PATH=C:\Program Files\Zulu\zulu-25\bin\java.exe"

"%JAVA_PATH%" -jar paper.jar --nogui 2>nul

REM 修改 eula.txt
if exist "eula.txt" (
    echo eula=true> eula.txt
    echo [✓] EULA 已同意
) else (
    echo [!] 未生成 eula.txt，请手动创建
    echo eula=true> eula.txt
)

REM 创建 server.properties
echo 配置 server.properties...
(
echo online-mode=false
echo port=25565
echo difficulty=normal
echo gamemode=survival
echo max-players=10
echo view-distance=10
echo simulation-distance=10
echo allow-flight=false
echo pvp=true
echo spawn-protection=0
echo motd=\u00A7b\u00A7lRoxy\u00A7r\u00A77's World
) > server.properties

echo.
echo ═══════════════════════════════════════════
echo  [✓] 安装完成！
echo  运行 start-server.bat 启动服务器
echo ═══════════════════════════════════════════
pause
