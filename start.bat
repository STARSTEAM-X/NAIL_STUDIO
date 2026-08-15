@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo Stopping any existing Nail Studio development processes...
call "%ROOT%stop.bat"
timeout /t 1 /nobreak >nul

if not exist "node_modules\" (
  echo [ERROR] node_modules was not found. Run npm install first.
  exit /b 1
)

echo Starting Nail Studio API on port 4000...
start "Nail Studio API" /D "%ROOT%" cmd.exe /d /k "npm run dev:api"

echo Starting Nail Studio web app on port 5173...
start "Nail Studio Web" /D "%ROOT%" cmd.exe /d /k "npm run dev:web"

if exist "%ROOT%apps\ai\.venv\Scripts\python.exe" (
  echo Starting optional Nail Studio AI service on port 4100...
  start "Nail Studio AI" /D "%ROOT%apps\ai" cmd.exe /d /k ""%ROOT%apps\ai\.venv\Scripts\python.exe" -m uvicorn app.main:app --reload --port 4100"
) else (
  echo [INFO] AI service skipped. Create apps\ai\.venv and install apps\ai\requirements.txt to enable it.
)

echo.
echo Nail Studio processes started in separate terminal windows.
echo Web: http://localhost:5173
echo API: http://localhost:4000/api/v1/health
if exist "%ROOT%apps\ai\.venv\Scripts\python.exe" echo AI:  http://localhost:4100/health
echo Run stop.bat to stop the development processes.
endlocal
