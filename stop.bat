@echo off
setlocal EnableExtensions

echo Stopping Nail Studio development processes...

for %%T in ("Nail Studio API" "Nail Studio Web" "Nail Studio AI") do (
  taskkill /FI "WINDOWTITLE eq %%~T" /T /F >nul 2>&1
)

echo Done. Any terminal windows that were started by start.bat have been closed.
endlocal
