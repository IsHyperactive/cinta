# Genera el .exe PORTABLE (un solo archivo, sin instalador). Ejecutar en PowerShell desde la raíz del repositorio.
# Uso:  .\herramientas/compilacion/compilar-portable.ps1            (x64 y ARM64)
#       .\herramientas/compilacion/compilar-portable.ps1 -Arch arm64
# Requisito previo (una vez):  rustup target add x86_64-pc-windows-msvc aarch64-pc-windows-msvc
param([ValidateSet("all", "x64", "arm64")] [string]$Arch = "all")

$ErrorActionPreference = "Stop"
if (-not (Test-Path "aplicacion/package.json")) { throw "Ejecuta este script desde la raíz del repositorio: .\herramientas/compilacion/compilar-portable.ps1" }
$targets = @{ "x64" = "x86_64-pc-windows-msvc"; "arm64" = "aarch64-pc-windows-msvc" }
$list = if ($Arch -eq "all") { @("x64", "arm64") } else { @($Arch) }

# PowerShell no se detiene solo cuando un programa externo falla: se comprueba el código de salida a mano.
function Run([string]$what, [scriptblock]$cmd) {
    & $cmd
    if ($LASTEXITCODE -ne 0) { throw "Falló: $what (código $LASTEXITCODE)" }
}

foreach ($tool in "node", "npm", "cargo", "rustup") {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Falta '$tool' en el PATH. Revisa los requisitos en README.md" }
}
$installed = rustup target list --installed
foreach ($a in $list) {
    if ($installed -notcontains $targets[$a]) {
        throw "Falta el target de Rust. Ejecuta una vez:  rustup target add $($targets[$a])"
    }
}

Run "npm install" { npm --prefix aplicacion install }
New-Item -ItemType Directory -Force -Path "portable" | Out-Null

foreach ($a in $list) {
    $t = $targets[$a]
    $exe = "aplicacion\src-tauri\target\$t\release\cinta.exe"
    if (Test-Path $exe) { Remove-Item $exe -Force }   # evita copiar un .exe viejo si la compilación falla
    Run "compilar $a" { npm --prefix aplicacion run tauri build -- --target $t --no-bundle }
    if (-not (Test-Path $exe)) { throw "No se generó $exe" }
    Copy-Item $exe "portable\Cinta-portable-$a.exe" -Force
    Write-Host "Listo: portable\Cinta-portable-$a.exe"
}
