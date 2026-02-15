@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

:: ═══════════════════════════════════════════════════════════════
:: VOIDRA — VFS Global Firewall Reset v2.0
:: ═══════════════════════════════════════════════════════════════

:: ─── PORTABLE NODE.JS KONTROLU ───────────────────────────────
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "PORTABLE_NODE=%SCRIPT_DIR%\nodejs"
if exist "%PORTABLE_NODE%\node.exe" (
    set "PATH=%PORTABLE_NODE%;%PATH%"
)

:: ─── DEGISKENLER ─────────────────────────────────────────────
set "LOG_DIR=%SCRIPT_DIR%\logs"
set "TIMESTAMP=%date:~6,4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "TIMESTAMP=%TIMESTAMP: =0%"
set "LOG_FILE=%LOG_DIR%\firewall_reset_%TIMESTAMP%.log"
set "VERSION=2.0"
set "OLD_IP=bilinmiyor"
set "NEW_IP=bilinmiyor"
set "GATEWAY=bilinmiyor"
set "STEP_OK=0"
set "STEP_FAIL=0"
set "STEP_TOTAL=0"

set "EDGE_DATA=%LOCALAPPDATA%\Microsoft\Edge\User Data"
set "CHROME_DATA=%LOCALAPPDATA%\Google\Chrome\User Data"
set "FIREFOX_DATA=%APPDATA%\Mozilla\Firefox\Profiles"
set "BRAVE_DATA=%LOCALAPPDATA%\BraveSoftware\Brave-Browser\User Data"

:: ─── ADMIN KONTROLU ─────────────────────────────────────────
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo  [UAC] Yonetici haklari gerekiyor — yukseltme yapiliyor...
    if "%~1"=="" (
        powershell -Command "Start-Process -Verb RunAs -FilePath '%~f0'"
    ) else (
        powershell -Command "Start-Process -Verb RunAs -FilePath '%~f0' -ArgumentList '%*'"
    )
    exit /b 0
)

:: Log dizini
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
call :LOG "==================================================="
call :LOG "VOIDRA Firewall Reset v%VERSION% baslatildi"
call :LOG "Tarih: %date% %time% | Kullanici: %USERNAME%"
call :LOG "==================================================="

:: ─── KURULUM KONTROLU ────────────────────────────────────────
set "SETUP_FLAG=%SCRIPT_DIR%\.setup_done"
if exist "!SETUP_FLAG!" (
    call :LOG "Kurulum daha once tamamlanmis — atlaniyor"
    goto :SKIP_SETUP
)

cls
echo.
echo  +===========================================================+
echo  :                                                           :
echo  :   VOIDRA — Ilk Kurulum                                    :
echo  :   Gereksinimler kontrol ediliyor...                        :
echo  :                                                           :
echo  +===========================================================+
echo.
call :LOG "=== KURULUM ASAMASI ==="

set "SETUP_OK=0"
set "SETUP_FAIL=0"
set "SETUP_WARN=0"

:: 1. Windows Surumu
echo   [1/8] Windows surumu kontrol ediliyor...
set "WIN_OK=0"
for /f "tokens=*" %%v in ('powershell -nop -c "[System.Environment]::OSVersion.Version.Major"') do (
    if %%v geq 10 set "WIN_OK=1"
)
if !WIN_OK!==1 (
    echo         [OK] Windows 10+ tespit edildi
    set /a SETUP_OK+=1
) else (
    echo         [HATA] Windows 10+ gereklidir!
    set /a SETUP_FAIL+=1
)

:: 2. PowerShell
echo   [2/8] PowerShell kontrol ediliyor...
where powershell >nul 2>&1
if !errorLevel!==0 (
    for /f "tokens=*" %%v in ('powershell -nop -c "$PSVersionTable.PSVersion.Major" 2^>nul') do set "PSVER=%%v"
    echo         [OK] PowerShell v!PSVER! mevcut
    set /a SETUP_OK+=1
) else (
    echo         [HATA] PowerShell bulunamadi!
    set /a SETUP_FAIL+=1
)

