[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Account,
    [switch]$Save,
    [switch]$List
)

$ErrorActionPreference = 'Stop'

if ($env:CLAUDE_CONFIG_DIR) { $ConfigDir = $env:CLAUDE_CONFIG_DIR }
else { $ConfigDir = Join-Path $env:USERPROFILE '.claude' }

$Cred = Join-Path $ConfigDir '.credentials.json'

if ($env:CLAUDE_ACCOUNTS_DIR) { $Store = $env:CLAUDE_ACCOUNTS_DIR }
else { $Store = Join-Path $env:USERPROFILE '.claude-accounts' }

$Marker = Join-Path $Store '.active'

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

function Get-SavedAccounts {
    if (-not (Test-Path $Store)) { return @() }
    Get-ChildItem -Path $Store -Filter '*.json' -File |
        Where-Object { $_.BaseName -notlike '_*' } |
        ForEach-Object { $_.BaseName }
}

New-Item -ItemType Directory -Force -Path $Store | Out-Null

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
    Set-Content -Path $Marker -Value $Account -NoNewline
    Write-Output "conta '$Account' salva e marcada como ativa"
    exit 0
}

if (-not $Account) { Fail 'informe a conta: -Account <nome> (ou -List)' }

$target = Join-Path $Store "$Account.json"
if (-not (Test-CredFile $target)) { Fail "conta '$Account' nao esta salva ou o arquivo esta invalido - use -List" }

$active = Get-ActiveName
if ($active -eq $Account) { Write-Output "conta '$Account' ja esta ativa"; exit 0 }

if (Test-CredFile $Cred) {
    Copy-Item $Cred (Join-Path $Store '_backup-anterior.json') -Force
    if ($active) { Copy-Item $Cred (Join-Path $Store "$active.json") -Force }
}

Copy-Item $target $Cred -Force
Set-Content -Path $Marker -Value $Account -NoNewline

Write-Output "conta '$Account' ativa"
if (-not $active) {
    Write-Output 'AVISO: a conta anterior nao estava registrada; snapshot bruto em _backup-anterior.json'
}
Write-Output 'reabra com: claude --continue'
