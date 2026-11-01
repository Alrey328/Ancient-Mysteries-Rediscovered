[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$SourceDirectory,

  [string]$RepositoryRoot = ''
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($RepositoryRoot)) {
  $RepositoryRoot = Split-Path -Parent $PSScriptRoot
}

$webVideoName = 'amr-hero-web.mp4'
$posterName = 'amr-hero-poster.jpg'
$masterName = 'AMR_YouTube_Cinematic_Entrance_V2_Fluid_Unified_Audio(1).mp4'

$sourcePath = (Resolve-Path -LiteralPath $SourceDirectory).Path
$repositoryPath = (Resolve-Path -LiteralPath $RepositoryRoot).Path
$heroAssetDirectory = Join-Path $repositoryPath 'assets\hero'
$cinematicDirectory = Join-Path $repositoryPath 'media\amr-cinematic'
$originalDirectory = Join-Path $cinematicDirectory 'original'

$webVideoSource = Join-Path $sourcePath $webVideoName
$posterSource = Join-Path $sourcePath $posterName
$masterSource = Join-Path $sourcePath $masterName

foreach ($requiredFile in @($webVideoSource, $posterSource, $masterSource)) {
  if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
    throw "Required media file not found: $requiredFile"
  }
}

$ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue
$ffprobe = Get-Command ffprobe -ErrorAction SilentlyContinue
if (-not $ffmpeg -or -not $ffprobe) {
  throw 'ffmpeg and ffprobe are required to create the synchronized soundtrack asset.'
}

New-Item -ItemType Directory -Force -Path $heroAssetDirectory, $originalDirectory | Out-Null

$webVideoDestination = Join-Path $heroAssetDirectory $webVideoName
$posterDestination = Join-Path $heroAssetDirectory $posterName
$masterDestination = Join-Path $originalDirectory $masterName
$soundDestination = Join-Path $cinematicDirectory 'amr-hero-soundtrack.m4a'

Copy-Item -LiteralPath $webVideoSource -Destination $webVideoDestination -Force
Copy-Item -LiteralPath $posterSource -Destination $posterDestination -Force
Copy-Item -LiteralPath $masterSource -Destination $masterDestination -Force

$sourceHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $masterSource).Hash
$preservedHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $masterDestination).Hash
if ($sourceHash -ne $preservedHash) {
  throw 'The preserved entrance master does not match the supplied source.'
}

if (Test-Path -LiteralPath $soundDestination -PathType Leaf) {
  Remove-Item -LiteralPath $soundDestination
}

$webDurationText = (& $ffprobe.Source -v error -show_entries format=duration -of 'default=noprint_wrappers=1:nokey=1' $webVideoDestination).Trim()
$webDuration = [double]::Parse($webDurationText, [Globalization.CultureInfo]::InvariantCulture)
$webDurationArgument = $webDuration.ToString('0.######', [Globalization.CultureInfo]::InvariantCulture)

$ffmpegArguments = @(
  '-hide_banner',
  '-loglevel', 'warning',
  '-i', $masterDestination,
  '-map', '0:a:0',
  '-vn',
  '-af', 'apad',
  '-t', $webDurationArgument,
  '-c:a', 'aac',
  '-b:a', '128k',
  '-ar', '48000',
  '-ac', '2',
  '-movflags', '+faststart',
  $soundDestination
)

& $ffmpeg.Source @ffmpegArguments
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $soundDestination -PathType Leaf)) {
  throw 'ffmpeg did not create the audio-only hero soundtrack.'
}

[PSCustomObject]@{
  WebVideo = $webVideoDestination
  Poster = $posterDestination
  PreservedMaster = $masterDestination
  PreservedMasterSha256 = $preservedHash
  Soundtrack = $soundDestination
} | Format-List