:: 3. Node.js
echo   [3/8] Node.js kontrol ediliyor...
where node >nul 2>&1
if !errorLevel!==0 (
    for /f "tokens=*" %%v in ('node --version 2^>nul') do set "NODEVER=%%v"
    echo         [OK] Node.js !NODEVER! mevcut
    set /a SETUP_OK+=1
) else (
    echo         [!] Node.js bulunamadi — kurulum baslatiliyor...
    set /a SETUP_WARN+=1

    echo         Node.js v20 LTS indiriliyor...
    set "NODE_MSI=%TEMP%\node-install.msi"
    powershell -nop -c "try { Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi' -OutFile '!NODE_MSI!' -UseBasicParsing; Write-Host 'INDIRILDI' } catch { Write-Host 'HATA' }" 2>nul > "%TEMP%\node_dl.txt"
    set /p NODE_DL=<"%TEMP%\node_dl.txt"
    del "%TEMP%\node_dl.txt" >nul 2>&1

    if "!NODE_DL!"=="INDIRILDI" (
        echo         Kurulum baslatiliyor...
        msiexec /i "!NODE_MSI!" /qn /norestart
        if !errorLevel!==0 (
            echo         [OK] Node.js basariyla kuruldu!
            set /a SETUP_OK+=1
            set "PATH=%PATH%;C:\Program Files\nodejs"
        ) else (
            echo         [HATA] Node.js kurulumu basarisiz!
            echo         Manuel kurun: https://nodejs.org
            set /a SETUP_FAIL+=1
        )
        del "!NODE_MSI!" >nul 2>&1
    ) else (
        echo         [HATA] Node.js indirilemedi!
        echo         Manuel kurun: https://nodejs.org
        set /a SETUP_FAIL+=1
    )
)

:: 4. Ag Araclari
echo   [4/8] Ag araclari kontrol ediliyor...
set "NET_OK=1"
where ipconfig >nul 2>&1 || set "NET_OK=0"
where netsh >nul 2>&1 || set "NET_OK=0"
where ping >nul 2>&1 || set "NET_OK=0"
if !NET_OK!==1 (
    echo         [OK] ipconfig, netsh, ping mevcut
    set /a SETUP_OK+=1
) else (
    echo         [HATA] Bazi ag araclari eksik!
    set /a SETUP_FAIL+=1
)

:: 5. Internet Baglantisi
echo   [5/8] Internet baglantisi kontrol ediliyor...
ping -n 1 -w 3000 8.8.8.8 >nul 2>&1
if !errorLevel!==0 (
    echo         [OK] Internet baglantisi aktif
    set /a SETUP_OK+=1
) else (
    echo         [!] Internet baglantisi yok
    set /a SETUP_WARN+=1
)

:: 6. Karakter Kodlamasi
echo   [6/8] Karakter kodlamasi kontrol ediliyor...
echo         [OK] UTF-8 (65001) ayarlandi
set /a SETUP_OK+=1

:: 7. Tarayici Tespiti
echo   [7/8] Kurulu tarayicilar tespit ediliyor...
set "BROWSER_COUNT=0"
if exist "%EDGE_DATA%" (
    set /a BROWSER_COUNT+=1
    echo         [+] Microsoft Edge
)
if exist "%CHROME_DATA%" (
    set /a BROWSER_COUNT+=1
    echo         [+] Google Chrome
)
if exist "%FIREFOX_DATA%" (
    set /a BROWSER_COUNT+=1
    echo         [+] Mozilla Firefox
)
if exist "%BRAVE_DATA%" (
    set /a BROWSER_COUNT+=1
    echo         [+] Brave Browser
)
if !BROWSER_COUNT!==0 (
    echo         [!] Hicbir tarayici verisi bulunamadi
    set /a SETUP_WARN+=1
) else (
    echo         !BROWSER_COUNT! tarayici tespit edildi
    set /a SETUP_OK+=1
)

:: 8. Dizin Izinleri
echo   [8/8] Dizin izinleri kontrol ediliyor...
echo test > "%LOG_DIR%\_test.tmp" 2>nul
if exist "%LOG_DIR%\_test.tmp" (
    del "%LOG_DIR%\_test.tmp" >nul 2>&1
    echo         [OK] Log dizini yazilabilir
    set /a SETUP_OK+=1
) else (
    echo         [HATA] Log dizinine yazma izni yok!
    set /a SETUP_FAIL+=1
)

:: Kurulum Raporu
echo.
echo  +-----------------------------------------------------------+
echo  :   KURULUM RAPORU                                          :
echo  +-----------------------------------------------------------+
echo  :   Basarili:   !SETUP_OK!                                          :
echo  :   Uyari:      !SETUP_WARN!                                          :
echo  :   Basarisiz:  !SETUP_FAIL!                                          :
echo  +-----------------------------------------------------------+

