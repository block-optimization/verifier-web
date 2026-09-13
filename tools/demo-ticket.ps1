<#
  MediVC 데모 티켓 발급 · 즉시 열기

  실 백엔드에서 PUBLIC 응급카드 티켓을 발급받아 발견자 화면을 바로 연다.
  티켓은 5분 만료 · 1회용이라 수동으로 복사·붙여넣는 사이 만료되기 쉽다.
  이 스크립트는 발급과 열기를 한 번에 해서 그 지연을 없앤다.

  사용법
    .\tools\demo-ticket.ps1                      # 백엔드 /emergency 로 열기
    .\tools\demo-ticket.ps1 -Site <netlify-url>  # Netlify 배포본으로 열기
    .\tools\demo-ticket.ps1 -NoOpen              # 코드만 출력 (직접 입력용)
    .\tools\demo-ticket.ps1 -Purpose RESPONDER   # 응급대원 티켓
#>
param(
  [string]$Api     = "https://api-175-45-193-221.sslip.io",
  [string]$Site    = "",
  [ValidateSet("PUBLIC","RESPONDER")][string]$Purpose = "PUBLIC",
  [switch]$Bracelet,
  [switch]$NoOpen
)

$ErrorActionPreference = "Stop"

function Step($msg) { Write-Host "  $msg" -ForegroundColor DarkGray }

Write-Host ""
Write-Host "MediVC 데모 티켓 발급" -ForegroundColor Cyan
Write-Host ("-" * 52)

try {
  Step "1/3  환자 데모 토큰 요청..."
  $token = (Invoke-RestMethod -Method Post -Uri "$Api/demo/v1/tokens/patient" -TimeoutSec 15).token
  $headers = @{ authorization = "Bearer $token" }

  Step "2/3  응급카드 발급..."
  $card = Invoke-RestMethod -Method Post -Uri "$Api/api/patient/v1/cards" `
    -Headers $headers -ContentType "application/json" `
    -Body '{"credentialLifetimeSeconds":3600}' -TimeoutSec 15

  if ($Bracelet) {
    Step "3/3  팔찌 발급 (영구 재사용)..."
    $ticket = Invoke-RestMethod -Method Post -Uri "$Api/api/patient/v1/bracelets" `
      -Headers $headers -ContentType "application/json" -Body '{}' -TimeoutSec 15
  } else {
    Step "3/3  단회 티켓 발급 ($Purpose)..."
    $body = @{ purpose = $Purpose; ttlSeconds = 300 } | ConvertTo-Json -Compress
    $ticket = Invoke-RestMethod -Method Post `
      -Uri "$Api/api/patient/v1/cards/$($card.cardId)/tickets" `
      -Headers $headers -ContentType "application/json" -Body $body -TimeoutSec 15
  }
}
catch {
  Write-Host ""
  Write-Host "발급 실패: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "백엔드가 살아있는지 확인: $Api/health" -ForegroundColor DarkGray
  exit 1
}

# 열 주소 결정 — Site 를 주면 그쪽, 아니면 백엔드가 준 qrPayload 그대로
if ($Site) {
  $base = $Site.TrimEnd('/')
  if ($Bracelet) { $url = "$base/#card=$($ticket.cardReference)" }
  else           { $url = "$base/#ticket=$($ticket.qrTicket)" }
} else {
  $url = $ticket.qrPayload
}

Write-Host ("-" * 52)
if ($Bracelet) {
  Write-Host "  카드참조 " -NoNewline; Write-Host $ticket.cardReference -ForegroundColor Yellow
  Write-Host "  만료     없음 (validUntil: null)"
  Write-Host "  재사용   무제한. 스캔마다 서버가 새 일회용 티켓을 발급" -ForegroundColor DarkGray
  Write-Host "  파기     POST /api/patient/v1/cards/$($card.cardId)/revoke" -ForegroundColor DarkGray
} else {
  $expires   = [datetime]::Parse($ticket.expiresAt).ToLocalTime()
  $remaining = [int]($expires - (Get-Date)).TotalSeconds
  Write-Host "  수동코드 " -NoNewline; Write-Host $ticket.manualCode -ForegroundColor Yellow
  Write-Host "  만료     $($expires.ToString('HH:mm:ss')) (약 $remaining 초 남음)"
  Write-Host "  1회용    링크나 수동코드 중 하나만 사용 (같은 티켓)" -ForegroundColor DarkGray
}
Write-Host ("-" * 52)
Write-Host "  $url" -ForegroundColor Cyan
Write-Host ""

if (-not $NoOpen) {
  Step "브라우저로 여는 중..."
  Start-Process $url
}
