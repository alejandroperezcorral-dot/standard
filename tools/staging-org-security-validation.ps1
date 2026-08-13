param(
  [string]$Mode = "visibility"
)

$ErrorActionPreference = "Stop"

$ProjectRef = "amitkdqyfblymzdsrplx"
$BaseUrl = "https://amitkdqyfblymzdsrplx.supabase.co"
$AnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtaXRrZHF5ZmJseW16ZHNycGx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MjU2NTUsImV4cCI6MjEwMjEwMTY1NX0.pb3ukL71cCzLYudLhG5Ax0_UopOUCS9WepMX6wxpZ50"
$PasswordPath = Join-Path (Split-Path $PSScriptRoot -Parent) ".codex-secrets\staging-auth-test-password.txt"
$Password = [System.IO.File]::ReadAllText($PasswordPath)

$Emails = @(
  "platform.admin@example.test",
  "companya.admin@example.test",
  "companya.member1@example.test",
  "companya.member2@example.test",
  "companyb.admin@example.test",
  "companyb.member@example.test",
  "invited.new@example.test",
  "existing.nocompany@example.test",
  "existing.companyb@example.test"
)

function Invoke-JsonRequest {
  param(
    [string]$Method,
    [string]$Uri,
    [hashtable]$Headers,
    [object]$Body = $null
  )
  try {
    $params = @{
      Method = $Method
      Uri = $Uri
      Headers = $Headers
    }
    if ($null -ne $Body) {
      $params.Body = ($Body | ConvertTo-Json -Compress -Depth 10)
      $params.ContentType = "application/json"
    }
    $data = Invoke-RestMethod @params
    [pscustomobject]@{ ok = $true; status = 200; data = $data; error = $null }
  } catch {
    $status = 0
    $text = $_.Exception.Message
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
      try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $text = $reader.ReadToEnd()
      } catch {}
    }
    [pscustomobject]@{ ok = $false; status = $status; data = $null; error = $text }
  }
}

function Login($Email) {
  $res = Invoke-JsonRequest -Method "POST" -Uri "$BaseUrl/auth/v1/token?grant_type=password" -Headers @{
    apikey = $AnonKey
  } -Body @{ email = $Email; password = $Password }
  if (-not $res.ok) {
    return [pscustomobject]@{ email = $Email; ok = $false; user_id = $null; token = $null; error = $res.error }
  }
  [pscustomobject]@{ email = $Email; ok = $true; user_id = $res.data.user.id; token = $res.data.access_token; error = $null }
}

function RestGet($Session, $Path) {
  Invoke-JsonRequest -Method "GET" -Uri "$BaseUrl/rest/v1/$Path" -Headers @{
    apikey = $AnonKey
    Authorization = "Bearer $($Session.token)"
  }
}

function RpcPost($Session, $Name, $Body) {
  Invoke-JsonRequest -Method "POST" -Uri "$BaseUrl/rest/v1/rpc/$Name" -Headers @{
    apikey = $AnonKey
    Authorization = "Bearer $($Session.token)"
  } -Body $Body
}

function Redact-Object($Value) {
  if ($null -eq $Value) { return $null }
  if ($Value -is [System.Array]) {
    return @($Value | ForEach-Object { Redact-Object $_ })
  }
  if ($Value -is [pscustomobject]) {
    $obj = [ordered]@{}
    foreach ($prop in $Value.PSObject.Properties) {
      if ($prop.Name -in @("token", "invite_link", "access_token", "refresh_token")) {
        $obj[$prop.Name] = "[REDACTED]"
      } else {
        $obj[$prop.Name] = Redact-Object $prop.Value
      }
    }
    return [pscustomobject]$obj
  }
  return $Value
}

function SafeResult($Result) {
  [pscustomobject]@{
    ok = $Result.ok
    status = $Result.status
    data = Redact-Object $Result.data
    error = $Result.error
  }
}

$sessions = @{}
foreach ($email in $Emails) {
  $sessions[$email] = Login $email
}

if ($sessions.Values | Where-Object { -not $_.ok }) {
  $sessions.Values | Select-Object email, ok, user_id, error | ConvertTo-Json -Depth 5
  exit 1
}

$CompanyA = "03d6172b-fbbd-499b-a5ab-0b65f17a35ea"
$CompanyB = "b5ac132b-12e6-4678-b30e-551c0931f9fa"
$GroupA1 = "613d4a4a-7470-4180-83ec-e38f8dd795eb"
$GroupA2 = "e4fadc4f-266a-4287-8017-1ac228f4379e"
$GroupB1 = "dbf579f0-b0a6-407b-8743-0f1becb42c96"

