@echo off
chcp 65001 >nul
title تشغيل نظام المركز

:: 1. التحقق من السيرفر المحلي وتشغيله في الخلفية إذا لم يكن يعمل
netstat -ano | findstr :8080 >nul
if %ERRORLEVEL% neq 0 (
    start /b "" py -m http.server 8080 >nul 2>&1
    timeout /t 1 /nobreak >nul
)

:: 2. تشغيل التطبيق في وضع النافذة المكتبية المستقلة (Standalone App Window)
start "" msedge --app="http://localhost:8080/index.html" --window-size=1366,768

exit