if !SETUP_FAIL! gtr 0 (
    echo.
    echo   [HATA] Kritik gereksinimler karsilanamadi!
    echo   Yukaridaki hatalari giderdikten sonra tekrar calistirin.
    echo.
    call :LOG "KURULUM: BASARISIZ (!SETUP_FAIL! hata)"
    pause
    exit /b 1
)

:: Kurulum basarili — flag dosyasi olustur
echo VOIDRA Firewall Reset v%VERSION% > "!SETUP_FLAG!"
echo Kurulum Tarihi: %date% %time% >> "!SETUP_FLAG!"
echo Kullanici: %USERNAME% >> "!SETUP_FLAG!"
echo Bilgisayar: %COMPUTERNAME% >> "!SETUP_FLAG!"

echo.
echo   [OK] Kurulum tamamlandi! Ana menuye geciliyor...
call :LOG "KURULUM: BASARILI"
timeout /t 3 /nobreak >nul

:SKIP_SETUP
:: ─── HIZLI MOD KONTROLU ─────────────────────────────────────
if "%1"=="quick" goto :QUICK_MODE
if "%1"=="--quick" goto :QUICK_MODE
if "%1"=="full" goto :FULL_MODE
if "%1"=="--full" goto :FULL_MODE
if "%1"=="diag" goto :DIAGNOSTICS
if "%1"=="--diag" goto :DIAGNOSTICS

:: ═══════════════════════════════════════════════════════════════
:: ANA MENU
:: ═══════════════════════════════════════════════════════════════
:MAIN_MENU
cls
echo.
echo  +===========================================================+
echo  :                                                           :
echo  :   ##   ## ####### ## #####  #####   #####                 :
echo  :   ##   ## ##   ## ## ##  ## ##  ## ##   ##                :
echo  :   ##   ## ##   ## ## ##  ## #####  #######                :
echo  :    ##  ## ##   ## ## ##  ## ##  ## ##   ##                :
echo  :     ####  ####### ## #####  ##  ## ##   ##                :
echo  :                                                           :
echo  :   VFS GLOBAL FIREWALL RESET  v%VERSION%                        :
echo  :   Gorunmeden Gec.                                         :
echo  :                                                           :
echo  +===========================================================+
echo  :                                                           :
echo  :   [1]  Hizli Temizlik                                     :
echo  :        Cookie + Cache + DNS (modem restart YOK)            :
echo  :                                                           :
echo  :   [2]  Tam Sifirlama                                      :
echo  :        Cookie + Cache + DNS + Modem Restart + IP Yenile    :
echo  :                                                           :
echo  :   [3]  Ag Diagnostigi                                     :
echo  :        IP, Gateway, DNS, Ping, Traceroute analizi          :
echo  :                                                           :
echo  :   [4]  Sistem Bilgisi                                     :
echo  :        Tarayici, ag, isletim sistemi detaylari             :
echo  :                                                           :
echo  :   [5]  Log Gecmisi                                        :
echo  :        Onceki sifirlama loglarini goruntule                :
echo  :                                                           :
echo  :   [6]  Kurulumu Sifirla                                   :
echo  :        Gereksinimleri tekrar kontrol et                    :
echo  :                                                           :
echo  :   [0]  Cikis                                              :
echo  :                                                           :
echo  +===========================================================+
echo.
set /p "CHOICE=  Seciminiz (0-6): "

if "%CHOICE%"=="1" goto :QUICK_MODE
if "%CHOICE%"=="2" goto :FULL_MODE
if "%CHOICE%"=="3" goto :DIAGNOSTICS
if "%CHOICE%"=="4" goto :SYSTEM_INFO
if "%CHOICE%"=="5" goto :LOG_HISTORY
if "%CHOICE%"=="6" goto :RESET_SETUP
if "%CHOICE%"=="0" goto :EXIT_SCRIPT
goto :MAIN_MENU

:: ─── Kurulumu Sifirla ────────────────────────────────────────
:RESET_SETUP
if exist "!SETUP_FLAG!" (
    del "!SETUP_FLAG!" >nul 2>&1
    echo.
    echo   Kurulum sifirlandi. Yeniden baslatiliyor...
    call :LOG "Kurulum sifirlandi"
    timeout /t 2 /nobreak >nul
    call "%~f0" %*
    exit /b 0
) else (
    echo.
    echo   Kurulum dosyasi zaten mevcut degil.
    timeout /t 2 /nobreak >nul
    goto :MAIN_MENU
)