switch ($Mode) {
  "visibility" {
    $actors = @(
      "platform.admin@example.test",
      "companya.admin@example.test",
      "companya.member1@example.test"
    )
    $paths = @(
      "companies?select=id,name,type&order=name",
      "profiles?select=id,email,role,access_role,company_type&order=email",
      "company_memberships?select=user_id,company_id,access_role,membership_status&order=user_id",
      "company_groups?select=id,name,company_id&order=name",
      "company_group_memberships?select=user_id,company_id,company_group_id&order=user_id",
      "company_invitations?select=id,email,company_id,intended_access_role,status&order=email"
    )
    $out = foreach ($actor in $actors) {
      foreach ($path in $paths) {
        $res = RestGet $sessions[$actor] $path
        [pscustomobject]@{
          actor = $actor
          path = ($path -replace "\?.*$","")
          ok = $res.ok
          status = $res.status
          count = if ($res.ok -and $res.data -is [array]) { $res.data.Count } elseif ($res.ok -and $null -ne $res.data) { 1 } else { 0 }
          names = if ($res.ok -and ($path -like "company_groups*")) { (($res.data | ForEach-Object { $_.name }) -join ", ") } else { "" }
        }
      }
    }
    [pscustomobject]@{
      project_ref = $ProjectRef
      logins = ($sessions.Values | Select-Object email, ok, user_id)
      visibility = $out
    } | ConvertTo-Json -Depth 8
  }
  "rpc" {
    $companyAdmin = $sessions["companya.admin@example.test"]
    $member1 = $sessions["companya.member1@example.test"]
    $platformAdmin = $sessions["platform.admin@example.test"]
    $member2Id = $sessions["companya.member2@example.test"].user_id
    $companyBMemberId = $sessions["companyb.member@example.test"].user_id
    $unique = [guid]::NewGuid().ToString("N").Substring(0, 12)
    $out = @()
    $out += [pscustomobject]@{ test = "member_update_own_profile"; result = (SafeResult (RpcPost $member1 "update_own_profile" @{ p_first_name = "Member"; p_last_name = "One"; p_phone = "100"; p_job_position = "Buyer" })) }
    $out += [pscustomobject]@{ test = "member_direct_sensitive_profile_update"; result = (SafeResult (Invoke-JsonRequest -Method "PATCH" -Uri "$BaseUrl/rest/v1/profiles?id=eq.$($member1.user_id)" -Headers @{ apikey = $AnonKey; Authorization = "Bearer $($member1.token)"; Prefer = "return=representation" } -Body @{ role = "admin"; access_role = "Platform Admin"; approved = $true })) }
    $out += [pscustomobject]@{ test = "company_admin_member_to_member"; result = (SafeResult (RpcPost $companyAdmin "update_company_member" @{ p_member_user_id = $member2Id; p_access_role = "Company Member"; p_group_ids = @($GroupA1, $GroupA2); p_job_position = "Designer"; p_department = "Design" })) }
    $out += [pscustomobject]@{ test = "company_admin_member_to_admin"; result = (SafeResult (RpcPost $companyAdmin "update_company_member" @{ p_member_user_id = $member2Id; p_access_role = "Company Admin"; p_group_ids = @($GroupA1); p_job_position = "Lead"; p_department = "Design" })) }
    $out += [pscustomobject]@{ test = "company_admin_platform_admin_denied"; result = (SafeResult (RpcPost $companyAdmin "update_company_member" @{ p_member_user_id = $member2Id; p_access_role = "Platform Admin"; p_group_ids = @($GroupA1); p_job_position = "Lead"; p_department = "Design" })) }
    $out += [pscustomobject]@{ test = "company_admin_cross_company_member_denied"; result = (SafeResult (RpcPost $companyAdmin "update_company_member" @{ p_member_user_id = $companyBMemberId; p_access_role = "Company Member"; p_group_ids = @($GroupB1); p_job_position = "Cross"; p_department = "Bad" })) }
    $out += [pscustomobject]@{ test = "company_admin_cross_company_group_denied"; result = (SafeResult (RpcPost $companyAdmin "update_company_member" @{ p_member_user_id = $member2Id; p_access_role = "Company Member"; p_group_ids = @($GroupB1); p_job_position = "CrossGroup"; p_department = "Bad" })) }
    $out += [pscustomobject]@{ test = "member_rpc_update_company_member_denied"; result = (SafeResult (RpcPost $member1 "update_company_member" @{ p_member_user_id = $member2Id; p_access_role = "Company Admin"; p_group_ids = @($GroupA1); p_job_position = "Bad"; p_department = "Bad" })) }
    $out += [pscustomobject]@{ test = "valid_company_a_invitation"; result = (SafeResult (RpcPost $companyAdmin "create_company_invitation" @{ p_email = "invite-$unique@example.test"; p_access_role = "Company Member"; p_first_name = "Invite"; p_last_name = "Valid"; p_job_position = "Buyer"; p_department = "Design"; p_group_ids = @($GroupA1); p_expires_at = $null })) }
    $out += [pscustomobject]@{ test = "platform_admin_role_invitation_denied"; result = (SafeResult (RpcPost $companyAdmin "create_company_invitation" @{ p_email = "invite-platform-$unique@example.test"; p_access_role = "Platform Admin"; p_first_name = "Invite"; p_last_name = "Bad"; p_job_position = "Bad"; p_department = "Bad"; p_group_ids = @($GroupA1); p_expires_at = $null })) }
    $out += [pscustomobject]@{ test = "normal_member_invitation_denied"; result = (SafeResult (RpcPost $member1 "create_company_invitation" @{ p_email = "invite-member-$unique@example.test"; p_access_role = "Company Member"; p_group_ids = @($GroupA1); p_expires_at = $null })) }
    [pscustomobject]@{ project_ref = $ProjectRef; rpc = $out } | ConvertTo-Json -Depth 12
  }
  default {
    throw "Unknown mode $Mode"
  }
}
