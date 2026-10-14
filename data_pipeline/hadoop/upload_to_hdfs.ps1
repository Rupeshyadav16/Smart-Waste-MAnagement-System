param(
    [string]$InputPath = (Join-Path $PSScriptRoot "..\..\data\raw\waste_sensor_readings.csv"),
    [string]$HdfsPath = "/smart-waste/raw"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command hdfs -ErrorAction SilentlyContinue)) {
    throw "The Hadoop 'hdfs' command was not found. Start/configure Hadoop before uploading data."
}

if (-not (Test-Path -LiteralPath $InputPath)) {
    throw "Dataset not found: $InputPath. Run data_pipeline/generate_waste_dataset.py first."
}

hdfs dfs -mkdir -p $HdfsPath
hdfs dfs -put -f $InputPath "$HdfsPath/waste_sensor_readings.csv"
Write-Host "Uploaded $InputPath to $HdfsPath/waste_sensor_readings.csv"
