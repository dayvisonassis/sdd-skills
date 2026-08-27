[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Account,
    [switch]$Save,
    [switch]$List,
    [switch]$Status,
    [switch]$Sessions
)

$ErrorActionPreference = 'Stop'

if ($env:CLAUDE_CONFIG_DIR) { $ConfigDir = $env:CLAUDE_CONFIG_DIR }
else { $ConfigDir = Join-Path $env:USERPROFILE '.claude' }

$Cred = Join-Path $ConfigDir '.credentials.json'

if ($env:CLAUDE_ACCOUNTS_DIR) { $Store = $env:CLAUDE_ACCOUNTS_DIR }
else { $Store = Join-Path $env:USERPROFILE '.claude-accounts' }

$Marker = Join-Path $Store '.active'

if ($env:CLAUDE_STATE_FILE) { $State = $env:CLAUDE_STATE_FILE }
else { $State = Join-Path $env:USERPROFILE '.claude.json' }

$IdentityKeys = @('userID', 'oauthAccount')

function Fail([string]$Message) {
    Write-Output "ERRO: $Message"
    exit 1
}

function Get-ActiveName {
    if (Test-Path $Marker) { return (Get-Content $Marker -Raw).Trim() }
    return ''
}

function Test-CredFile([string]$Path) {
    if (-not (Test-Path $Path)) { return $false }
    if ((Get-Item $Path).Length -lt 50) { return $false }
    try { Get-Content $Path -Raw | ConvertFrom-Json | Out-Null } catch { return $false }
    return $true
}

function Get-PythonExe {
    foreach ($c in @('python3', 'python')) {
        $cmd = Get-Command $c -ErrorAction SilentlyContinue
        if (-not $cmd) { continue }
        & $cmd.Source -c 'pass' 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { return $cmd.Source }
    }
    return $null
}

$PyExe = Get-PythonExe
$IdentityPy = Join-Path $PSScriptRoot 'identity.py'

function Invoke-Identity([string[]]$IdArgs) {
    if (-not $PyExe) { return 99 }
    if (-not (Test-Path $IdentityPy)) { return 98 }
    & $PyExe $IdentityPy @IdArgs 2>$null | Out-Null
    return $LASTEXITCODE
}

$IdentityDir = Join-Path $Store 'identities'
function Get-IdentityPath([string]$Name) { Join-Path $IdentityDir "$Name.json" }

function Save-Identity([string]$Dest) {
    return (Invoke-Identity @('extract', $State, $Dest)) -eq 0
}

function Apply-Identity([string]$Src) {
    if (-not (Test-Path $Src)) { return 'sem-identidade' }
    $rc = Invoke-Identity @('apply', $State, $Src, (Join-Path $Store '_backup-state.json'))
    switch ($rc) {
        0  { return 'ok' }
        2  { return 'estado-ilegivel' }
        3  { return 'identidade-invalida' }
        4  { return 'escrita-falhou' }
        98 { return 'helper-ausente' }
        99 { return 'sem-python' }
        default { return "erro-$rc" }
    }
}

function Get-LiveAccount {
    if (-not $PyExe) { return $null }
    if (-not (Test-Path $IdentityPy)) { return $null }
    $out = & $PyExe $IdentityPy whoami $State $IdentityDir 2>$null
    if ($LASTEXITCODE -eq 0 -and $out) { return "$out".Trim() }
    return $null
}

function Test-IdentityMatches([string]$Name) {
    $snap = Get-IdentityPath $Name
    if (-not (Test-Path $snap)) { return $null }
    $rc = Invoke-Identity @('compare', $State, $snap)
    if ($rc -eq 0) { return $true }
    if ($rc -eq 1) { return $false }
    return $null
}

function Get-OtherSessionCount {
    try {
        $mine = @()
        $p = Get-CimInstance Win32_Process -Filter "ProcessId=$PID" -ErrorAction Stop
        while ($p) {
            $mine += $p.ProcessId
            if (-not $p.ParentProcessId -or $p.ParentProcessId -eq 0) { break }
            $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($p.ParentProcessId)" -ErrorAction SilentlyContinue
        }
        $all = @(Get-CimInstance Win32_Process -Filter "Name='claude.exe'" -ErrorAction Stop)
        $hostProc = $all | Where-Object { $mine -contains $_.ProcessId } | Select-Object -First 1
        $hostParent = if ($hostProc) { $hostProc.ParentProcessId } else { $null }
        return @($all | Where-Object {
            ($mine -notcontains $_.ProcessId) -and
            ((-not $hostParent) -or ($_.ParentProcessId -ne $hostParent))
        }).Count
    } catch {
        return -1
    }
}

function Get-SavedAccounts {
    if (-not (Test-Path $Store)) { return @() }
    Get-ChildItem -Path $Store -Filter '*.json' -File |
        Where-Object { $_.BaseName -notlike '_*' } |
        ForEach-Object { $_.BaseName }
}

