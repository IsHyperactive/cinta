# Genera el instalador (NSIS) y el .exe portable FIRMADOS. Ejecutar en PowerShell desde la raíz del repositorio.
# Requisitos: un certificado de firma de código instalado en el almacén de Windows (ver documentacion/guias/SIGNING.md) y
#             Windows SDK (incluye signtool.exe) + los requisitos de documentacion/guias/COMPILAR.md.
# Uso:  .\herramientas/compilacion/compilar-firmado.ps1 -Thumbprint <HUELLA_SHA1_DEL_CERTIFICADO>          (x64 y ARM64)
#       .\herramientas/compilacion/compilar-firmado.ps1 -Thumbprint <HUELLA> -Arch arm64
#       $env:CINTA_CERT_THUMBPRINT = "<HUELLA>"; .\herramientas/compilacion/compilar-firmado.ps1             (la huella también puede venir del entorno)
# Nunca guardes el certificado (.pfx) ni su contraseña dentro del proyecto.
param(
    [string]$Thumbprint = $env:CINTA_CERT_THUMBPRINT,
    [ValidateSet("all", "x64", "arm64")] [string]$Arch = "all",
    [string]$TimestampUrl = "http://timestamp.digicert.com"
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path "aplicacion/package.json")) { throw "Ejecuta este script desde la raíz del repositorio: .\herramientas/compilacion/compilar-firmado.ps1" }
if (-not $Thumbprint) { throw "Falta la huella del certificado. Usa -Thumbprint o la variable CINTA_CERT_THUMBPRINT (ver documentacion/guias/SIGNING.md)." }
$Thumbprint = ($Thumbprint -replace "\s", "").ToUpper()

function Run([string]$what, [scriptblock]$cmd) {
    & $cmd
    if ($LASTEXITCODE -ne 0) { throw "Falló: $what (código $LASTEXITCODE)" }
}

foreach ($tool in "node", "npm", "cargo", "rustup") {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Falta '$tool' en el PATH. Revisa documentacion/guias/COMPILAR.md" }
}
$cert = Get-ChildItem Cert:\CurrentUser\My, Cert:\LocalMachine\My -ErrorAction SilentlyContinue | Where-Object { $_.Thumbprint -eq $Thumbprint } | Select-Object -First 1
if (-not $cert) { throw "No hay ningún certificado con esa huella en el almacén de Windows." }
if (-not $cert.HasPrivateKey) { throw "El certificado no tiene clave privada (no puede firmar)." }

# signtool.exe del Windows SDK (la versión más reciente instalada)
$signtool = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\signtool.exe" -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending | Select-Object -First 1
if (-not $signtool) { throw "No se encontró signtool.exe. Instala el Windows SDK (componente 'Signing Tools for Desktop Apps')." }

$targets = @{ "x64" = "x86_64-pc-windows-msvc"; "arm64" = "aarch64-pc-windows-msvc" }
$list = if ($Arch -eq "all") { @("x64", "arm64") } else { @($Arch) }
$installed = rustup target list --installed
foreach ($a in $list) {
    if ($installed -notcontains $targets[$a]) { throw "Falta el target de Rust. Ejecuta una vez:  rustup target add $($targets[$a])" }
}

# La huella se pasa a Tauri con un archivo de configuración temporal (así no queda escrita en tauri.conf.json)
$cfg = Join-Path (Get-Location) "aplicacion\src-tauri\tauri.sign.conf.json"
@{ bundle = @{ windows = @{ certificateThumbprint = $Thumbprint; digestAlgorithm = "sha256"; timestampUrl = $TimestampUrl } } } |
    ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $cfg

try {
    Run "npm install" { npm --prefix aplicacion install }
    New-Item -ItemType Directory -Force -Path "portable" | Out-Null
    foreach ($a in $list) {
        $t = $targets[$a]
        # 1) Instalador NSIS (Tauri firma el instalador y el .exe de la app con la huella indicada)
        Run "instalador $a" { npm --prefix aplicacion run tauri build -- --target $t --bundles nsis --config $cfg }
        # 2) .exe portable: se compila sin empaquetar y se firma con signtool
        $exe = "aplicacion\src-tauri\target\$t\release\cinta.exe"
        Run "portable $a" { npm --prefix aplicacion run tauri build -- --target $t --no-bundle }
        $out = "portable\Cinta-portable-$a.exe"
        Copy-Item $exe $out -Force
        Run "firmar portable $a" { & $signtool.FullName sign /sha1 $Thumbprint /fd sha256 /tr $TimestampUrl /td sha256 /d "Cinta" $out }
        Run "verificar portable $a" { & $signtool.FullName verify /pa /q $out }
        Write-Host "Listo ($a): $out + aplicacion\src-tauri\target\$t\release\bundle\nsis\"
    }
}
finally {
    Remove-Item $cfg -Force -ErrorAction SilentlyContinue
}
Write-Host "Verifica el instalador con:  signtool verify /pa /v <instalador>.exe"
