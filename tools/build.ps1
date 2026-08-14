$ErrorActionPreference = 'Stop'
$blender = 'C:\Program Files\Blender Foundation\Blender 5.1\blender.exe'

python -m unittest discover -s tools -p "test_*.py"
if ($LASTEXITCODE -ne 0) { throw 'เทสคณิตศาสตร์ของ pipeline ไม่ผ่าน' }

& $blender --background --factory-startup --python tools/build_model.py
if ($LASTEXITCODE -ne 0) { throw 'build_model.py ล้มเหลว' }

python tools/verify_model.py
if ($LASTEXITCODE -ne 0) { throw 'verify_model.py ไม่ผ่าน' }

Write-Output 'pipeline ผ่านทั้งหมด'