New-Item -ItemType Directory -Force -Path $Store, $IdentityDir | Out-Null

if ($Sessions) {
    $n = Get-OtherSessionCount
    if ($n -lt 0) { Write-Output 'indeterminado' } else { Write-Output "outras-sessoes:$n" }
    exit 0
}

if ($Status) {
    if (-not (Test-CredFile $Cred)) { Write-Output 'sem-credenciais'; exit 0 }
    if (@(Get-SavedAccounts).Count -eq 0) { Write-Output 'sem-cadastro'; exit 0 }
    $active = Get-ActiveName
    if (-not $active) { Write-Output 'sem-ativa'; exit 0 }
    $real = Get-LiveAccount
    if ($real -and $real -ne $active) { Write-Output "marcador-desatualizado:$real"; exit 0 }
    $snap = Join-Path $Store "$active.json"
    if (-not (Test-CredFile $snap)) { Write-Output "diverge:$active"; exit 0 }
    $h1 = (Get-FileHash -Path $Cred -Algorithm SHA256).Hash
    $h2 = (Get-FileHash -Path $snap -Algorithm SHA256).Hash
    if ($h1 -ne $h2) { Write-Output "diverge:$active"; exit 0 }
    $idOk = Test-IdentityMatches $active
    if ($null -eq $idOk) { Write-Output "sem-identidade:$active" }
    elseif ($idOk) { Write-Output "confere:$active" }
    else { Write-Output "identidade-divergente:$active" }
    exit 0
}

if ($List) {
    $active = Get-ActiveName
    $saved  = @(Get-SavedAccounts)
    if ($saved.Count -eq 0) { Write-Output 'nenhuma conta salva ainda'; exit 0 }
    foreach ($n in $saved) {
        $flag = ''
        if (-not (Test-CredFile (Join-Path $Store "$n.json"))) { $flag = '  [INVALIDA - refaca o -Save]' }
        if ($n -eq $active) { Write-Output "* $n (ativa)$flag" } else { Write-Output "  $n$flag" }
    }
    exit 0
}

if ($Save) {
    if (-not $Account) { Fail 'informe o nome: -Save -Account <nome>' }
    if (-not (Test-CredFile $Cred)) { Fail "credenciais ativas ausentes ou invalidas em $Cred - faca login primeiro" }
    Copy-Item $Cred (Join-Path $Store "$Account.json") -Force
    $idSaved = Save-Identity (Get-IdentityPath $Account)
    Set-Content -Path $Marker -Value $Account -NoNewline
    Write-Output "conta '$Account' salva e marcada como ativa"
    if (-not $idSaved) { Write-Output "AVISO: identidade nao encontrada em $State - a troca vai levar so o token" }
    exit 0
}

if (-not $Account) { Fail 'informe a conta: -Account <nome> (ou -List)' }

$target = Join-Path $Store "$Account.json"
if (-not (Test-CredFile $target)) { Fail "conta '$Account' nao esta salva ou o arquivo esta invalido - use -List" }

$active = Get-ActiveName
$outgoing = Get-LiveAccount
$staleNote = ''
$current = if ($outgoing) { $outgoing } else { $active }
if ($current -eq $Account) {
    if ($active -ne $Account) {
        Set-Content -Path $Marker -Value $Account -NoNewline
        Write-Output "conta '$Account' ja esta ativa (marcador corrigido: dizia '$active')"
    } else {
        Write-Output "conta '$Account' ja esta ativa"
    }
    exit 0
}
''
if (Test-CredFile $Cred) {
    Copy-Item $Cred (Join-Path $Store '_backup-anterior.json') -Force
    if ($outgoing) {
        Copy-Item $Cred (Join-Path $Store "$outgoing.json") -Force
        Save-Identity (Get-IdentityPath $outgoing) | Out-Null
        if ($outgoing -ne $active) { $staleNote = 'stale' }
    } else {
        $staleNote = 'skip'
    }
}

Copy-Item $target $Cred -Force
$idResult = Apply-Identity (Get-IdentityPath $Account)
Set-Content -Path $Marker -Value $Account -NoNewline

Write-Output "conta '$Account' ativa"
if ($staleNote -eq 'skip') {
    Write-Output 'AVISO: nao identifiquei a conta que estava ativa - NAO regravei nenhum snapshot, para nao gravar por cima do errado'
} elseif ($staleNote -eq 'stale') {
    Write-Output "NOTA: a conta que saiu era '$outgoing' (o marcador dizia '$active') - salvei nela, nao no que o marcador dizia"
}
if ($idResult -ne 'ok') {
    Write-Output "AVISO: o token trocou mas a identidade NAO ($idResult) - o app vai exibir a conta antiga"
}
if (-not $active) {
    Write-Output 'AVISO: a conta anterior nao estava registrada; snapshot bruto em _backup-anterior.json'
}
Write-Output 'reabra com: claude --continue'