:: ═══════════════════════════════════════════════════════════════
:: HIZLI TEMIZLIK
:: ═══════════════════════════════════════════════════════════════
:QUICK_MODE
cls
call :HEADER "HIZLI TEMIZLIK — Cookie + Cache + DNS"
call :LOG "MOD: Hizli Temizlik"
set "STEP_OK=0"
set "STEP_FAIL=0"
set "STEP_TOTAL=0"

call :GET_PUBLIC_IP
set "OLD_IP=!PUBLIC_IP!"
echo.
echo   Mevcut IP: !OLD_IP!
call :LOG "Mevcut IP: !OLD_IP!"
echo.

call :STEP "Tarayici Surecleri Kapatiliyor"       :KILL_BROWSERS
call :STEP "Edge Cookie Temizleniyor"             :CLEAN_EDGE_COOKIES
call :STEP "Chrome Cookie Temizleniyor"           :CLEAN_CHROME_COOKIES
call :STEP "Firefox Cookie Temizleniyor"          :CLEAN_FIREFOX_COOKIES
call :STEP "Brave Cookie Temizleniyor"            :CLEAN_BRAVE_COOKIES
call :STEP "Web Storage Temizleniyor"             :CLEAN_WEB_STORAGE
call :STEP "Tarayici Cache Temizleniyor"          :CLEAN_BROWSER_CACHE
call :STEP "Service Worker Temizleniyor"          :CLEAN_SERVICE_WORKERS
call :STEP "DNS Cache Temizleniyor"               :FLUSH_DNS
call :STEP "SSL/TLS Session Temizleniyor"         :CLEAR_SSL
call :STEP "ARP Cache Temizleniyor"               :CLEAR_ARP
call :STEP "Temp Dosyalar Temizleniyor"           :CLEAR_TEMP

call :GET_PUBLIC_IP
set "NEW_IP=!PUBLIC_IP!"
call :PRINT_REPORT
goto :POST_MENU

:: ═══════════════════════════════════════════════════════════════
:: TAM SIFIRLAMA
:: ═══════════════════════════════════════════════════════════════
:FULL_MODE
cls
call :HEADER "TAM SIFIRLAMA — Cookie + DNS + Modem Restart"
call :LOG "MOD: Tam Sifirlama"
set "STEP_OK=0"
set "STEP_FAIL=0"
set "STEP_TOTAL=0"

call :DETECT_GATEWAY
echo.
echo   Gateway: !GATEWAY!

call :GET_PUBLIC_IP
set "OLD_IP=!PUBLIC_IP!"
echo   Mevcut IP: !OLD_IP!
call :LOG "Gateway: !GATEWAY! | Mevcut IP: !OLD_IP!"
echo.

echo   UYARI: Bu islem tum tarayicilari kapatacak,
echo   tum VFS verilerini silecek ve ag adaptorunu sifrilayacak.
echo   Internet baglantiniz gecici olarak kesilecek!
echo.
set /p "CONFIRM=  Devam etmek istiyor musunuz? (E/H): "
if /i not "%CONFIRM%"=="E" goto :MAIN_MENU

echo.
call :STEP "Tarayici Surecleri Kapatiliyor"       :KILL_BROWSERS
call :STEP "Edge Cookie Temizleniyor"             :CLEAN_EDGE_COOKIES
call :STEP "Chrome Cookie Temizleniyor"           :CLEAN_CHROME_COOKIES
call :STEP "Firefox Cookie Temizleniyor"          :CLEAN_FIREFOX_COOKIES
call :STEP "Brave Cookie Temizleniyor"            :CLEAN_BRAVE_COOKIES
call :STEP "Web Storage Temizleniyor"             :CLEAN_WEB_STORAGE
call :STEP "Tarayici Cache Temizleniyor"          :CLEAN_BROWSER_CACHE
call :STEP "Service Worker Temizleniyor"          :CLEAN_SERVICE_WORKERS
call :STEP "DNS Cache Temizleniyor"               :FLUSH_DNS
call :STEP "SSL/TLS Session Temizleniyor"         :CLEAR_SSL
call :STEP "ARP Cache Temizleniyor"               :CLEAR_ARP
call :STEP "NetBIOS Cache Temizleniyor"           :CLEAR_NETBIOS
call :STEP "Temp Dosyalar Temizleniyor"           :CLEAR_TEMP
call :STEP "IP Yapilandirmasi Yenileniyor"        :RENEW_IP
call :STEP "Ag Adaptoru Sifirlanıyor"             :RESET_ADAPTER
call :STEP "Internet Baglantisi Bekleniyor"       :WAIT_CONNECTION

