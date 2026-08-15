# Thin wrapper around scripts/stripe-tunnel.mjs for Windows dev shells.
# Forwards Stripe webhook events to a local `wrangler dev` worker via the
# Stripe CLI. See stripe-tunnel.mjs for details and prerequisites.
#
# Usage: .\scripts\stripe-tunnel.ps1 [worker-url]

param(
    [string]$WorkerUrl = "http://localhost:8787"
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
node (Join-Path $scriptDir "stripe-tunnel.mjs") $WorkerUrl
exit $LASTEXITCODE
