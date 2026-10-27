# =====================================================================
#  Command Service - limpieza tras la reorganizacion de carpetas (v1.2.0)
#  Borra los archivos de la estructura ANTERIOR. Su contenido ya existe en
#  las nuevas carpetas (src/models, src/dao, src/services, public/assets...).
#  Uso (desde la carpeta del proyecto, con el servidor detenido):
#     powershell -ExecutionPolicy Bypass -File .\limpiar-estructura-anterior.ps1
# =====================================================================
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

# Seguridad: solo se ejecuta si la estructura nueva ya esta presente
foreach ($req in @('src\models\Solicitud.js', 'src\dao\BaseDAO.js', 'src\services\index.js', 'public\assets\js\app\main.js')) {
    if (-not (Test-Path -LiteralPath $req)) { Write-Host "Falta $req : la estructura nueva no esta completa. No se borra nada." -ForegroundColor Red; exit 1 }
}

$antiguos = @(
    'public\css\app.css',
    'public\auth.css',
    'public\landstyle.css',
    'public\css\theme.css',
    'public\img\isotipo-dark.png',
    'public\img\isotipo-light.png',
    'public\img\logo-dark.png',
    'public\img\logo-light.png',
    'public\LOGO CUADRADO.png',
    'public\LOGO RECTANGULAR.svg',
    'public\js\app\core.js',
    'public\js\app\main.js',
    'public\js\app\views\adminProveedores.js',
    'public\js\app\views\adminUsuarios.js',
    'public\js\app\views\agenda.js',
    'public\js\app\views\auditoria.js',
    'public\js\app\views\catalogo.js',
    'public\js\app\views\inicio.js',
    'public\js\app\views\misServicios.js',
    'public\js\app\views\perfil.js',
    'public\js\app\views\reportes.js',
    'public\js\app\views\sistema.js',
    'public\js\app\views\solicitudes.js',
    'public\auth.js',
    'public\landscript.js',
    'public\login.js',
    'public\registro.js',
    'public\js\theme.js',
    'public\vendor\fontawesome\LICENSE.txt',
    'public\vendor\fontawesome\css\all.min.css',
    'public\vendor\fontawesome\webfonts\fa-brands-400.woff2',
    'public\vendor\fontawesome\webfonts\fa-regular-400.woff2',
    'public\vendor\fontawesome\webfonts\fa-solid-900.woff2',
    'public\vendor\fontawesome\webfonts\fa-v4compatibility.woff2',
    'public\vendor\fonts\fonts.css',
    'public\vendor\fonts\montserrat-latin-400-normal.woff2',
    'public\vendor\fonts\montserrat-latin-600-normal.woff2',
    'public\vendor\fonts\montserrat-latin-700-normal.woff2',
    'public\vendor\fonts\montserrat-latin-800-normal.woff2',
    'public\vendor\fonts\open-sans-latin-300-normal.woff2',
    'public\vendor\fonts\open-sans-latin-400-normal.woff2',
    'public\vendor\fonts\open-sans-latin-600-normal.woff2',
    'public\vendor\fonts\open-sans-latin-700-normal.woff2',
    'public\panel.html',
    'public\panel.js',
    'src\config\db.js',
    'src\dao\reporte.dao.js',
    'src\dao\auditoria.dao.js',
    'src\dao\servicio.dao.js',
    'src\dao\solicitud.dao.js',
    'src\dao\usuario.dao.js',
    'src\middleware\requireAuth.js',
    'src\middleware\rateLimiters.js',
    'src\middleware\validate.js',
    'src\services\sistema.service.js',
    'src\services\solicitud.service.js',
    'src\utils\http.js',
    'src\utils\cookies.js',
    'tests\api.test.js',
    'tests\solicitud.service.test.js'
)

$borrados = 0
foreach ($f in $antiguos) {
    if (Test-Path -LiteralPath $f) { Remove-Item -LiteralPath $f -Force; Write-Host "  borrado  $f"; $borrados++ }
}

# Carpetas que quedaron vacias
foreach ($d in @('public\js\app\views', 'public\js\app', 'public\js', 'public\css', 'public\img',
                 'public\vendor\fontawesome\webfonts', 'public\vendor\fontawesome\css', 'public\vendor\fontawesome',
                 'public\vendor\fonts', 'public\vendor', 'src\middleware')) {
    if ((Test-Path -LiteralPath $d) -and -not (Get-ChildItem -LiteralPath $d -Force)) { Remove-Item -LiteralPath $d -Force; Write-Host "  carpeta  $d" }
}

Write-Host ""
Write-Host "Listo: $borrados archivos de la estructura anterior eliminados." -ForegroundColor Green
Write-Host "Siguiente paso: npm test   (deben pasar 23 de 23)"
Remove-Item -LiteralPath $PSCommandPath -Force   # el script se borra a si mismo
