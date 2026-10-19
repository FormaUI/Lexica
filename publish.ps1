<#
.SYNOPSIS
Bundles Lexica into the single minified file the NuGet package ships, packs the NuGet package, and packs the npm package.

.DESCRIPTION
Runs the gate first, so nothing unbuilt, untested or misformatted is packed, then writes both packages to artifacts/. Pushing them to a feed or a registry is left to the caller.

.EXAMPLE
./publish.ps1
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$nuget = Join-Path $root 'nuget'
$artifacts = Join-Path $root 'artifacts'

& (Join-Path $root 'build.ps1')

# dotnet finds global.json from the working directory up, so the SDK it pins applies from the package project's folder.
Write-Host 'Packing the NuGet package'
Push-Location $nuget
try {
    dotnet pack Forma.Lexica.csproj -c Release -nologo -o $artifacts
    if ($LASTEXITCODE -ne 0) {
        throw 'dotnet pack failed.'
    }
}
finally {
    Pop-Location
}

Write-Host 'Packing the npm package'
npm pack $root --pack-destination $artifacts
if ($LASTEXITCODE -ne 0) {
    throw 'npm pack failed.'
}

Get-ChildItem $artifacts -Include '*.nupkg', '*.tgz' -Recurse | ForEach-Object { Write-Host "Packed $($_.FullName)" }
