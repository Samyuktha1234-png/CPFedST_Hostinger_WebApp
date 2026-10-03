$ErrorActionPreference = 'Stop'

Write-Host 'Build frontend:' -ForegroundColor Cyan
Set-Location "$PSScriptRoot\..\frontend"
npm install
npm run build

Write-Host 'Start Express backend:' -ForegroundColor Cyan
Set-Location "$PSScriptRoot\..\server"
npm install
npm start
