$ErrorActionPreference = 'Stop'
$taskRoot = Join-Path $PSScriptRoot 'language-data'
New-Item -ItemType Directory -Force -Path $taskRoot | Out-Null
$taskSources = @(
    @{ repo = 'RosaeNLG/rosaenlg'; branch = 'master'; files = @{
        'verbs.json' = 'packages/english-verbs-irregular/resources/irregularVerbs.json'
        'verbs-LICENSE.txt' = 'packages/english-verbs-irregular/LICENSE'
        'verbs-README.md' = 'packages/english-verbs-irregular/README.md'
    } },
    @{ repo = 'sindresorhus/irregular-plurals'; branch = 'main'; files = @{
        'plurals.json' = 'irregular-plurals.json'
        'plurals-LICENSE.txt' = 'license'
        'plurals-README.md' = 'readme.md'
    } }
)
$taskManifest = @()
foreach ($taskSource in $taskSources) {
    $taskCommit = Invoke-RestMethod -Uri ('https://api.github.com/repos/' + $taskSource.repo + '/commits/' + $taskSource.branch)
    foreach ($taskName in $taskSource.files.Keys) {
        $taskUrl = 'https://raw.githubusercontent.com/' + $taskSource.repo + '/' + $taskCommit.sha + '/' + $taskSource.files[$taskName]
        $taskDestination = Join-Path $taskRoot $taskName
        Invoke-WebRequest -Uri $taskUrl -OutFile $taskDestination
        $taskManifest += @{ file = $taskName; url = $taskUrl; sha256 = (Get-FileHash -LiteralPath $taskDestination -Algorithm SHA256).Hash.ToLowerInvariant() }
    }
}
$taskManifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $taskRoot 'sources.json') -Encoding utf8
Write-Output ('Downloaded ' + $taskManifest.Count + ' pinned data and license files.')
