# ---------------------------------------------------------------------------
#  Sofra setup — Windows PowerShell, iOS target
#
#  Usage — right-click "Run with PowerShell", or in a terminal here:
#      Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#      .\setup.ps1
#      .\setup.ps1 -Dest C:\Users\you\sofra -Sdk 57
#
#  WHY SDK 54 IS THE DEFAULT
#  Expo Go on the iOS App Store is frozen at SDK 54 — Expo's own SDK 56 changelog
#  says Expo Go for 56 "is not available on the Apple App Store" with no timeline,
#  and 57 is still waiting on review. So a project created on SDK 57 simply will not
#  open in the Expo Go you can install today.
#
#  SDK 54 therefore gets you running on your own iPhone tonight, for nothing.
#  Move to -Sdk 57 once you have the $99 Apple Developer membership and can build a
#  real development build with EAS.
# ---------------------------------------------------------------------------
param(
  [string]$Dest = "$HOME\sofra",
  [string]$Sdk  = "54"
)

$ErrorActionPreference = 'Stop'
$Src = $PSScriptRoot

function Fail($m) { Write-Host "`n  x  $m`n" -ForegroundColor Red; exit 1 }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Fail "Node.js yok. https://nodejs.org adresinden LTS surumunu kurup tekrar deneyin."
}
Write-Host "  Node $(node --version)" -ForegroundColor DarkGray
if (Test-Path $Dest) { Fail "$Dest zaten var. Baska bir yol verin: .\setup.ps1 -Dest C:\yol" }

Write-Host "`n-> Expo projesi olusturuluyor (SDK $Sdk): $Dest" -ForegroundColor Cyan
npx create-expo-app@latest $Dest --template "default@sdk-$Sdk"
if ($LASTEXITCODE -ne 0) { Fail "create-expo-app basarisiz oldu." }

Set-Location $Dest

Write-Host "`n-> Sofra kaynak dosyalari kopyalaniyor" -ForegroundColor Cyan
Remove-Item -Recurse -Force "app"
Copy-Item -Recurse "$Src\app" "."
Copy-Item -Recurse "$Src\src" "."
Copy-Item -Recurse "$Src\tools" "."
New-Item -ItemType Directory -Force "assets" | Out-Null
Copy-Item -Recurse "$Src\assets\data" "assets\"

Write-Host "`n-> Iki ek paket (surumleri Expo belirliyor)" -ForegroundColor Cyan
npx expo install expo-localization "@react-native-async-storage/async-storage"

Write-Host "`n-> app.json duzenleniyor (dil + iOS ayarlari)" -ForegroundColor Cyan
node tools\patch-app-json.js

Write-Host "`n-> Butun paket surumleri SDK ile karsilastiriliyor" -ForegroundColor Cyan
npx expo install --fix

Write-Host "`n-> Motor testleri" -ForegroundColor Cyan
node src\__tests__\engine.test.js

Write-Host @"

  Bitti. Simdi:

      cd $Dest
      npx expo start

  iPhone'da:
    1. App Store'dan **Expo Go** kurun (ucretsiz, Apple Developer uyeligi gerekmez)
    2. Kamera ile terminaldeki QR kodu okutun
    3. Telefon ve bilgisayar ayni Wi-Fi agida olmali

  ONEMLI: app.json icindeki ios.bundleIdentifier degerini
  'com.CHANGEME.sofra' yerine kendi adinizla degistirin.

"@ -ForegroundColor Green
