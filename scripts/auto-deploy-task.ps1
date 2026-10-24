# Manages the Windows scheduled task that deploys new builds automatically.
#
#   powershell -File scripts\auto-deploy-task.ps1 install   create/replace the task (every 15 minutes)
#   powershell -File scripts\auto-deploy-task.ps1 status    show the task and its last result
#   powershell -File scripts\auto-deploy-task.ps1 run       run it once now
#   powershell -File scripts\auto-deploy-task.ps1 remove    delete the task
#
# The task runs `node scripts\deploy.mjs --auto` in this folder and appends
# everything it prints to deploy.log. It runs as you, only while you are signed
# in to Windows, and Docker Desktop must be running.
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('install', 'status', 'run', 'remove')]
  [string]$Action,
  [int]$EveryMinutes = 15
)

$TaskName = 'PrintFlowLite Deploy'
$Repo = Split-Path -Parent $PSScriptRoot

switch ($Action) {
  'install' {
    $node = (Get-Command node -ErrorAction Stop).Source
    if (-not (Test-Path (Join-Path $Repo '.env.production'))) {
      throw ".env.production not found in $Repo. Run 'npm run deploy' once by hand first."
    }
    # cmd /c lets one command change folder, run node and redirect output to the log.
    $command = "cd /d `"$Repo`" && `"$node`" scripts\deploy.mjs --auto >> deploy.log 2>&1"
    $taskAction = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c $command"
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
      -RepetitionInterval (New-TimeSpan -Minutes $EveryMinutes)
    $settings = New-ScheduledTaskSettingsSet `
      -MultipleInstances IgnoreNew `
      -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
      -StartWhenAvailable `
      -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    Register-ScheduledTask -TaskName $TaskName -Action $taskAction -Trigger $trigger `
      -Settings $settings -Description 'Pulls and deploys the newest PrintFlow Lite image.' -Force | Out-Null
    Write-Host "Installed '$TaskName': runs every $EveryMinutes minutes."
    Write-Host "Log: $Repo\deploy.log"
  }
  'status' {
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if (-not $task) { Write-Host "Task '$TaskName' is not installed."; break }
    $info = Get-ScheduledTaskInfo -TaskName $TaskName
    Write-Host "State:       $($task.State)"
    Write-Host "Last run:    $($info.LastRunTime)"
    Write-Host "Last result: $($info.LastTaskResult)  (0 = the task ran; see deploy.log for the deploy outcome)"
    Write-Host "Next run:    $($info.NextRunTime)"
    $log = Join-Path $Repo 'deploy.log'
    if (Test-Path $log) { Write-Host "`nLast lines of deploy.log:"; Get-Content $log -Tail 8 }
  }
  'run' { Start-ScheduledTask -TaskName $TaskName; Write-Host "Started. Check: deploy.log" }
  'remove' {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Removed '$TaskName' (if it existed). Manual 'npm run deploy' still works."
  }
}
