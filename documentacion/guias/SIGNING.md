# Firmar Cinta (instalador y .exe portable)

Firmar el código no cambia lo que hace la app: sirve para que Windows muestre tu nombre como editor y para que
SmartScreen desconfíe menos. **Un instalador sin firmar funciona igual**, solo que Windows avisa más al abrirlo.

## Qué necesitas
1. **Un certificado de firma de código.** Cinta no puede traerlo; hay que obtenerlo:
   - Certificado comercial (OV o EV) de una autoridad certificadora, o un servicio de firma en la nube.
     EV da mejor reputación inmediata en SmartScreen; OV la gana con el tiempo y las descargas.
   - Para **pruebas personales**: un certificado autofirmado (ver más abajo). No sirve para distribuir a otras personas.
2. **Windows SDK** (trae `signtool.exe`): Visual Studio Installer → «Windows 11 SDK» → «Signing Tools for Desktop Apps».
3. Los requisitos de [`COMPILAR.md`](COMPILAR.md).

## Firmar
1. Instala el certificado en tu almacén personal y copia su **huella (Thumbprint)**:
   ```powershell
   Get-ChildItem Cert:\CurrentUser\My | Format-Table Thumbprint, Subject, NotAfter
   ```
2. Genera todo firmado (x64 y ARM64):
   ```powershell
   .\herramientas/compilacion/compilar-firmado.ps1 -Thumbprint <HUELLA>
   ```
   Solo ARM64: `.\herramientas/compilacion/compilar-firmado.ps1 -Thumbprint <HUELLA> -Arch arm64`.
3. Resultado:
   - Instaladores: `aplicacion/src-tauri/target/<target>/release/bundle/nsis/`
   - Portables firmados: `portable\Cinta-portable-x64.exe` y `portable\Cinta-portable-arm64.exe`
4. Comprobar: `signtool verify /pa /v <archivo>.exe` (o clic derecho → Propiedades → Firmas digitales).

El script no guarda la huella en el proyecto (usa un archivo temporal que borra al terminar). **Nunca** metas el `.pfx`
ni su contraseña en el proyecto ni en Git.

## Certificado autofirmado (solo para probar en tu equipo)
```powershell
$c = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=Cinta (prueba)" -CertStoreLocation Cert:\CurrentUser\My -NotAfter (Get-Date).AddYears(2)
$c.Thumbprint
# Para que ESTE equipo lo considere de confianza (ejecutar como administrador):
Export-Certificate -Cert $c -FilePath cinta-prueba.cer
Import-Certificate -FilePath cinta-prueba.cer -CertStoreLocation Cert:\LocalMachine\Root
Import-Certificate -FilePath cinta-prueba.cer -CertStoreLocation Cert:\LocalMachine\TrustedPublisher
```
En otros equipos seguirá apareciendo como no confiable.

## Notas
- La marca de tiempo (`timestampUrl` en `aplicacion/src-tauri/tauri.conf.json`, por defecto DigiCert) mantiene válida la firma después de que
  el certificado caduque. Puedes cambiarla por la de tu autoridad.
- Si firmas con un servicio en la nube o un token USB, Tauri admite un comando de firma propio
  (`bundle.windows.signCommand`); consulta la documentación de Tauri 2 sobre firma en Windows.
- Estado: scripts escritos pero **no probados** en este entorno (sin Windows ni certificado).