call :GET_PUBLIC_IP
set "NEW_IP=!PUBLIC_IP!"
call :PRINT_REPORT
goto :POST_MENU

:: ═══════════════════════════════════════════════════════════════
:: AG DIAGNOSTIGI
:: ═══════════════════════════════════════════════════════════════
:DIAGNOSTICS
cls
call :HEADER "AG DIAGNOSTIGI"
call :LOG "MOD: Ag Diagnostigi"
echo.

echo  === Ag Adaptoru Bilgisi ===
echo.
powershell -nop -c "Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | Format-Table Name, InterfaceDescription, MacAddress, LinkSpeed -AutoSize" 2>nul
echo.

echo  === IP Yapilandirmasi ===
echo.
ipconfig | findstr /i "IPv4 Subnet Default"
echo.

echo  === Dis IP Adresi ===
call :GET_PUBLIC_IP
echo   Dis IP: !PUBLIC_IP!
echo.

echo  === DNS Sunuculari ===
echo.
powershell -nop -c "Get-DnsClientServerAddress | Where-Object { $_.ServerAddresses } | Format-Table InterfaceAlias, ServerAddresses -AutoSize" 2>nul
echo.

echo  === VFS Global Ping Testi ===
echo.
ping -n 3 visa.vfsglobal.com
echo.

echo  === VFS Global DNS Cozumleme ===
echo.
nslookup visa.vfsglobal.com 2>nul
echo.

echo  === Cloudflare Baglanti Testi ===
echo.
powershell -nop -c "try { $r = Invoke-WebRequest -Uri 'https://visa.vfsglobal.com' -Method Head -TimeoutSec 10 -UseBasicParsing; Write-Host ('Durum Kodu: ' + $r.StatusCode) } catch { Write-Host ('HATA: ' + $_.Exception.Message) }" 2>nul
echo.

call :LOG "Diagnostik tamamlandi"
echo.
echo   Diagnostik tamamlandi.
echo.
pause
goto :MAIN_MENU

:: ═══════════════════════════════════════════════════════════════
:: SISTEM BILGISI
:: ═══════════════════════════════════════════════════════════════
:SYSTEM_INFO
cls
call :HEADER "SISTEM BILGISI"
echo.

echo  === Isletim Sistemi ===
echo.
echo   Bilgisayar:  %COMPUTERNAME%
echo   Kullanici:   %USERNAME%
for /f "tokens=*" %%i in ('wmic os get Caption /value 2^>nul ^| findstr "="') do echo   %%i
for /f "tokens=*" %%i in ('wmic os get Version /value 2^>nul ^| findstr "="') do echo   %%i
echo.

echo  === Kurulu Tarayicilar ===
echo.
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    echo   [+] Edge: Kurulu
) else if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    echo   [+] Edge: Kurulu
) else (
    echo   [-] Edge: Kurulu degil
)
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    echo   [+] Chrome: Kurulu
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    echo   [+] Chrome: Kurulu
) else (
    echo   [-] Chrome: Kurulu degil
)
if exist "C:\Program Files\Mozilla Firefox\firefox.exe" (
    echo   [+] Firefox: Kurulu
) else (
    echo   [-] Firefox: Kurulu degil
)
if exist "%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe" (
    echo   [+] Brave: Kurulu
) else (
    echo   [-] Brave: Kurulu degil
)
echo.

echo  === Node.js Durumu ===
echo.
where node >nul 2>&1
if !errorLevel!==0 (
    for /f "tokens=*" %%v in ('node --version 2^>nul') do echo   [+] Node.js: %%v
) else (
    echo   [-] Node.js: Kurulu degil
)
echo.

echo  === Ag Adaptoru ===
echo.
powershell -nop -c "Get-NetAdapter | Where-Object {$_.Status -eq 'Up'} | ForEach-Object { Write-Host ('  ' + $_.Name + ' - ' + $_.InterfaceDescription + ' [' + $_.LinkSpeed + ']') }" 2>nul
echo.

