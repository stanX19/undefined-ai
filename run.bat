@echo off
set "CONTAINER_ID="
for /f "usebackq tokens=*" %%i in (`docker compose ps -q backend`) do set "CONTAINER_ID=%%i"

if "%CONTAINER_ID%"=="" (
    echo No container found, running initial build...
    docker compose up --build --watch
) else (
    echo Container exists, starting with watch...
    docker compose up --watch
)