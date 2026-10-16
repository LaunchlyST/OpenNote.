@echo off
rem Starts the OpenNote sync watcher in the background.
rem
rem Used by the "OpenNote Sync Watcher" scheduled task, so no long command line
rem has to survive the Task Scheduler's argument parser. The watcher fast-forwards
rem main from GitHub when the working tree is clean, and never force-pushes,
rem resets or discards anything.
rem
rem node is launched directly rather than through npm: npm adds a wrapper
rem process that dies with this window, and the watcher already writes its own
rem log, so no shell redirection is needed either.

setlocal
cd /d "%~dp0.."

rem Only one watcher may run at a time - a second would race the first.
tasklist /FI "IMAGENAME eq node.exe" /V | find /I "sync.mjs" >nul
if not errorlevel 1 (
  echo A sync watcher is already running. Nothing to do.
  exit /b 0
)

start "OpenNote Sync Watcher" /min node scripts\sync.mjs watch
echo Started the OpenNote sync watcher.
exit /b 0