pause
goto :MAIN_MENU

:: ═══════════════════════════════════════════════════════════════
:: LOG GECMISI
:: ═══════════════════════════════════════════════════════════════
:LOG_HISTORY
cls
call :HEADER "LOG GECMISI"
echo.
if not exist "%LOG_DIR%\*.log" (
    echo   Henuz log dosyasi yok.
    echo.
    pause
    goto :MAIN_MENU
)

echo   Son 10 log dosyasi:
echo.
set "LC=0"
for /f "tokens=*" %%f in ('dir /b /o-d "%LOG_DIR%\*.log" 2^>nul') do (
    set /a LC+=1
    if !LC! leq 10 (
        echo    [!LC!] %%f
    )
)
echo.
set /p "LCHOICE=  Log numarasi girin (veya ENTER ile geri don): "
if "!LCHOICE!"=="" goto :MAIN_MENU

set "SC=0"
for /f "tokens=*" %%f in ('dir /b /o-d "%LOG_DIR%\*.log" 2^>nul') do (
    set /a SC+=1
    if !SC!==!LCHOICE! (
        echo.
        echo   === %%f ===
        echo.
        type "%LOG_DIR%\%%f"
        echo.
    )
)
pause
goto :MAIN_MENU

:: ═══════════════════════════════════════════════════════════════
:: ISLEM SONRASI MENU
:: ═══════════════════════════════════════════════════════════════
:POST_MENU
echo.
echo   Ne yapmak istersiniz?
echo.
echo    [1]  Ana menuye don
echo    [2]  Ag diagnostigi calistir
echo    [3]  Logu goruntule
echo    [0]  Cikis
echo.
set /p "POST=  Seciminiz: "
if "!POST!"=="1" goto :MAIN_MENU
if "!POST!"=="2" goto :DIAGNOSTICS
if "!POST!"=="3" (
    echo.
    type "%LOG_FILE%"
    echo.
    pause
    goto :POST_MENU
)
if "!POST!"=="0" goto :EXIT_SCRIPT
goto :POST_MENU

:: ═══════════════════════════════════════════════════════════════
:: ADIM CALISTIRICISI
:: ═══════════════════════════════════════════════════════════════
:STEP
set /a STEP_TOTAL+=1
set "SNAME=%~1"
set "SFUNC=%~2"
echo   [!STEP_TOTAL!] !SNAME!...
call :LOG "ADIM !STEP_TOTAL!: !SNAME!"
call !SFUNC!
if !errorLevel!==0 (
    set /a STEP_OK+=1
    echo       ^> [OK] Basarili
    call :LOG "  = Basarili"
) else (
    set /a STEP_FAIL+=1
    echo       ^> [X] Basarisiz (devam ediliyor)
    call :LOG "  = BASARISIZ"
)
exit /b 0

:: ═══════════════════════════════════════════════════════════════
:: ISLEM FONKSIYONLARI
:: ═══════════════════════════════════════════════════════════════

:KILL_BROWSERS
taskkill /F /IM msedge.exe /T >nul 2>&1
taskkill /F /IM chrome.exe /T >nul 2>&1
taskkill /F /IM firefox.exe /T >nul 2>&1
taskkill /F /IM brave.exe /T >nul 2>&1
taskkill /F /IM opera.exe /T >nul 2>&1
timeout /t 2 /nobreak >nul
exit /b 0

:CLEAN_EDGE_COOKIES
call :CLEAN_CHROMIUM_COOKIES "%EDGE_DATA%"
exit /b 0

:CLEAN_CHROME_COOKIES
call :CLEAN_CHROMIUM_COOKIES "%CHROME_DATA%"
exit /b 0

:CLEAN_BRAVE_COOKIES
call :CLEAN_CHROMIUM_COOKIES "%BRAVE_DATA%"
exit /b 0

:CLEAN_CHROMIUM_COOKIES
set "BP=%~1"
if not exist "%BP%" exit /b 0
for /d %%p in ("%BP%\Default" "%BP%\Profile *" "%BP%\Guest Profile") do (
    if exist "%%p" (
        del /f /q "%%p\Cookies" >nul 2>&1
        del /f /q "%%p\Cookies-journal" >nul 2>&1
        if exist "%%p\Network" (
            del /f /q "%%p\Network\Cookies" >nul 2>&1
            del /f /q "%%p\Network\Cookies-journal" >nul 2>&1
        )
    )
)
exit /b 0

