# notify-and-play.ps1
# Shows a Windows toast notification and plays the adhan MP3.
# Called by shia-azan-bg.wsf at each prayer time.
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File notify-and-play.ps1 \
#       -Prayer "Fajr" -ReciterUrl "https://praytimes.org/audio/shia/Moazzen-Zadeh.mp3" -Volume 100

param(
    [string]$Prayer = "Fajr",
    [string]$ReciterUrl = "https://praytimes.org/audio/shia/Moazzen-Zadeh.mp3",
    [int]$Volume = 100
)

$ErrorActionPreference = 'SilentlyContinue'

# ---------- Toast notification (Windows 10+ via NotifyIcon balloon) ----------
try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $notify = New-Object System.Windows.Forms.NotifyIcon
    $notify.Icon = [System.Drawing.SystemIcons]::Information
    $notify.BalloonTipTitle = "Shia Azan"
    $notify.BalloonTipText = "Adhan - $Prayer time"
    $notify.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
    $notify.Visible = $true
    $notify.ShowBalloonTip(15000)
} catch {
    # Fallback: a simple message box (non-blocking via Start-Process)
    try {
        $msg = "Adhan - $Prayer time"
        Start-Process -FilePath "msg.exe" -ArgumentList "*","$msg" -WindowStyle Hidden -ErrorAction SilentlyContinue
    } catch {}
}

# ---------- Play adhan MP3 via WPF MediaPlayer ----------
# System.Windows.Media.MediaPlayer supports MP3 streaming and is
# included in .NET Framework 4+ (pre-installed on Windows 10+).
try {
    Add-Type -AssemblyName PresentationCore
    $player = New-Object System.Windows.Media.MediaPlayer
    $player.Volume = [Math]::Max(0, [Math]::Min(1, $Volume / 100.0))
    $player.Open([Uri]$ReciterUrl)

    # Give the player a moment to buffer before pressing play.
    Start-Sleep -Milliseconds 800
    $player.Play()

    # Wait for playback to finish (MediaEnded event) or 10 min max.
    $script:done = $false
    $player.Add_MediaEnded({ $script:done = $true })
    $elapsed = 0
    $maxSeconds = 600
    while (-not $script:done -and $elapsed -lt $maxSeconds) {
        Start-Sleep -Seconds 1
        $elapsed++
    }
    $player.Stop()
    $player.Close()
} catch {
    # Fallback: Windows Media Player COM object
    try {
        $wmp = New-Object -ComObject WMPlayer.OCX.7
        $wmp.URL = $ReciterUrl
        $wmp.settings.volume = [Math]::Max(0, [Math]::Min(100, $Volume))
        $wmp.controls.play()
        Start-Sleep -Seconds 5
        # Wait for playState 1 (stopped) or 10 min max
        $elapsed = 0
        while ($wmp.playState -ne 1 -and $elapsed -lt 600) {
            Start-Sleep -Seconds 1
            $elapsed++
        }
        $wmp.close()
    } catch {}
}

# ---------- Cleanup notification ----------
try {
    Start-Sleep -Seconds 2
    $notify.Visible = $false
    $notify.Dispose()
} catch {}
