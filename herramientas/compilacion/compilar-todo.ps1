# Compila el instalador (NSIS) para x64 y ARM64. Ejecutar en PowerShell desde la raíz del repositorio.
# Requisitos únicos: rustup target add x86_64-pc-windows-msvc aarch64-pc-windows-msvc
#                    + componente "MSVC v143 C++ ARM64 build tools" en Visual Studio Installer
$ErrorActionPreference = "Stop"
if (-not (Test-Path "aplicacion/package.json")) { throw "Ejecuta este script desde la raíz del repositorio: .\herramientas/compilacion/compilar-todo.ps1" }

function Run([string]$what, [scriptblock]$cmd) {
    & $cmd
    if ($LASTEXITCODE -ne 0) { throw "Falló: $what (código $LASTEXITCODE)" }
}

Run "npm install" { npm --prefix aplicacion install }
Run "instalador x64" { npm --prefix aplicacion run tauri build -- --target x86_64-pc-windows-msvc --bundles nsis }
Run "instalador ARM64" { npm --prefix aplicacion run tauri build -- --target aarch64-pc-windows-msvc --bundles nsis }
Write-Host "Instaladores en aplicacion\src-tauri\target\<target>\release\bundle\nsis\"