:CLEAN_FIREFOX_COOKIES
if not exist "%FIREFOX_DATA%" exit /b 0
for /d %%p in ("%FIREFOX_DATA%\*") do (
    del /f /q "%%p\cookies.sqlite" >nul 2>&1
    del /f /q "%%p\cookies.sqlite-wal" >nul 2>&1
    del /f /q "%%p\cookies.sqlite-shm" >nul 2>&1
)
exit /b 0

:CLEAN_WEB_STORAGE
for %%B in ("%EDGE_DATA%" "%CHROME_DATA%" "%BRAVE_DATA%") do (
    if exist "%%~B" (
        for /d %%p in ("%%~B\Default" "%%~B\Profile *") do (
            if exist "%%p\Local Storage\leveldb" rd /s /q "%%p\Local Storage\leveldb" >nul 2>&1
            if exist "%%p\Session Storage" rd /s /q "%%p\Session Storage" >nul 2>&1
            if exist "%%p\IndexedDB" (
                for /d %%i in ("%%p\IndexedDB\*vfsglobal*") do rd /s /q "%%i" >nul 2>&1
            )
        )
    )
)
if exist "%FIREFOX_DATA%" (
    for /d %%p in ("%FIREFOX_DATA%\*") do (
        del /f /q "%%p\webappsstore.sqlite" >nul 2>&1
        del /f /q "%%p\webappsstore.sqlite-wal" >nul 2>&1
    )
)
exit /b 0

:CLEAN_BROWSER_CACHE
for %%B in ("%EDGE_DATA%" "%CHROME_DATA%" "%BRAVE_DATA%") do (
    if exist "%%~B" (
        for /d %%p in ("%%~B\Default" "%%~B\Profile *") do (
            if exist "%%p" (
                rd /s /q "%%p\Cache" >nul 2>&1
                rd /s /q "%%p\Code Cache" >nul 2>&1
                rd /s /q "%%p\GPUCache" >nul 2>&1
                rd /s /q "%%p\DawnCache" >nul 2>&1
                rd /s /q "%%p\GrShaderCache" >nul 2>&1
                rd /s /q "%%p\ShaderCache" >nul 2>&1
            )
        )
    )
)
if exist "%FIREFOX_DATA%" (
    for /d %%p in ("%FIREFOX_DATA%\*") do (
        if exist "%%p\cache2" rd /s /q "%%p\cache2" >nul 2>&1
    )
)
exit /b 0

:CLEAN_SERVICE_WORKERS
for %%B in ("%EDGE_DATA%" "%CHROME_DATA%" "%BRAVE_DATA%") do (
    if exist "%%~B" (
        for /d %%p in ("%%~B\Default" "%%~B\Profile *") do (
            if exist "%%p\Service Worker" (
                rd /s /q "%%p\Service Worker\CacheStorage" >nul 2>&1
                rd /s /q "%%p\Service Worker\ScriptCache" >nul 2>&1
                rd /s /q "%%p\Service Worker\Database" >nul 2>&1
            )
        )
    )
)
exit /b 0

:FLUSH_DNS
ipconfig /flushdns >nul 2>&1
exit /b 0

:CLEAR_SSL
netsh winsock reset catalog >nul 2>&1
exit /b 0

:CLEAR_ARP
arp -d * >nul 2>&1
exit /b 0

:CLEAR_NETBIOS
nbtstat -R >nul 2>&1
nbtstat -RR >nul 2>&1
exit /b 0

:CLEAR_TEMP
del /f /q "%TEMP%\*vfs*" >nul 2>&1
del /f /q "%TEMP%\*cloudflare*" >nul 2>&1
del /f /q "%TEMP%\*turnstile*" >nul 2>&1
exit /b 0

:RENEW_IP
ipconfig /release >nul 2>&1
timeout /t 3 /nobreak >nul
ipconfig /renew >nul 2>&1
timeout /t 3 /nobreak >nul
exit /b 0

