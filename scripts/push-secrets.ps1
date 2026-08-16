<#
.SYNOPSIS
    Pushes local secrets to the deployed Cloudflare Worker via `wrangler secret put`.

.DESCRIPTION
    Reads NAME=value pairs from a .dev.vars-style file (default:
    apps/worker/.dev.vars) and runs `wrangler secret put <NAME>` for each of
    the secrets this template's worker reads from `env.*`:

        RESEND_API_KEY       - apps/worker/src/lib/email.ts (Resend email sending)
        STRIPE_SECRET_KEY    - apps/worker/src/modules/billing/routes.ts
        STRIPE_WEBHOOK_SECRET- apps/worker/src/modules/billing/routes.ts
        TEST_LOGIN_SECRET    - apps/worker/src/modules/auth/test-auth.ts (tier-2
                                smoke-test login; only push this if the deployment
                                actually runs smoke tests, see docs/modules/account.md)

    NOT pushed by this script, on purpose:
        TEST_AUTH_TOKEN - must never be a deployed secret. It's local-dev/CI
                          only, read from apps/worker/.dev.vars or vitest
                          miniflare bindings. See apps/worker/wrangler.toml
                          and docs/modules/account.md.
        STRIPE_PRICE_ID, EMAIL_FROM, LOG_LEVEL - these are non-secret vars,
                          set directly in apps/worker/wrangler.toml's [vars],
                          not via `wrangler secret put`.

    The input file is never committed (it's gitignored) and this script never
    prints secret values, only key names and wrangler's own output.

.PARAMETER VarsFile
    Path to the .dev.vars-style file to read secrets from. Defaults to
    apps/worker/.dev.vars.

.PARAMETER Env
    Optional wrangler environment name, passed through as `--env <Env>` to
    every `wrangler secret put` call.

.EXAMPLE
    ./scripts/push-secrets.ps1
    ./scripts/push-secrets.ps1 -VarsFile ./apps/worker/.dev.vars.production -Env production
#>

param(
    [string]$VarsFile = (Join-Path $PSScriptRoot "..\apps\worker\.dev.vars"),
    [string]$Env
)

$ErrorActionPreference = "Stop"

# Secrets this worker actually reads via env.* (grep apps/worker/src for
# `env\.[A-Z_]+` to re-derive this list if modules are added/removed).
$SecretNames = @(
    "RESEND_API_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "TEST_LOGIN_SECRET"
)

if (-not (Test-Path $VarsFile)) {
    Write-Error "Secrets file not found: $VarsFile`nCopy apps/worker/.dev.vars.example, fill in real values, and re-run."
    exit 1
}

Write-Host "Reading secrets from $VarsFile"

$vars = @{}
foreach ($line in Get-Content $VarsFile) {
    $trimmed = $line.Trim()
    if ($trimmed -eq "" -or $trimmed.StartsWith("#")) { continue }
    $idx = $trimmed.IndexOf("=")
    if ($idx -lt 1) { continue }
    $key = $trimmed.Substring(0, $idx).Trim()
    $value = $trimmed.Substring($idx + 1).Trim()
    $vars[$key] = $value
}

$workerDir = Join-Path $PSScriptRoot "..\apps\worker"
$wranglerArgs = @()
if ($Env) { $wranglerArgs += @("--env", $Env) }

foreach ($name in $SecretNames) {
    if (-not $vars.ContainsKey($name) -or [string]::IsNullOrWhiteSpace($vars[$name])) {
        Write-Host "  skip   $name (not set in $VarsFile)" -ForegroundColor Yellow
        continue
    }

    Write-Host "  push   $name" -ForegroundColor Cyan
    $vars[$name] | & wrangler secret put $name --cwd $workerDir @wranglerArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Error "wrangler secret put $name failed (exit $LASTEXITCODE)"
        exit $LASTEXITCODE
    }
}

Write-Host "Done. Never push TEST_AUTH_TOKEN — see script header." -ForegroundColor Green
