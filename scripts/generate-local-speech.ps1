# Run with Windows PowerShell and the installed English desktop voice.
param([string]$VoiceName='Microsoft Zira Desktop')
Add-Type -AssemblyName System.Speech
$taskProjectRoot=Split-Path $PSScriptRoot -Parent
$taskWords=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'speech-words.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$taskOutput=Join-Path $taskProjectRoot 'dist/assets/audio/synthesized'
New-Item -ItemType Directory -Path $taskOutput -Force | Out-Null
$taskSynth=New-Object System.Speech.Synthesis.SpeechSynthesizer
$taskSynth.SelectVoice($VoiceName)
$taskSynth.Rate=0
$taskManifest=[ordered]@{}
try {
 foreach($taskWord in $taskWords){
  $taskPath=Join-Path $taskOutput ($taskWord.id+'.wav')
  $taskSynth.SetOutputToWaveFile($taskPath)
  $taskSynth.Speak($taskWord.en)
  $taskSynth.SetOutputToNull()
  $taskManifest[$taskWord.id]=[ordered]@{src=('assets/audio/synthesized/'+$taskWord.id+'.wav');voice=$VoiceName;accent='us';kind='Local system synthesis'}
 }
 $taskJson=$taskManifest | ConvertTo-Json -Depth 4
 [IO.File]::WriteAllText((Join-Path $taskProjectRoot 'dist/synth-audio.js'),('const WORD_SYNTH_AUDIO = '+$taskJson+';'),(New-Object Text.UTF8Encoding($false)))
 Write-Output ('Generated '+$taskManifest.Count+' English word audio files.')
} finally { $taskSynth.Dispose() }