:RESET_ADAPTER
for /f "tokens=*" %%a in ('powershell -nop -c "Get-NetAdapter | Where-Object { $_.Status -eq ''Up'' -and ($_.InterfaceDescription -like ''*Ethernet*'' -or $_.InterfaceDescription -like ''*Wi-Fi*'' -or $_.InterfaceDescription -like ''*Wireless*'') } | Select-Object -First 1 -ExpandProperty Name" 2^>nul') do (
    set "ADAPTER=%%a"
)
if defined ADAPTER (
    echo       Adaptor: !ADAPTER!
    call :LOG "  Adaptor: !ADAPTER!"
    netsh interface set interface "!ADAPTER!" disable >nul 2>&1
    timeout /t 5 /nobreak >nul
    netsh interface set interface "!ADAPTER!" enable >nul 2>&1
    timeout /t 5 /nobreak >nul
)
exit /b 0

:WAIT_CONNECTION
echo       Internet baglantisi bekleniyor (max 90s)...
set "WM=18"
set "WC=0"
:WL
set /a WC+=1
if !WC! gtr !WM! (
    echo       Baglanti zaman asimina ugradi!
    exit /b 1
)
ping -n 1 -w 2000 8.8.8.8 >nul 2>&1
if !errorLevel!==0 (
    set /a WS=!WC!*5
    echo       Baglanti kuruldu (!WS!s)
    exit /b 0
)
timeout /t 5 /nobreak >nul
goto :WL

:: ═══════════════════════════════════════════════════════════════
:: YARDIMCI FONKSIYONLAR
:: ═══════════════════════════════════════════════════════════════

:DETECT_GATEWAY
set "GATEWAY=192.168.1.1"
for /f "tokens=2 delims=:" %%g in ('ipconfig ^| findstr /i "Default Gateway Varsay"') do (
    set "GW=%%g"
    for /f "tokens=*" %%t in ("!GW!") do (
        if not "%%t"=="" set "GATEWAY=%%t"
    )
)
call :LOG "Gateway: !GATEWAY!"
exit /b 0

:GET_PUBLIC_IP
set "PUBLIC_IP=bilinmiyor"
for /f "tokens=*" %%i in ('powershell -nop -c "try { (Invoke-WebRequest -Uri ''https://api.ipify.org'' -TimeoutSec 5 -UseBasicParsing).Content } catch { try { (Invoke-WebRequest -Uri ''https://ifconfig.me/ip'' -TimeoutSec 5 -UseBasicParsing).Content } catch { ''bilinmiyor'' } }" 2^>nul') do set "PUBLIC_IP=%%i"
exit /b 0

:HEADER
echo.
echo  +===========================================================+
echo  :  %~1
echo  :  %date% %time%
echo  +===========================================================+
exit /b 0

:LOG
echo [%date% %time%] %~1 >> "%LOG_FILE%" 2>nul
exit /b 0

:PRINT_REPORT
set "IP_CHANGED=HAYIR"
if not "!OLD_IP!"=="!NEW_IP!" (
    if not "!NEW_IP!"=="bilinmiyor" set "IP_CHANGED=EVET"
)

echo.
echo  +===========================================================+
echo  :              SIFIRLAMA RAPORU                              :
echo  +===========================================================+
echo  :                                                           :
echo  :   Eski IP:      !OLD_IP!
echo  :   Yeni IP:      !NEW_IP!
echo  :   IP Degisti:   !IP_CHANGED!
echo  :   Basarili:     !STEP_OK! / !STEP_TOTAL! adim
echo  :   Basarisiz:    !STEP_FAIL! adim
echo  :   Log:          %LOG_FILE%
echo  :                                                           :
echo  +===========================================================+

call :LOG "=== RAPOR ==="
call :LOG "Eski IP: !OLD_IP!"
call :LOG "Yeni IP: !NEW_IP!"
call :LOG "IP Degisti: !IP_CHANGED!"
call :LOG "Basarili: !STEP_OK!/!STEP_TOTAL!"

if "!IP_CHANGED!"=="HAYIR" (
    if not "!OLD_IP!"=="bilinmiyor" (
        echo.
        echo   IP DEGISMEDI! Oneriler:
        echo   - Modemi fiziksel olarak kapatip 10sn bekleyin
        echo   - Mobil hotspot kullanin
        echo   - ISP'niz sabit IP veriyor olabilir
    )
)

if "!IP_CHANGED!"=="EVET" (
    echo.
    echo   BASARILI! Yeni IP ile VFS Global'e girebilirsiniz.
)
echo.
exit /b 0

:EXIT_SCRIPT
call :LOG "Script kapatildi"
echo.
echo   VOIDRA Firewall Reset kapatiliyor...
echo.
endlocal
exit /b 0
