@echo off
setlocal enabledelayedexpansion

set count=1

for %%f in (*.mp4) do (
    ren "%%f" "video!count!.mp4"
    set /a count+=1
)

echo Renombrado completo.
pause