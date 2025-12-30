# Basiq API Key Test Script
# Tests if your Basiq API key can successfully get a token

Write-Host "`n===========================================================" -ForegroundColor Cyan
Write-Host "  Basiq API Key Test" -ForegroundColor Cyan
Write-Host "===========================================================`n" -ForegroundColor Cyan

# Read API key from .env file
$envPath = "..\.env"
if (Test-Path $envPath) {
    $apiKey = Get-Content $envPath | Where-Object { $_ -match "^BASIQ_API_KEY=" } | ForEach-Object { $_.Split('=')[1] }
    
    if ($apiKey) {
        Write-Host "✅ API Key found in .env" -ForegroundColor Green
        Write-Host "   Length: $($apiKey.Length) characters" -ForegroundColor Gray
        Write-Host "   First 20 chars: $($apiKey.Substring(0, [Math]::Min(20, $apiKey.Length)))..." -ForegroundColor Gray
        
        # Try to decode Base64
        try {
            $decodedBytes = [System.Convert]::FromBase64String($apiKey)
            $decoded = [System.Text.Encoding]::UTF8.GetString($decodedBytes)
            
            if ($decoded -match ":") {
                $parts = $decoded.Split(':')
                Write-Host "✅ Valid Base64 format" -ForegroundColor Green
                Write-Host "   App ID: $($parts[0].Substring(0, 8))...$($parts[0].Substring($parts[0].Length - 4))" -ForegroundColor Gray
                Write-Host "   App Secret: $('*' * $parts[1].Length)" -ForegroundColor Gray
            } else {
                Write-Host "⚠️  Decoded but no ':' separator found" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "⚠️  Could not decode as Base64" -ForegroundColor Yellow
        }
        
        Write-Host "`nTesting Basiq API connection..." -ForegroundColor Cyan
        Write-Host "POST https://au-api.basiq.io/token" -ForegroundColor Gray
        
        try {
            $headers = @{
                "Authorization" = "Basic $apiKey"
                "Content-Type" = "application/x-www-form-urlencoded"
                "basiq-version" = "3.0"
            }
            
            $body = @{
                scope = "CLIENT_ACCESS"
            }
            
            $response = Invoke-RestMethod -Method Post `
                -Uri "https://au-api.basiq.io/token" `
                -Headers $headers `
                -Body $body `
                -ErrorAction Stop
            
            Write-Host "`n✅ SUCCESS! Token received" -ForegroundColor Green
            Write-Host "   Token Type: $($response.token_type)" -ForegroundColor Gray
            Write-Host "   Expires In: $($response.expires_in) seconds" -ForegroundColor Gray
            Write-Host "   Access Token: $($response.access_token.Substring(0, 50))..." -ForegroundColor Gray
            
            Write-Host "`n===========================================================" -ForegroundColor Green
            Write-Host "  Your Basiq integration is configured correctly!" -ForegroundColor Green
            Write-Host "===========================================================`n" -ForegroundColor Green
            
            Write-Host "Next Steps:" -ForegroundColor Cyan
            Write-Host "1. Start backend server:" -ForegroundColor White
            Write-Host "   cd backend && python -m uvicorn backend.main:app --reload" -ForegroundColor Gray
            Write-Host "2. Start frontend server:" -ForegroundColor White
            Write-Host "   cd frontend && npm run dev" -ForegroundColor Gray
            Write-Host "3. Test connection via UI" -ForegroundColor White
            Write-Host "`n⚠️  IMPORTANT: Whitelist this URL in Basiq Dashboard:" -ForegroundColor Yellow
            Write-Host "   http://localhost:5173/basiq-callback`n" -ForegroundColor Yellow
            
        } catch {
            $statusCode = $_.Exception.Response.StatusCode.value__
            $errorMessage= $_.ErrorDetails.Message
            
            Write-Host "`n❌ FAILED - Status Code: $statusCode" -ForegroundColor Red
            
            if ($statusCode -eq 401) {
                Write-Host "`nProblem: Invalid API key" -ForegroundColor Red
                Write-Host "Solution:" -ForegroundColor Yellow
                Write-Host "1. Go to https://dashboard.basiq.io" -ForegroundColor Gray
                Write-Host "2. Navigate to API Keys section" -ForegroundColor Gray
                Write-Host "3. Generate a new API key" -ForegroundColor Gray
                Write-Host "4. Update BASIQ_API_KEY in .env file" -ForegroundColor Gray
                Write-Host "5. Run this script again`n" -ForegroundColor Gray
            } elseif ($statusCode -eq 403) {
                Write-Host "`nProblem: Access denied - insufficient permissions" -ForegroundColor Red
                Write-Host "Solution:" -ForegroundColor Yellow
                Write-Host "1. Check your Basiq application permissions" -ForegroundColor Gray
                Write-Host "2. Ensure the API key has CLIENT_ACCESS scope" -ForegroundColor Gray
                Write-Host "3. Contact Basiq support: support@basiq.io`n" -ForegroundColor Gray
            } else {
                Write-Host "`nError Details: $errorMessage" -ForegroundColor Red
                Write-Host "`nContact Basiq support: support@basiq.io`n" -ForegroundColor Yellow
            }
        }
        
    } else {
        Write-Host "❌ BASIQ_API_KEY not found in .env file" -ForegroundColor Red
        Write-Host "`nSolution:" -ForegroundColor Yellow
        Write-Host "1. Get your API key from https://dashboard.basiq.io" -ForegroundColor Gray
        Write-Host "2. Add to .env file: BASIQ_API_KEY=YOUR_KEY_HERE" -ForegroundColor Gray
        Write-Host "3. Run this script again`n" -ForegroundColor Gray
    }
} else {
    Write-Host "❌ .env file not found" -ForegroundColor Red
    Write-Host "   Expected location: $envPath" -ForegroundColor Gray
    Write-Host "`nSolution:" -ForegroundColor Yellow
    Write-Host "1. Copy .env.example to .env" -ForegroundColor Gray
    Write-Host "2. Add your Basiq API key" -ForegroundColor Gray
    Write-Host "3. Run this script again`n" -ForegroundColor Gray
}
