param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ExpoArgs
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot ".env"

function Get-DotEnvValue {
  param([string]$Name)

  if (-not (Test-Path -LiteralPath $envPath)) {
    return ""
  }

  foreach ($line in Get-Content -LiteralPath $envPath) {
    if ($line -match "^\s*$([regex]::Escape($Name))\s*=") {
      $value = $line -replace "^\s*$([regex]::Escape($Name))\s*=\s*", ""
      return $value.Trim().Trim('"').Trim("'")
    }
  }

  return ""
}

function Normalize-ProxyUrl {
  param([string]$ProxyServer)

  if (-not $ProxyServer) {
    return ""
  }

  $candidate = $ProxyServer

  if ($ProxyServer.Contains(";")) {
    $parts = $ProxyServer.Split(";") | Where-Object { $_ }
    $httpsPart = $parts | Where-Object { $_ -match "^https=" } | Select-Object -First 1
    $httpPart = $parts | Where-Object { $_ -match "^http=" } | Select-Object -First 1
    if ($httpsPart) {
      $candidate = $httpsPart
    } elseif ($httpPart) {
      $candidate = $httpPart
    } else {
      $candidate = $parts[0]
    }

    $candidate = $candidate -replace "^(https?|socks)=", ""
  }

  if ($candidate -notmatch "^[a-zA-Z][a-zA-Z0-9+.-]*://") {
    $candidate = "http://$candidate"
  }

  return $candidate
}

$proxyUrl = Get-DotEnvValue "DEV_PROXY_URL"

if (-not $proxyUrl) {
  $internetSettings = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings"

  if ($internetSettings.ProxyEnable -eq 1) {
    $proxyUrl = Normalize-ProxyUrl $internetSettings.ProxyServer
  }
}

if (-not $proxyUrl) {
  Write-Host "No DEV_PROXY_URL or Windows system proxy found. Starting Expo normally."
} else {
  $env:NODE_USE_ENV_PROXY = "1"
  $env:HTTP_PROXY = $proxyUrl
  $env:HTTPS_PROXY = $proxyUrl

  if (-not $env:NO_PROXY) {
    $env:NO_PROXY = "localhost,127.0.0.1,::1"
  }

  Write-Host "Starting Expo with Node proxy: $proxyUrl"
}

if (-not $ExpoArgs -or $ExpoArgs.Count -eq 0) {
  $ExpoArgs = @("start", "--clear")
}

& npx expo @ExpoArgs
exit $LASTEXITCODE
