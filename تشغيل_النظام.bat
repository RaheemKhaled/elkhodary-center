@echo off
chcp 65001 > nul
title نظام إدارة مركز صيانة السيارات
echo ========================================================
echo   نظام إدارة مركز صيانة السيارات وضبط الزوايا والعفشة
echo   جاري تشغيل الخادم المحلي وفتح التطبيق...
echo ========================================================

REM فحص توفر بايثون لتشغيل السيرفر المحلي
py --version >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [OK] تم العثور على Python، جاري تشغيل الخادم على المنفذ 8080...
    start "" http://localhost:8080
    py -m http.server 8080
) else (
    python --version >nul 2>&1
    if %ERRORLEVEL% equ 0 (
        echo [OK] تم العثور على Python، جاري تشغيل الخادم على المنفذ 8080...
        start "" http://localhost:8080
        python -m http.server 8080
    ) else (
        echo [!] لم يتم العثور على Python، جاري فتح الملف مباشرة في المتصفح...
        start "" "%~dp0index.html"
    )
)
pause
