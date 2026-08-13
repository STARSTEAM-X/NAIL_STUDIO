# Spike S1b — ทดสอบ TypeScript 7 และ Vite 8 แบบแยกตัวแปรทีละตัว
#
# S1 ตรึง TS 5.9 + Vite 7 ไว้โดยตั้งใจ เพื่อให้คำตอบเรื่อง React 19 + R3F v9 ชัดเจน
# S1b เปลี่ยนทีละตัวจากฐานเดียวกันนั้น ถ้าพังจะรู้ทันทีว่าตัวไหนเป็นสาเหตุ
#
# หมายเหตุ: @vitejs/plugin-react 6 ต้องใช้กับ Vite 8 (Rolldown) ส่วน 5 คู่กับ Vite 7
# การอัป Vite จึงพ่วงการอัป plugin เสมอ — แยกจากกันไม่ได้

$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot

$passes = @(
  @{ Name = 'A · TS7 + Vite7'; Ts = '7.0.2'; Vite = '^7.3.1'; Plugin = '^5.1.1' }
  @{ Name = 'B · TS5.9 + Vite8'; Ts = '^5.9.3'; Vite = '^8.2.1'; Plugin = '^6.0.5' }
  @{ Name = 'C · TS7 + Vite8'; Ts = '7.0.2'; Vite = '^8.2.1'; Plugin = '^6.0.5' }
)

$results = @()

foreach ($pass in $passes) {
  Write-Output ""
  Write-Output "==================== $($pass.Name) ===================="

  $pkg = [ordered]@{
    name         = 'spike-s1b'
    private      = $true
    version      = '0.0.0'
    type         = 'module'
    scripts      = [ordered]@{ build = 'vite build'; typecheck = 'tsc --noEmit' }
    dependencies = [ordered]@{
      '@react-three/drei'  = '^10.7.8'
      '@react-three/fiber' = '^9.7.0'
      'react'              = '^19.2.8'
      'react-dom'          = '^19.2.8'
      'three'              = '^0.185.1'
    }
    devDependencies = [ordered]@{
      '@types/react'         = '^19.2.7'
      '@types/react-dom'     = '^19.2.3'
      '@types/three'         = '^0.185.1'
      '@vitejs/plugin-react' = $pass.Plugin
      'typescript'           = $pass.Ts
      'vite'                 = $pass.Vite
    }
  }
  # ต้องเขียนแบบ UTF-8 ไม่มี BOM — Out-File -Encoding utf8 ของ Windows PowerShell 5.1
  # ใส่ BOM มาด้วย แล้ว PostCSS config loader ของ Vite ที่อ่าน package.json ผ่าน
  # JSON.parse จะพังด้วย "Unexpected token '﻿'" ซึ่งดูเหมือนบั๊กของ Vite
  # แต่จริง ๆ เป็นบั๊กของสคริปต์ที่สร้างไฟล์
  [System.IO.File]::WriteAllText(
    "$root\package.json",
    ($pkg | ConvertTo-Json -Depth 6),
    (New-Object System.Text.UTF8Encoding $false)
  )

  Remove-Item "$root\node_modules" -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item "$root\package-lock.json" -Force -ErrorAction SilentlyContinue

  $install = (npm install --prefix $root --no-fund --no-audit 2>&1 | Out-String)
  $installOk = $LASTEXITCODE -eq 0

  $tsVer = ''; $viteVer = ''
  if ($installOk) {
    $tsVer = (npx --prefix $root tsc --version 2>&1 | Out-String).Trim()
    $viteVer = (npx --prefix $root vite --version 2>&1 | Out-String).Trim()
  }

  Push-Location $root
  $typecheck = (npx tsc --noEmit 2>&1 | Out-String)
  $typecheckOk = $LASTEXITCODE -eq 0
  $build = (npx vite build 2>&1 | Out-String)
  $buildOk = $LASTEXITCODE -eq 0
  Pop-Location

  $results += [pscustomobject]@{
    Pass      = $pass.Name
    Install   = if ($installOk) { 'PASS' } else { 'FAIL' }
    TscVer    = $tsVer
    ViteVer   = $viteVer
    Typecheck = if ($typecheckOk) { 'PASS' } else { 'FAIL' }
    Build     = if ($buildOk) { 'PASS' } else { 'FAIL' }
  }

  if (-not $installOk)   { Write-Output "--- ข้อผิดพลาดตอน install ---`n$($install   | Select-Object -Last 30)" }
  if (-not $typecheckOk) { Write-Output "--- ข้อผิดพลาดตอน typecheck ---`n$typecheck" }
  if (-not $buildOk)     { Write-Output "--- ข้อผิดพลาดตอน build ---`n$build" }
}

Write-Output ""
Write-Output "==================== สรุป ===================="
$results | Format-Table -AutoSize | Out-String -Width 200
