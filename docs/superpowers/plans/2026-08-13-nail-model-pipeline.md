# ไปป์ไลน์โมเดลเล็บ (Slice 4 ส่วน A) — แผนลงมือ

> **สำหรับผู้ทำงานอัตโนมัติ:** ใช้ superpowers:subagent-driven-development (แนะนำ)
> หรือ superpowers:executing-plans ทำทีละ task ตามลำดับ แต่ละ step มี checkbox (`- [ ]`)
> ใช้ติดตามความคืบหน้า

**เป้าหมาย**: ทำให้สร้าง `hand.glb` ใหม่ได้จากภายใน repo นี้ ด้วยเล็บที่เปลี่ยนทรง/ความยาว
ได้ 7 morph target ต่อชิ้น UV กางใหม่แบบคงสัดส่วน และฝั่งเว็บเลือกทรง/ความยาวได้จริง
พร้อม undo/redo และแผงวาด 2 มิติที่ตามทรงที่เปลี่ยนไป

**สถาปัตยกรรม**: แยกคณิตศาสตร์ล้วน (`tools/nail_geometry.py`, เทสได้โดยไม่ต้องมี Blender)
ออกจากโค้ดที่ต้องมี Blender (`tools/build_shapes.py`, `tools/build_model.py`) ฝั่งเว็บมีชั้น
กลาง `nailMorph.ts`/`nailMorphs.ts` ที่ `nailViews.ts`, `nailFlatten.ts` และ store เรียกใช้
ร่วมกัน แทนที่จะกระจายตรรกะ morph ไปทุกที่

**สแตก**: Blender 5.1 (Python 3.12 + numpy, ติดตั้งในเครื่องแล้ว) · vitest · python `unittest`

**สเปก**: [docs/superpowers/specs/2026-08-13-nail-model-pipeline-design.md](../specs/2026-08-13-nail-model-pipeline-design.md)
— สเปกถูกแก้ 2 จุดระหว่างเขียนแผนนี้ (ค่า gate `g₀`/`TAPER_START` และ padding UV)
หลังเปิดโค้ด spike จริงแล้วพบว่าไม่ตรงกับที่จำมาตอนร่างสเปก แผนนี้เดินตามสเปกฉบับแก้ไขแล้ว

## Global Constraints

- ทุกสูตรดัดรูปทรง/ความยาวต้องคูณด้วย `taper_weight(t01)` (`TAPER_START = 0.45`,
  ยกกำลังสอง) — ห้ามมีสูตรใดขยับโคนเล็บ (สเปก §6)
- ชื่อ morph target ต้องเป็น `almond, square, squoval, stiletto, short, long, extra`
  เรียงลำดับนี้เป๊ะ ทุกที่ที่อ้างถึง (สเปก §4.1)
- ค่าตัวเลขของ `almond`/`stiletto` ยกจาก `spikes/s2-nail-shapes/make_shapes.py` ตรงตัว
  ห้ามปัดเศษหรือเปลี่ยนโดยไม่มีเหตุผลบันทึกไว้
- UV padding = `0.06` ให้ตรงกับ `PADDING` ใน `nailFlatten.ts` เป๊ะ
- ทุกไฟล์ python ใหม่ใช้ docstring/คอมเมนต์ภาษาไทยตามธรรมเนียมเดิมของ `tools/`
- ทุก Command ใหม่ (`SetShapeCommand`, `SetLengthCommand`) ต้องมี `merge()` และเข้า
  `HistoryStack` แบบเดียวกับ `SetFinishCommand` ทุกประการ

---

## Task 1: ย้ายไปป์ไลน์เข้า repo — ทำให้สร้าง `hand.glb` เดิมซ้ำได้ก่อน

เป้าหมายของ task นี้คือ **สร้างของเดิมซ้ำได้** ก่อน แล้วค่อยเพิ่มของใหม่ใน task ถัดไป
ถ้า task นี้พังคือพังที่โครงสร้าง ไม่ใช่ที่คณิตศาสตร์ใหม่ — แยกให้ชัดจะดีบักง่ายกว่า

**Files:**
- Create: `model/hand_source.glb` (คัดลอกจาก `Source/NailDesine-TEST/.worktrees/full-stack-nail-studio/model/hand_source.glb`, 11.2 MB)
- Create: `tools/build_model.py` (คัดลอกจาก `Source/NailDesine-TEST/.worktrees/full-stack-nail-studio/tools/build_model.py` ทั้งไฟล์ ไม่แก้ path เพราะ `ROOT`/`SRC_GLB`/`OUT_DIR` คำนวณจาก `__file__` อยู่แล้ว)
- Create: `tools/verify_model.py` (คัดลอกทั้งไฟล์เช่นกัน)
- Create: `tools/preview_render.py` (คัดลอกทั้งไฟล์)
- Create: `tools/build.ps1`:

```powershell
$ErrorActionPreference = 'Stop'
$blender = 'C:\Program Files\Blender Foundation\Blender 5.1\blender.exe'

python -m unittest discover -s tools -p "test_*.py"
if ($LASTEXITCODE -ne 0) { throw 'เทสคณิตศาสตร์ของ pipeline ไม่ผ่าน' }

& $blender --background --factory-startup --python tools/build_model.py
if ($LASTEXITCODE -ne 0) { throw 'build_model.py ล้มเหลว' }

python tools/verify_model.py
if ($LASTEXITCODE -ne 0) { throw 'verify_model.py ไม่ผ่าน' }

Write-Output 'pipeline ผ่านทั้งหมด'
```

- Modify: `package.json:14-25` — เพิ่มสอง script ใน `"scripts"`:

```json
    "build:model": "powershell -NoProfile -ExecutionPolicy Bypass -File tools/build.ps1",
    "verify:model": "python tools/verify_model.py",
```

**Interfaces:**
- Produces: `apps/web/public/models/hand.glb`, `apps/web/public/models/nails.meta.json`
  (เขียนทับของเดิม — task นี้ไม่เปลี่ยนเนื้อหาไฟล์เลย เพราะยังไม่เพิ่มโค้ดใหม่ใด ๆ)
- Produces: คำสั่ง `npm run build:model` และ `npm run verify:model` ที่ทุก task ถัดไปจะเรียก

- [ ] **Step 1: คัดลอกไฟล์**

```bash
mkdir -p model
cp "Source/NailDesine-TEST/.worktrees/full-stack-nail-studio/model/hand_source.glb" model/hand_source.glb
cp "Source/NailDesine-TEST/.worktrees/full-stack-nail-studio/tools/build_model.py" tools/build_model.py
cp "Source/NailDesine-TEST/.worktrees/full-stack-nail-studio/tools/verify_model.py" tools/verify_model.py
cp "Source/NailDesine-TEST/.worktrees/full-stack-nail-studio/tools/preview_render.py" tools/preview_render.py
```

- [ ] **Step 2: เขียน `tools/build.ps1` และเพิ่ม npm scripts ตามข้างบน**

- [ ] **Step 3: รันแล้วยืนยันว่าได้ของเดิมซ้ำ**

```bash
npm run build:model
npm run verify:model
```

Expected: ทั้งสองคำสั่งจบด้วย exit code 0, `verify:model` พิมพ์ `ผ่านทั้งหมด`,
ขนาด `hand.glb` ใกล้เคียงของเดิม (11.7 MB ± เล็กน้อยจาก non-determinism ของ export)

- [ ] **Step 4: commit**

```bash
git add model/hand_source.glb tools/build_model.py tools/verify_model.py tools/preview_render.py tools/build.ps1 package.json
git commit -m "chore: bring the nail model pipeline into this repo"
```

---

## Task 2: `tools/nail_geometry.py` — คณิตศาสตร์ล้วน พร้อมเทส

**Files:**
- Create: `tools/nail_geometry.py`
- Test: `tools/test_nail_geometry.py`

**Interfaces:**
- Produces: `local_frame(coords)`, `taper_weight(t01)`, `deform_delta(coords, target)`,
  `base_max_displacement(coords, target, base_fraction=0.1)`, `project_to_uv(coords, panel_size=1.0, padding=UV_PADDING)`,
  `triangle_distortion(position_tri, uv_tri)`, `max_uv_distortion(coords, uv, indices)`,
  ค่าคงที่ `FINGERS`, `SHAPE_TARGETS`, `LENGTH_TARGETS`, `ALL_TARGETS`, `TAPER_START`, `UV_PADDING`
- Consumes: numpy เท่านั้น ไม่ import bpy

- [ ] **Step 1: เขียนเทสทั้งไฟล์**

```python
# tools/test_nail_geometry.py
"""เทสของ tools/nail_geometry.py — รันด้วย python ปกติ ไม่ต้องเปิด Blender

python -m unittest tools/test_nail_geometry.py
"""
import unittest

import numpy as np

from nail_geometry import (
    TAPER_START,
    base_max_displacement,
    deform_delta,
    local_frame,
    max_uv_distortion,
    project_to_uv,
    triangle_distortion,
    taper_weight,
)


def rectangular_plate(width=1.0, length=2.0, steps_along=9, steps_across=3):
    """เล็บจำลอง: แผ่นสี่เหลี่ยมผืนผ้าแบนในระนาบ XY สัดส่วนใกล้เคียงเล็บจริง (ยาวกว่ากว้าง)"""
    xs = np.linspace(-width / 2, width / 2, steps_across)
    ys = np.linspace(-length / 2, length / 2, steps_along)
    return np.array([[x, y, 0.0] for y in ys for x in xs])


class LocalFrameTests(unittest.TestCase):
    def test_finds_long_axis_along_length(self):
        centroid, axes, t01, w, d, span = local_frame(rectangular_plate())
        self.assertAlmostEqual(abs(axes[0][1]), 1.0, places=6)
        self.assertAlmostEqual(t01.min(), 0.0, places=6)
        self.assertAlmostEqual(t01.max(), 1.0, places=6)
        self.assertAlmostEqual(span, 2.0, places=6)

    def test_tip_is_narrower_end(self):
        xs_wide = np.linspace(-1.0, 1.0, 5)
        xs_narrow = np.linspace(-0.2, 0.2, 5)
        coords = np.array(
            [[x, -1.0, 0.0] for x in xs_wide] + [[x, 1.0, 0.0] for x in xs_narrow],
        )
        _, _, t01, _, _, _ = local_frame(coords)
        tip_mask = t01 > 0.9
        self.assertTrue(np.all(coords[tip_mask][:, 1] > 0))


class TaperWeightTests(unittest.TestCase):
    def test_zero_before_taper_start(self):
        t01 = np.array([0.0, 0.2, 0.44, TAPER_START])
        np.testing.assert_allclose(taper_weight(t01), 0.0)

    def test_one_at_tip(self):
        self.assertAlmostEqual(float(taper_weight(np.array([1.0]))[0]), 1.0)

    def test_monotonic_between_start_and_tip(self):
        weights = taper_weight(np.linspace(TAPER_START, 1.0, 20))
        self.assertTrue(np.all(np.diff(weights) >= 0))


class DeformTests(unittest.TestCase):
    def setUp(self):
        self.coords = rectangular_plate()

    def test_every_shape_leaves_base_still(self):
        for shape in ('almond', 'square', 'squoval', 'stiletto'):
            self.assertLess(base_max_displacement(self.coords, shape), 1e-9, 'shape=%s' % shape)

    def test_every_length_leaves_base_still(self):
        for length in ('short', 'long', 'extra'):
            self.assertLess(base_max_displacement(self.coords, length), 1e-9, 'length=%s' % length)

    def test_stiletto_moves_tip_further_than_almond(self):
        reach_almond = np.linalg.norm(deform_delta(self.coords, 'almond'), axis=1).max()
        reach_stiletto = np.linalg.norm(deform_delta(self.coords, 'stiletto'), axis=1).max()
        self.assertGreater(reach_stiletto, reach_almond)

    def test_extra_length_moves_tip_more_than_short(self):
        reach_short = np.linalg.norm(deform_delta(self.coords, 'short'), axis=1).max()
        reach_extra = np.linalg.norm(deform_delta(self.coords, 'extra'), axis=1).max()
        self.assertGreater(reach_extra, reach_short)

    def test_unknown_target_raises(self):
        with self.assertRaises(ValueError):
            deform_delta(self.coords, 'hexagon')


class ProjectToUvTests(unittest.TestCase):
    def test_preserves_aspect_ratio_not_stretched_to_square(self):
        uv = project_to_uv(rectangular_plate(width=1.0, length=2.0))
        height = uv[:, 1].max() - uv[:, 1].min()
        width = uv[:, 0].max() - uv[:, 0].min()
        self.assertAlmostEqual(height / width, 2.0, places=1)

    def test_stays_within_unit_square_with_padding(self):
        uv = project_to_uv(rectangular_plate())
        self.assertGreaterEqual(uv[:, 0].min(), 0.0)
        self.assertGreaterEqual(uv[:, 1].min(), 0.0)
        self.assertLessEqual(uv[:, 0].max(), 1.0)
        self.assertLessEqual(uv[:, 1].max(), 1.0)

    def test_tip_maps_near_top_of_panel(self):
        # ฝั่งแคบ (y=+1) คือปลายเล็บ ต้องได้ v เล็กกว่าฝั่งโคน (ปลายเล็บอยู่บนสุดของแผง)
        xs_wide = np.linspace(-1.0, 1.0, 5)
        xs_narrow = np.linspace(-0.2, 0.2, 5)
        coords = np.array(
            [[x, -1.0, 0.0] for x in xs_wide] + [[x, 1.0, 0.0] for x in xs_narrow],
        )
        uv = project_to_uv(coords)
        tip_v = uv[5:, 1].mean()
        base_v = uv[:5, 1].mean()
        self.assertLess(tip_v, base_v)


class TriangleDistortionTests(unittest.TestCase):
    def test_identity_mapping_has_no_distortion(self):
        position = np.array([[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0]])
        uv = np.array([[0.0, 0.0], [1.0, 0.0], [0.0, 1.0]])
        self.assertAlmostEqual(triangle_distortion(position, uv), 1.0, places=6)

    def test_stretched_uv_reports_distortion_above_one(self):
        position = np.array([[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0]])
        uv = np.array([[0.0, 0.0], [0.5, 0.0], [0.0, 1.0]])
        self.assertAlmostEqual(triangle_distortion(position, uv), 2.0, places=6)

    def test_degenerate_triangle_returns_none(self):
        position = np.array([[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [2.0, 0.0, 0.0]])
        uv = np.array([[0.0, 0.0], [1.0, 0.0], [2.0, 0.0]])
        self.assertIsNone(triangle_distortion(position, uv))


class MaxUvDistortionTests(unittest.TestCase):
    def test_reports_worst_triangle_not_average(self):
        coords = np.array([[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [1.0, 1.0, 0.0]])
        good_uv = np.array([[0.0, 0.0], [1.0, 0.0], [0.0, 1.0], [1.0, 1.0]])
        bad_uv = np.array([[0.0, 0.0], [1.0, 0.0], [0.0, 1.0], [0.5, 1.0]])
        indices = [0, 1, 2, 1, 3, 2]
        self.assertAlmostEqual(max_uv_distortion(coords, good_uv, indices), 1.0, places=6)
        self.assertGreater(max_uv_distortion(coords, bad_uv, indices), 1.0)


if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 2: รันแล้วยืนยันว่าพังเพราะ `nail_geometry` ยังไม่มี**

```bash
python -m unittest tools/test_nail_geometry.py -v
```

Expected: `ModuleNotFoundError: No module named 'nail_geometry'`

- [ ] **Step 3: เขียน `tools/nail_geometry.py`**

```python
"""คณิตศาสตร์ล้วนของ pipeline โมเดลเล็บ — ไม่ import bpy จึงเทสได้ด้วย python ปกติ

ยกอัลกอริทึมมาจาก:
  - PCA + การดัดทรง: spikes/s2-nail-shapes/make_shapes.py (วัดผลแล้วว่าโคนเล็บไม่ขยับ
    ที่ TAPER_START = 0.45 — ห้ามเปลี่ยนค่านี้โดยไม่วัดผลใหม่)
  - แนวคิดการฉาย UV (คงสัดส่วน เว้นขอบ 0.06): apps/web/src/3d/painting/nailFlatten.ts
    ใช้แนวคิดเดียวกัน ไม่ใช่สูตรเดียวกันเป๊ะ — ที่นี่ใช้แกน PCA ส่วนฝั่งเว็บใช้ normal
    เฉลี่ย + แกนตั้งของโลก ทั้งสองประมาณผิวเล็บแบบเดียวกันแต่ไม่ใช่ฟังก์ชันเดียวกัน
    (ดู D-25 และหัวข้อ "ข้อจำกัดที่รู้ตัว" ในสเปกของงานนี้)

ทุกฟังก์ชันรับ/คืนค่าเป็น numpy array ธรรมดา
"""
import numpy as np

FINGERS = ('thumb', 'index', 'middle', 'ring', 'little')
SHAPE_TARGETS = ('almond', 'square', 'squoval', 'stiletto')
LENGTH_TARGETS = ('short', 'long', 'extra')
# ลำดับนี้ต้องตรงกับ extras.targetNames ที่ verify_model.py ตรวจ (ด่าน 4.1)
ALL_TARGETS = SHAPE_TARGETS + LENGTH_TARGETS

# ยกจาก spikes/s2-nail-shapes/make_shapes.py ตรงตัว — วัดผลแล้วว่าโคนเล็บไม่ขยับที่ค่านี้
TAPER_START = 0.45
# ยกจาก apps/web/src/3d/painting/nailFlatten.ts PADDING ตรงตัว
UV_PADDING = 0.06

LENGTH_K = {'short': 0.75, 'long': 1.30, 'extra': 1.60}


def local_frame(coords):
    """หาแกนหลักของเล็บด้วย PCA แล้วคืนพิกัดท้องถิ่น (t, w, d) ที่ normalize t แล้ว

    coords: (V, 3) ndarray

    คืนค่า: centroid (3,), axes (3,3) แถวคือ e0 (แกนยาว โคน→ปลาย) / e1 (แกนกว้าง) /
    e2 (แกนหนา), t01 (V,) ใน [0,1], w (V,) พิกัดจริงตามแกนกว้าง, d (V,) พิกัดจริง
    ตามแกนหนา, span (สเกลาร์) ความยาวจริงตามแกน e0 ก่อน normalize

    ใช้ eigh ไม่ใช่ eig เพราะเมทริกซ์ความแปรปรวนร่วมเป็น symmetric เสมอ — eigh เร็วกว่า
    และคืนค่าจริงเสมอ (eig อาจคืนจำนวนเชิงซ้อนจาก error การปัดเศษ)
    """
    centroid = coords.mean(axis=0)
    centered = coords - centroid
    covariance = centered.T @ centered / len(coords)
    eigenvalues, eigenvectors = np.linalg.eigh(covariance)
    order = np.argsort(eigenvalues)[::-1]
    axes = eigenvectors[:, order].T

    t = centered @ axes[0]
    w = centered @ axes[1]
    d = centered @ axes[2]

    # ปลายเล็บคือฝั่งที่แคบกว่า — เทียบความกว้างของ 25% แรกกับ 25% สุดท้าย
    span = t.max() - t.min()
    low = np.ptp(w[t < t.min() + span * 0.25])
    high = np.ptp(w[t > t.max() - span * 0.25])
    if low < high:
        t = -t
        axes[0] = -axes[0]

    t01 = (t - t.min()) / max(span, 1e-9)
    return centroid, axes, t01, w, d, span


def taper_weight(t01):
    """0 ตลอด 45% แรกจากโคนเล็บ → 1 ที่ปลาย แบบนุ่มนวล — ยกจาก make_shapes.py ตรงตัว"""
    raw = np.clip((t01 - TAPER_START) / (1.0 - TAPER_START), 0.0, 1.0)
    return raw * raw


def deform_shape(t01, w, d, span, shape):
    """ส่วนต่างของ (t, w, d) สำหรับทรงที่ระบุ — ค่าตัวเลขยกจาก make_shapes.py ตรงตัว"""
    g = taper_weight(t01)
    w_norm = np.abs(w) / max(np.abs(w).max(), 1e-9)
    zero = np.zeros_like(d)

    if shape == 'almond':
        return (1.0 - w_norm) * 0.10 * span * g, -w * 0.55 * g, zero
    if shape == 'stiletto':
        return (1.0 - w_norm) * 0.34 * span * g, -w * 0.85 * g, zero
    if shape == 'square':
        return w_norm * 0.11 * span * g, w * 0.18 * g, zero
    if shape == 'squoval':
        return w_norm * 0.055 * span * g, w * 0.06 * g, zero
    raise ValueError('ไม่รู้จักทรง %s' % shape)


def deform_length(t01, span, length):
    """ส่วนต่างของ t สำหรับความยาวที่ระบุ — โคนนิ่งสนิท ปลายขยับเต็มตาม k

    w และ d ไม่เปลี่ยน (ความยาวไม่บิดความกว้าง/ความหนา)
    """
    g = taper_weight(t01)
    return (LENGTH_K[length] - 1.0) * span * g


def deform_delta(coords, target):
    """ส่วนต่างตำแหน่งเต็มรูป (V, 3) ของ target หนึ่งอัน (ทรงหรือความยาว)"""
    _, axes, t01, w, d, span = local_frame(coords)
    if target in SHAPE_TARGETS:
        dt, dw, dd = deform_shape(t01, w, d, span, target)
    elif target in LENGTH_TARGETS:
        dt = deform_length(t01, span, target)
        dw = np.zeros_like(dt)
        dd = np.zeros_like(dt)
    else:
        raise ValueError('ไม่รู้จัก target %s' % target)
    return np.outer(dt, axes[0]) + np.outer(dw, axes[1]) + np.outer(dd, axes[2])


def base_max_displacement(coords, target, base_fraction=0.1):
    """ระยะขยับสูงสุดของ vertex ในช่วง base_fraction แรกจากโคนเล็บ — ใช้เป็นด่านตรวจ 4.2"""
    _, _, t01, _, _, _ = local_frame(coords)
    delta = deform_delta(coords, target)
    mask = t01 <= base_fraction
    if not np.any(mask):
        return 0.0
    return float(np.linalg.norm(delta[mask], axis=1).max())


def project_to_uv(coords, panel_size=1.0, padding=UV_PADDING):
    """ฉายจุดยอดของเล็บลงกรอบ UV 0-1 แบบคงสัดส่วน

    คืน (V, 2) ndarray พิกัด (u, v) โดย v ≈ 0 คือปลายเล็บ (บนสุดของแผง เมื่อวาดเป็นรูป)
    ค่า v นี้คือ "พิกัดพิกเซล/แผง" ไม่ใช่ mesh UV ดิบ — ตอนเขียนลง mesh UV จริงต้องกลับด้าน
    (`1 − v`) ให้ตรงกับที่ nailFlatten.ts อ่านกลับ (ดู tools/build_model.py::reunwrap_nails)
    """
    centroid, axes, _, _, _, _ = local_frame(coords)
    e0, e1 = axes[0], axes[1]  # e0 = แกนยาว (โคน→ปลาย) · e1 = แกนกว้าง
    x = (coords - centroid) @ e1                 # กว้าง -> แนวนอนของแผง
    y = -((coords - centroid) @ e0)               # ยาว -> แนวตั้ง ปลายเล็บอยู่ v เล็ก

    span_x = max(x.max() - x.min(), 1e-9)
    span_y = max(y.max() - y.min(), 1e-9)
    usable = panel_size * (1 - padding * 2)
    scale = min(usable / span_x, usable / span_y)
    width = span_x * scale
    height = span_y * scale
    offset_x = (panel_size - width) / 2
    offset_y = (panel_size - height) / 2

    u = offset_x + (x - x.min()) * scale
    v = offset_y + (y - y.min()) * scale
    return np.column_stack([u, v])


def triangle_distortion(position_tri, uv_tri):
    """อัตราส่วนการยืด σmax/σmin ของสามเหลี่ยมหนึ่งชิ้น ระหว่างผิวจริงกับ UV

    ฉายสามเหลี่ยม 3 มิติลงระนาบของตัวเองก่อน (เพื่อเทียบ 2 มิติกับ 2 มิติ) แล้วหา
    เมทริกซ์ affine ที่พา UV ไปเป็นตำแหน่งบนผิว คืนอัตราส่วนค่าเอกฐานมากสุด/น้อยสุด
    คืน None ถ้าสามเหลี่ยมแบนจนไม่มีพื้นที่ (บนผิวจริงหรือบน UV ก็ตาม)
    """
    p0, p1, p2 = position_tri
    e1_3d, e2_3d = p1 - p0, p2 - p0
    normal = np.cross(e1_3d, e2_3d)
    area2 = np.linalg.norm(normal)
    if area2 < 1e-12:
        return None
    basis_x = e1_3d / np.linalg.norm(e1_3d)
    basis_y = np.cross(normal / area2, basis_x)
    position_2d = np.array([
        [0.0, 0.0],
        [e1_3d @ basis_x, e1_3d @ basis_y],
        [e2_3d @ basis_x, e2_3d @ basis_y],
    ])

    uv0, uv1, uv2 = uv_tri
    uv_delta = np.array([uv1 - uv0, uv2 - uv0])
    pos_delta = np.array([position_2d[1] - position_2d[0], position_2d[2] - position_2d[0]])
    if abs(np.linalg.det(uv_delta)) < 1e-12:
        return None
    jacobian = np.linalg.solve(uv_delta, pos_delta).T
    singular_values = np.linalg.svd(jacobian, compute_uv=False)
    if singular_values[-1] < 1e-12:
        return None
    return float(singular_values[0] / singular_values[-1])


def max_uv_distortion(coords, uv, indices):
    """ค่าความบิด UV สูงสุดในทุกสามเหลี่ยมของเล็บชิ้นหนึ่ง — ใช้เป็นด่านตรวจ 4.3"""
    worst = 0.0
    for offset in range(0, len(indices), 3):
        a, b, c = indices[offset], indices[offset + 1], indices[offset + 2]
        distortion = triangle_distortion(coords[[a, b, c]], uv[[a, b, c]])
        if distortion is not None and distortion > worst:
            worst = distortion
    return worst
```

- [ ] **Step 4: รันแล้วยืนยันว่าผ่านหมด**

```bash
python -m unittest tools/test_nail_geometry.py -v
```

Expected: ทุกเทสผ่าน (18 เทส)

- [ ] **Step 5: commit**

```bash
git add tools/nail_geometry.py tools/test_nail_geometry.py
git commit -m "feat: add pure-math nail geometry (PCA deform + UV projection)"
```

---

## Task 3: `build_shapes.py` + แบ่งย่อย/กาง UV ใหม่/สร้าง shape key ใน `build_model.py`

Task นี้ต้องเปิด Blender จริง ไม่มีเทสอัตโนมัติ (นี่คือเหตุผลที่ task 1-2 ทำให้คณิตศาสตร์
ผ่านการตรวจแบบอัตโนมัติไปก่อนแล้ว) ยืนยันผลด้วยการอ่าน log และ task 4 (ด่านตรวจไฟล์)

**Files:**
- Create: `tools/build_shapes.py`
- Modify: `tools/build_model.py` — เพิ่มฟังก์ชันและเรียกใน `main()`

**Interfaces:**
- Consumes: `nail_geometry.ALL_TARGETS`, `.deform_delta`, `.base_max_displacement`,
  `.project_to_uv`, `.max_uv_distortion` (จาก task 2)
- Produces: `hand.glb` ที่มี shape key 7 อันต่อเล็บ และ UV กางใหม่

- [ ] **Step 1: เขียน `tools/build_shapes.py`**

```python
"""สร้าง shape key (morph target) 7 อันต่อเล็บ — ต้องรันใน Blender เท่านั้น

เรียกจาก tools/build_model.py หลังแบ่งย่อยและกาง UV ใหม่เสร็จแล้วเท่านั้น ไม่ใช่สคริปต์
ที่รันเดี่ยว: shape key ผูกกับจำนวน vertex ของ mesh ณ ตอนสร้าง ถ้าสร้างก่อนแบ่งย่อย
morph ทั้งชุดจะอ้างจุดที่ไม่มีอยู่แล้วหลังแบ่งย่อย
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nail_geometry import ALL_TARGETS, base_max_displacement, deform_delta


def add_shape_keys(obj, log):
    mesh = obj.data
    count = len(mesh.vertices)
    coords = np.empty(count * 3, dtype=np.float64)
    mesh.vertices.foreach_get('co', coords)
    coords = coords.reshape(count, 3)

    if mesh.shape_keys is None:
        obj.shape_key_add(name='Basis', from_mix=False)

    peak = 0.0
    for target in ALL_TARGETS:
        base_moved = base_max_displacement(coords, target)
        if base_moved >= 1e-6:
            raise RuntimeError(
                '%s target %s: โคนเล็บขยับ %.9f เมตร (ต้อง < 1e-6)'
                % (obj.name, target, base_moved),
            )
        delta = deform_delta(coords, target)
        peak = max(peak, float(np.linalg.norm(delta, axis=1).max()))
        key = obj.shape_key_add(name=target, from_mix=False)
        key.data.foreach_set('co', (coords + delta).reshape(-1))
        key.value = 0.0

    log('SHAPES: %-7s verts=%-4d ขยับสูงสุด=%6.3fมม. targets=%d'
        % (obj.name, count, peak * 1000, len(ALL_TARGETS)))
```

- [ ] **Step 2: เพิ่มฟังก์ชันใหม่ใน `tools/build_model.py`**

เพิ่ม import ที่หัวไฟล์ (ถัดจาก `from nail_unwrap import FINGERS` เดิม — ลบบรรทัดนั้นทิ้ง
เพราะ `nail_geometry.FINGERS` ใช้แทนได้ และ `nail_unwrap.py` ไม่มีอะไรอื่นให้ใช้แล้ว):

```python
from nail_geometry import ALL_TARGETS, max_uv_distortion, project_to_uv
from build_shapes import add_shape_keys
```

เพิ่มค่าคงที่ถัดจาก `THUMB_ROLL`:

```python
MIN_NAIL_VERTS = 300
MAX_SUBDIVIDE_LEVELS = 2
```

เพิ่มฟังก์ชันใหม่สามอัน แทรกไว้ก่อน `def rename_meshes():`:

```python
def subdivide_nails():
    """แบ่งย่อยเล็บทุกชิ้นให้มีอย่างน้อย MIN_NAIL_VERTS verts

    Nail_index มีแค่ 81 verts จากต้นทาง (S2 §6) ซึ่งไม่พอสำหรับมุมคมของทรง square/stiletto
    ใช้ subdivide_edges แบบไม่ปัดมน (use_smooth=0.0) เพื่อไม่ขยับตำแหน่งจุดเดิมแม้แต่จุดเดียว
    — จุดใหม่ถูกแทรกกลางขอบเดิมเป๊ะ ทรงของเล็บจึงไม่เปลี่ยนก่อนเข้าขั้นดัดทรง
    """
    for finger, source in NAIL_SRC.items():
        obj = bpy.data.objects[source]
        mesh = bmesh.new()
        mesh.from_mesh(obj.data)
        before = len(mesh.verts)
        levels = 0
        while len(mesh.verts) < MIN_NAIL_VERTS and levels < MAX_SUBDIVIDE_LEVELS:
            bmesh.ops.subdivide_edges(
                mesh, edges=mesh.edges, cuts=1, use_grid_fill=True, use_smooth=0.0,
            )
            levels += 1
        mesh.to_mesh(obj.data)
        mesh.free()
        obj.data.update()
        print('SUBDIVIDE: %-7s %d -> %d verts (%d level%s)'
              % (finger, before, len(obj.data.vertices), levels, '' if levels == 1 else 's'))


def reunwrap_nails():
    """กาง UV ใหม่ทุกเล็บด้วย nail_geometry.project_to_uv แทน UV เดิมของโมเดลต้นทาง

    UV เดิมกางเต็ม 0-1 แต่ยืดรูปเล็บให้เป็นจัตุรัส (D-25) — เขียนทับด้วยการฉายที่คงสัดส่วน
    ต้องทำ**หลัง**แบ่งย่อยเสมอ ไม่งั้นจุดที่เพิ่มมาจะไม่มี UV

    เขียน (1 − v) ไม่ใช่ v ตรง ๆ: project_to_uv คืนค่าในพิกัด "แผง/พิกเซล" ที่ v ≈ 0
    คือปลายเล็บ ส่วน nailFlatten.ts อ่าน mesh UV ดิบแล้วกลับด้วย (1 − v) เป็นพิกัดพิกเซล
    เอง (ดูฟังก์ชัน flattenNail) การเขียนกลับด้านตั้งแต่ตรงนี้จึงทำให้สองฝั่งตรงกัน —
    **ถ้าเรนเดอร์แล้วเล็บดูหัวกลับ (ปลายเล็บอยู่ล่าง) ให้ลองตัด `1.0 -` ออกแล้วรันใหม่**
    """
    for finger, source in NAIL_SRC.items():
        obj = bpy.data.objects[source]
        mesh = obj.data
        count = len(mesh.vertices)
        coords = np.empty(count * 3, dtype=np.float64)
        mesh.vertices.foreach_get('co', coords)
        coords = coords.reshape(count, 3)
        uv = project_to_uv(coords)

        uv_layer = mesh.uv_layers.active or mesh.uv_layers.new(name='UVMap')
        for loop in mesh.loops:
            u, v = uv[loop.vertex_index]
            uv_layer.data[loop.index].uv = (float(u), 1.0 - float(v))
        mesh.update()

        indices = [loop.vertex_index for loop in mesh.loops]
        distortion = max_uv_distortion(coords, uv, indices)
        print('UNWRAP: %-7s UV บิดสูงสุด %.3f' % (finger, distortion))


def build_shapes():
    """สร้าง shape key 7 อันต่อเล็บ — เรียกหลังแบ่งย่อยและกาง UV เสร็จแล้วเสมอ"""
    for finger, source in NAIL_SRC.items():
        add_shape_keys(bpy.data.objects[source], print)
```

แก้ `main()` — เดิมคือ

```python
def main():
    reset_scene()
    _hand, rig = import_and_clean()
    report_facings(rig)
    roll_thumb(rig, THUMB_ROLL)
    fix_nail_normals(_hand)
    drop_actions(rig)
    keep_rig(rig)
    rename_meshes()
```

เปลี่ยนเป็น (แทรกสามบรรทัดใหม่ระหว่าง `fix_nail_normals` กับ `drop_actions` —
ลำดับนี้ตายตัวตามที่สเปกกำหนด: ซ่อม normal ก่อนเสมอ เพราะ `fix_nail_normals` กลับ
ลำดับจุดของหน้า ซึ่งจะทำให้ delta ของ shape key ที่สร้างไว้ก่อนหน้าชี้ผิดตัว):

```python
def main():
    reset_scene()
    _hand, rig = import_and_clean()
    report_facings(rig)
    roll_thumb(rig, THUMB_ROLL)
    fix_nail_normals(_hand)
    subdivide_nails()
    reunwrap_nails()
    build_shapes()
    drop_actions(rig)
    keep_rig(rig)
    rename_meshes()
```

แก้ `export_scene.gltf(...)` ให้ส่ง morph ออกไปด้วย — เพิ่มสองบรรทัดในอาร์กิวเมนต์:

```python
        export_morph=True,
        export_morph_normal=True,
```

ลบไฟล์ที่ไม่ใช้แล้ว: `tools/nail_unwrap.py` (ฟังก์ชันเดียวที่มีคือ `FINGERS` ซึ่งย้ายไป
`nail_geometry.py` แล้ว) และ `tools/test_nail_unwrap.py` ถ้าคัดลอกมาด้วยใน task 1
(ไฟล์นี้ไม่ได้อยู่ในรายการคัดลอกของ task 1 อยู่แล้ว ให้ตรวจว่าไม่มีการอ้างอิงเหลือ)

- [ ] **Step 3: รันไปป์ไลน์เต็ม แล้วอ่าน log ทุกบรรทัด**

```bash
npm run build:model
```

Expected: เห็นบรรทัด `SUBDIVIDE:`, `UNWRAP:`, `SHAPES:` ครบทั้ง 5 เล็บ ไม่มี exception
ตรวจด้วยตา:
- `SUBDIVIDE` — `Nail_Index` (81 verts) ควรขึ้นเป็นอย่างน้อย 300
- `UNWRAP` — บันทึกค่าความบิดที่วัดได้จริงไว้ (จะใช้เทียบกับด่าน 4.3 ใน task 4)
- `SHAPES` — ครบ 7 targets ทุกเล็บ ไม่มี `RuntimeError` เรื่องโคนเล็บขยับ

ถ้า `RuntimeError` เรื่องโคนเล็บขยับเกิดขึ้น: มักมาจากการแบ่งย่อยที่ทำให้ vertex ใหม่
ตกอยู่ใน "โคนเล็บ" พอดีแล้วมีตำแหน่งที่ `local_frame` คำนวณ `t01` ต่างจากที่คาด —
ตรวจ `MIN_NAIL_VERTS`/`MAX_SUBDIVIDE_LEVELS` และพิจารณาลดจำนวนระดับการแบ่งย่อย

- [ ] **Step 4: commit**

```bash
git rm tools/nail_unwrap.py
git add tools/build_shapes.py tools/build_model.py apps/web/public/models/hand.glb apps/web/public/models/nails.meta.json
git commit -m "feat: subdivide nails, re-unwrap UV, and bake 7 shape keys per nail"
```

---

## Task 4: ด่านตรวจใหม่ใน `verify_model.py`

**Files:**
- Modify: `tools/verify_model.py`

**Interfaces:**
- Consumes: `hand.glb` ที่สร้างจาก task 3

- [ ] **Step 1: เพิ่มด่านตรวจ**

เพิ่มค่าคงที่ถัดจาก `NAIL_BONES`:

```python
TARGET_NAMES = ('almond', 'square', 'squoval', 'stiletto', 'short', 'long', 'extra')
MAX_UV_DISTORTION = 1.15
```

เพิ่มฟังก์ชันตรวจใหม่ (แทรกก่อน `def main():`):

```python
def check_morphs(gltf, names, check):
    """ด่าน 4.1 — morph ครบ 7 ต่อเล็บ ชื่อตรงเรียงลำดับเป๊ะ"""
    for wanted in NAILS:
        hits = [index for index, name in enumerate(names) if name == wanted + '_Mesh']
        if not hits:
            continue
        mesh = gltf['meshes'][hits[0]]
        primitive = mesh['primitives'][0]
        target_names = primitive.get('extras', {}).get('targetNames', [])
        check(
            tuple(target_names) == TARGET_NAMES,
            '%s มี morph target ครบ 7 อัน เรียงลำดับถูก (พบ: %s)' % (wanted, target_names),
        )


def check_base_still(buffer, gltf, binary_offset, names, check):
    """ด่าน 4.2 — โคนเล็บ (10% แรกตามแกน PCA) ต้องไม่ขยับในทุก target

    ใช้ nail_geometry ตัวเดียวกับที่ build_shapes.py ใช้สร้าง shape key — ด่านนี้จึง
    ตรวจว่าไฟล์ที่ export ออกมาตรงกับสิ่งที่ควรจะเป็น ไม่ใช่แค่เชื่อว่า build ทำถูก
    """
    for wanted in NAILS:
        hits = [index for index, name in enumerate(names) if name == wanted + '_Mesh']
        if not hits:
            continue
        mesh = gltf['meshes'][hits[0]]
        primitive = mesh['primitives'][0]
        attributes = primitive['attributes']
        base_position = accessor(buffer, gltf, binary_offset, attributes['POSITION'])
        targets = primitive.get('targets', [])
        target_names = primitive.get('extras', {}).get('targetNames', [])
        base = np.array(base_position)
        for target_name, target in zip(target_names, targets):
            if 'POSITION' not in target:
                continue
            morphed = base + np.array(accessor(buffer, gltf, binary_offset, target['POSITION']))
            _, _, t01, _, _, _ = local_frame(base)
            mask = t01 <= 0.1
            if not np.any(mask):
                continue
            displacement = float(np.linalg.norm((morphed - base)[mask], axis=1).max())
            check(
                displacement < 1e-6,
                '%s target %s: โคนเล็บขยับ %.9f ม. (< 1e-6)' % (wanted, target_name, displacement),
            )


def check_uv_distortion(buffer, gltf, binary_offset, names, check):
    """ด่าน 4.3 — ความบิด UV สูงสุดต้อง ≤ MAX_UV_DISTORTION (เกณฑ์ตั้งไว้ล่วงหน้า ห้ามขยับให้พอดีผล)"""
    for wanted in NAILS:
        hits = [index for index, name in enumerate(names) if name == wanted + '_Mesh']
        if not hits:
            continue
        mesh = gltf['meshes'][hits[0]]
        primitive = mesh['primitives'][0]
        attributes = primitive['attributes']
        position = np.array(accessor(buffer, gltf, binary_offset, attributes['POSITION']))
        uv = np.array(accessor(buffer, gltf, binary_offset, attributes['TEXCOORD_0']))
        indices = [item[0] for item in accessor(buffer, gltf, binary_offset, primitive['indices'])]
        distortion = max_uv_distortion(position, uv, indices)
        check(
            distortion <= MAX_UV_DISTORTION,
            '%s ความบิด UV %.3f ≤ %.2f' % (wanted, distortion, MAX_UV_DISTORTION),
        )


def check_skin_weights_sum(buffer, gltf, binary_offset, names, check):
    """ด่าน 4.4 — น้ำหนัก skin ของทุก vertex ยังรวมเป็น 1 หลังแบ่งย่อย"""
    for wanted in NAILS:
        hits = [index for index, name in enumerate(names) if name == wanted + '_Mesh']
        if not hits:
            continue
        mesh = gltf['meshes'][hits[0]]
        primitive = mesh['primitives'][0]
        attributes = primitive['attributes']
        if 'WEIGHTS_0' not in attributes:
            continue
        weights = accessor(buffer, gltf, binary_offset, attributes['WEIGHTS_0'])
        worst = max(abs(sum(row) - 1.0) for row in weights)
        check(worst < 1e-4, '%s น้ำหนัก skin รวมเป็น 1 ทุกจุด (คลาดสูงสุด %.6f)' % (wanted, worst))
```

เพิ่ม import ที่หัวไฟล์:

```python
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nail_geometry import local_frame, max_uv_distortion
```

เรียกด่านใหม่ใน `main()` — แทรกหลังบรรทัด `check_skin(buffer, gltf, binary_offset, check)`:

```python
    check_morphs(gltf, names, check)
    check_base_still(buffer, gltf, binary_offset, names, check)
    check_uv_distortion(buffer, gltf, binary_offset, names, check)
    check_skin_weights_sum(buffer, gltf, binary_offset, names, check)
```

- [ ] **Step 2: รัน**

```bash
npm run verify:model
```

Expected: ผ่านทั้งหมด **ยกเว้นบางทีด่านความบิด UV อาจไม่ผ่านที่ 1.15** — ถ้าไม่ผ่าน
ให้บันทึกค่าจริงที่วัดได้ (พิมพ์อยู่ในผลของ `check_uv_distortion` อยู่แล้ว) ลง
`docs/superpowers/specs/2026-08-13-nail-model-pipeline-design.md` §4.3 ตามกฎที่สเปกวางไว้
("ห้ามขยับเกณฑ์ให้พอดีกับผลลัพธ์") **ไม่ใช่แก้ `MAX_UV_DISTORTION` ให้ผ่านเงียบ ๆ**
ถ้าเกินมาก (> 1.3) ให้พิจารณาทางเลือกที่สอง (LSCM/ABF ของ Blender) ตามที่สเปก §5 ระบุไว้
ก่อนไปต่อ task ถัดไป

- [ ] **Step 3: commit**

```bash
git add tools/verify_model.py
git commit -m "test: add morph, base-displacement, UV-distortion, and skin-weight gates"
```

---

## Task 5: วัด M0 ใหม่ + บันทึกใน `performance.md`

**Files:**
- Modify: `docs/performance.md`

**Interfaces:**
- Consumes: `hand.glb` จาก task 3, dev server ของ `apps/web`

- [ ] **Step 1: เปิดเว็บแล้ววัดค่าเดียวกับที่ M0 เดิมวัดไว้**

เปิด `npm run dev --workspace apps/web` แล้วเข้าหน้า editor อ่านค่าจาก browser console:

```js
renderer.info.render.triangles
```

เทียบกับ M0 เดิม (121,956 tris) — ค่าควรเพิ่มขึ้นเล็กน้อยจากการแบ่งย่อยเล็บ (task 3)

- [ ] **Step 2: เพิ่มหัวข้อ M5 ต่อจาก M4 ใน `docs/performance.md`** ตามรูปแบบเดียวกับ M0/M4
  ที่มีอยู่แล้ว (สภาพแวดล้อม/วิธีวัด → ผลที่วัดได้ → ข้อจำกัด) ระบุชัดว่าเลขนี้แทนที่ M0
  เพราะอะไร (แบ่งย่อยเล็บเพิ่มจำนวนสามเหลี่ยม) ไม่ใช่การลบเลขเก่าทิ้ง

- [ ] **Step 3: commit**

```bash
git add docs/performance.md
git commit -m "docs: remeasure triangle baseline after nail subdivision"
```

---

## Task 6: `nailMorph.ts` — ตำแหน่ง/normal ที่รวม morph แล้ว พร้อมเทส

**Files:**
- Create: `apps/web/src/3d/scene/nailMorph.ts`
- Test: `apps/web/src/3d/scene/nailMorph.test.ts`

**Interfaces:**
- Produces: `morphedPosition(mesh: Mesh, index: number, out: Vector3): Vector3`,
  `morphedNormal(mesh: Mesh, index: number, out: Vector3): Vector3`
- Consumes: `three` (`Mesh`, `Vector3`, `BufferAttribute`, `BufferGeometry`)

- [ ] **Step 1: เขียนเทส**

```typescript
// apps/web/src/3d/scene/nailMorph.test.ts
import { describe, expect, it } from 'vitest'
import { BufferAttribute, BufferGeometry, Mesh, Vector3 } from 'three'
import { morphedNormal, morphedPosition } from './nailMorph.ts'

function meshWithOneMorphTarget(): Mesh {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([
    0, 0, 0, 1, 0, 0,
  ]), 3))
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array([
    0, 0, 1, 0, 0, 1,
  ]), 3))
  geometry.morphAttributes.position = [
    new BufferAttribute(new Float32Array([0, 0, 0, 0, 5, 0]), 3),
  ]
  geometry.morphAttributes.normal = [
    new BufferAttribute(new Float32Array([0, 0, 0, 0, 1, 0]), 3),
  ]
  const mesh = new Mesh(geometry)
  mesh.morphTargetInfluences = [0]
  return mesh
}

describe('morphedPosition', () => {
  it('คืนตำแหน่งฐานตรง ๆ เมื่อ influence เป็นศูนย์', () => {
    const mesh = meshWithOneMorphTarget()
    const out = morphedPosition(mesh, 1, new Vector3())
    expect(out.toArray()).toEqual([1, 0, 0])
  })

  it('บวก delta ตาม influence เมื่อเปิด target', () => {
    const mesh = meshWithOneMorphTarget()
    mesh.morphTargetInfluences![0] = 1
    const out = morphedPosition(mesh, 1, new Vector3())
    expect(out.toArray()).toEqual([1, 5, 0])
  })

  it('คูณ delta ตามน้ำหนัก influence เศษส่วน', () => {
    const mesh = meshWithOneMorphTarget()
    mesh.morphTargetInfluences![0] = 0.5
    const out = morphedPosition(mesh, 1, new Vector3())
    expect(out.toArray()).toEqual([1, 2.5, 0])
  })

  it('ไม่พังเมื่อ mesh ไม่มี morph เลย', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array([1, 2, 3]), 3))
    const mesh = new Mesh(geometry)
    const out = morphedPosition(mesh, 0, new Vector3())
    expect(out.toArray()).toEqual([1, 2, 3])
  })
})

describe('morphedNormal', () => {
  it('บวก delta ของ normal ตาม influence', () => {
    const mesh = meshWithOneMorphTarget()
    mesh.morphTargetInfluences![0] = 1
    const out = morphedNormal(mesh, 1, new Vector3())
    expect(out.toArray()).toEqual([0, 1, 1])
  })
})
```

- [ ] **Step 2: รันแล้วยืนยันว่าพัง**

```bash
cd apps/web && npx vitest run src/3d/scene/nailMorph.test.ts
```

Expected: หาไฟล์ `./nailMorph.ts` ไม่เจอ

- [ ] **Step 3: เขียน `apps/web/src/3d/scene/nailMorph.ts`**

```typescript
import type { BufferAttribute, Mesh, Vector3 } from 'three'

/**
 * ตำแหน่ง/normal ของจุดยอดหนึ่งจุด **รวมผลของ morph target ที่เปิดอยู่แล้ว**
 *
 * three.js ไม่มีฟังก์ชันสำเร็จรูปให้อ่านค่าที่รวม morph แล้วจาก CPU (การรวมเกิดบน GPU
 * ตอนวาดเท่านั้น) โค้ดที่ต้องรู้ตำแหน่งจริงของเล็บฝั่ง CPU — nailViews.ts (จ่อกล้อง)
 * และ nailFlatten.ts (คลี่ผิวให้แผงวาด 2 มิติ) — จึงต้องรวมเองตรงนี้ ไม่งั้นทั้งสอง
 * จะอ่านทรงฐาน (round) เสมอ ไม่ว่าผู้ใช้จะเลือกทรงอะไรไว้จริง
 */
export function morphedPosition(mesh: Mesh, index: number, out: Vector3): Vector3 {
  out.fromBufferAttribute(mesh.geometry.getAttribute('position') as BufferAttribute, index)
  addMorphDelta(mesh.geometry.morphAttributes.position, mesh.morphTargetInfluences, index, out)
  return out
}

export function morphedNormal(mesh: Mesh, index: number, out: Vector3): Vector3 {
  out.fromBufferAttribute(mesh.geometry.getAttribute('normal') as BufferAttribute, index)
  addMorphDelta(mesh.geometry.morphAttributes.normal, mesh.morphTargetInfluences, index, out)
  return out
}

function addMorphDelta(
  targets: BufferAttribute[] | undefined,
  influences: number[] | undefined,
  index: number,
  out: Vector3,
): void {
  if (!targets || !influences) return
  for (let target = 0; target < influences.length; target += 1) {
    const weight = influences[target]
    if (!weight) continue
    const delta = targets[target]
    if (!delta) continue
    out.x += delta.getX(index) * weight
    out.y += delta.getY(index) * weight
    out.z += delta.getZ(index) * weight
  }
}
```

- [ ] **Step 4: รันแล้วยืนยันว่าผ่าน**

```bash
cd apps/web && npx vitest run src/3d/scene/nailMorph.test.ts
```

Expected: 5 เทสผ่าน

- [ ] **Step 5: commit**

```bash
git add apps/web/src/3d/scene/nailMorph.ts apps/web/src/3d/scene/nailMorph.test.ts
git commit -m "feat: read CPU-side vertex positions with morph targets applied"
```

---

## Task 7: แก้ `nailViews.ts` และ `nailFlatten.ts` ให้ใช้ตำแหน่งที่รวม morph แล้ว

**Files:**
- Modify: `apps/web/src/3d/scene/nailViews.ts`
- Modify: `apps/web/src/3d/painting/nailFlatten.ts`
- Modify: `apps/web/src/3d/painting/nailFlatten.test.ts` — เพิ่มเทสพิสูจน์ว่า morph มีผล

**Interfaces:**
- Consumes: `morphedPosition`, `morphedNormal` จาก task 6

- [ ] **Step 1: เขียนเทสที่พิสูจน์ว่า `flattenNail` เปลี่ยนตาม morph — เพิ่มใน `nailFlatten.test.ts`**

เพิ่ม describe block ใหม่ต่อท้ายไฟล์ (หลัง `describe('textureToPanelTransform', ...)`)
ต้องเพิ่ม `morphAttributes.position` และ `morphTargetInfluences` ให้ `nailPlate()` ก่อน —
แก้ฟังก์ชัน `nailPlate()` ที่มีอยู่แล้วให้รับพารามิเตอร์เสริม:

```typescript
function nailPlate(influence = 0): Mesh {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([
    -0.5, -1, 0, 0.5, -1, 0, 0.5, 1, 0, -0.5, 1, 0,
  ]), 3))
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array([
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
  ]), 3))
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array([
    0, 0, 1, 0, 1, 1, 0, 1,
  ]), 2))
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  // morph สมมติ: ดันมุมปลายทั้งสอง (จุดที่ 2 และ 3, y=1) ออกด้านข้างจุดละ 0.5
  geometry.morphAttributes.position = [
    new BufferAttribute(new Float32Array([
      0, 0, 0, 0, 0, 0, 0.5, 0, 0, -0.5, 0, 0,
    ]), 3),
  ]
  const mesh = new Mesh(geometry)
  mesh.name = 'Nail_index'
  mesh.morphTargetInfluences = [influence]
  mesh.updateMatrixWorld(true)
  return mesh
}
```

**ต้องแก้การเรียก `nailPlate()` เดิมทุกจุดในไฟล์ให้ยังส่งค่าเริ่มต้นถูก** — เนื่องจาก
พารามิเตอร์มีค่าเริ่มต้น `influence = 0` การเรียก `nailPlate()` เดิมทั้งหมด (ไม่ส่ง
argument) ยังทำงานเหมือนเดิมทุกประการ ไม่ต้องแก้จุดเรียกเดิม

เพิ่มเทสใหม่ท้ายไฟล์:

```typescript
describe('flattenNail กับ morph target', () => {
  it('ใช้ตำแหน่งที่ผ่าน morph แล้ว ไม่ใช่ทรงฐานเฉย ๆ', () => {
    const base = flattenNail(nailPlate(0), 512)
    const morphed = flattenNail(nailPlate(1), 512)

    // เปิด morph เต็มที่แล้วขอบบนกว้างขึ้น กรอบรูปเล็บบนแผงจึงต้องกว้างขึ้นตาม
    expect(morphed.bounds.width).toBeGreaterThan(base.bounds.width)
  })

  it('influence 0 ให้ผลเหมือนไม่มี morph เลย', () => {
    const withoutMorphField = flattenNail(nailPlate(), 512)
    const withZeroInfluence = flattenNail(nailPlate(0), 512)
    expect(withZeroInfluence.bounds).toEqual(withoutMorphField.bounds)
  })
})
```

- [ ] **Step 2: รันแล้วยืนยันว่าเทสใหม่พัง (ยังไม่มีผลจาก morph)**

```bash
cd apps/web && npx vitest run src/3d/painting/nailFlatten.test.ts
```

Expected: เทส "ใช้ตำแหน่งที่ผ่าน morph แล้ว" ล้มเหลว เพราะ `flattenNail` ยังอ่านตำแหน่ง
ดิบไม่รวม morph — `bounds.width` เท่ากันทั้งสองกรณี

- [ ] **Step 3: แก้ `nailFlatten.ts`**

เพิ่ม import:

```typescript
import { morphedPosition } from '@/3d/scene/nailMorph.ts'
```

แก้ลูปในฟังก์ชัน `flattenNail` — จาก

```typescript
  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index).applyMatrix4(matrix).sub(view.center)
```

เป็น

```typescript
  for (let index = 0; index < position.count; index += 1) {
    morphedPosition(mesh, index, point).applyMatrix4(matrix).sub(view.center)
```

- [ ] **Step 4: แก้ `nailViews.ts`**

เพิ่ม import:

```typescript
import { morphedNormal, morphedPosition } from './nailMorph.ts'
```

แก้สามจุดในฟังก์ชัน `nailViewOf`:

จุดที่ 1 (ลูปหาจุดศูนย์กลาง) — จาก
```typescript
    centre.add(point.fromBufferAttribute(position, index).applyMatrix4(matrix))
```
เป็น
```typescript
    centre.add(morphedPosition(mesh, index, point).applyMatrix4(matrix))
```

จุดที่ 2 (ลูปหา normal เฉลี่ย) — จาก
```typescript
      facing.fromBufferAttribute(normalAttribute, index).applyMatrix3(normalMatrix).normalize(),
```
เป็น
```typescript
      morphedNormal(mesh, index, facing).applyMatrix3(normalMatrix).normalize(),
```

จุดที่ 3 (ลูปหารัศมี) — จาก
```typescript
    const distance = point.fromBufferAttribute(position, index)
      .applyMatrix4(matrix)
      .distanceTo(centre)
```
เป็น
```typescript
    const distance = morphedPosition(mesh, index, point)
      .applyMatrix4(matrix)
      .distanceTo(centre)
```

- [ ] **Step 5: รันแล้วยืนยันว่าผ่านหมด**

```bash
cd apps/web && npx vitest run src/3d/painting/nailFlatten.test.ts src/3d/scene
```

Expected: ทุกเทสผ่าน รวมสองเทสใหม่

- [ ] **Step 6: commit**

```bash
git add apps/web/src/3d/scene/nailViews.ts apps/web/src/3d/painting/nailFlatten.ts apps/web/src/3d/painting/nailFlatten.test.ts
git commit -m "fix: camera framing and the 2D panel now follow the selected nail shape"
```

---

## Task 8: `nailMorphs.ts` — แปลง (shape, length) เป็น influence array

**Files:**
- Create: `apps/web/src/3d/models/nailMorphs.ts`
- Test: `apps/web/src/3d/models/nailMorphs.test.ts`

**Interfaces:**
- Produces: `applyNailMorphs(mesh: Mesh, shape: Nail['shape'], length: Nail['length']): void`
- Consumes: `Nail` type จาก `@nail-studio/contracts`

- [ ] **Step 1: เขียนเทส**

```typescript
// apps/web/src/3d/models/nailMorphs.test.ts
import { describe, expect, it } from 'vitest'
import { BufferAttribute, BufferGeometry, Mesh } from 'three'
import { applyNailMorphs } from './nailMorphs.ts'

const TARGET_ORDER = ['almond', 'square', 'squoval', 'stiletto', 'short', 'long', 'extra']

function meshWithMorphs(): Mesh {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0]), 3))
  geometry.morphAttributes.position = TARGET_ORDER.map(
    () => new BufferAttribute(new Float32Array([0, 0, 0]), 3),
  )
  const mesh = new Mesh(geometry)
  mesh.morphTargetDictionary = Object.fromEntries(TARGET_ORDER.map((name, index) => [name, index]))
  return mesh
}

describe('applyNailMorphs', () => {
  it('ไม่เปิด target ใดเลยเมื่อเป็นทรงมนความยาวกลาง (ฐาน)', () => {
    const mesh = meshWithMorphs()
    applyNailMorphs(mesh, 'round', 'medium')
    expect(mesh.morphTargetInfluences).toEqual([0, 0, 0, 0, 0, 0, 0])
  })

  it('เปิด target ของทรงที่เลือก', () => {
    const mesh = meshWithMorphs()
    applyNailMorphs(mesh, 'stiletto', 'medium')
    expect(mesh.morphTargetInfluences).toEqual([0, 0, 0, 1, 0, 0, 0])
  })

  it('เปิด target ของความยาวที่เลือก', () => {
    const mesh = meshWithMorphs()
    applyNailMorphs(mesh, 'round', 'long')
    expect(mesh.morphTargetInfluences).toEqual([0, 0, 0, 0, 0, 1, 0])
  })

  it('เปิดทั้งทรงและความยาวพร้อมกันได้ (บวกกัน ไม่ทับกัน)', () => {
    const mesh = meshWithMorphs()
    applyNailMorphs(mesh, 'square', 'extra')
    expect(mesh.morphTargetInfluences).toEqual([0, 1, 0, 0, 0, 0, 1])
  })

  it('ไม่พังถ้า mesh ไม่มี morphTargetDictionary', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0]), 3))
    const mesh = new Mesh(geometry)
    expect(() => applyNailMorphs(mesh, 'almond', 'short')).not.toThrow()
  })
})
```

- [ ] **Step 2: รันแล้วยืนยันว่าพัง**

```bash
cd apps/web && npx vitest run src/3d/models/nailMorphs.test.ts
```

Expected: หาไฟล์ `./nailMorphs.ts` ไม่เจอ

- [ ] **Step 3: เขียน `apps/web/src/3d/models/nailMorphs.ts`**

```typescript
import type { Mesh } from 'three'
import type { Nail } from '@nail-studio/contracts'

/**
 * ตั้งค่า `morphTargetInfluences` ของ mesh เล็บให้ตรงกับทรง/ความยาวที่เลือก
 *
 * ทรงกับความยาวมาจาก shape key คนละชุดที่บวกกันได้ (ไม่ใช่ทางแยกที่ต้องเลือกอย่างใด
 * อย่างหนึ่ง) เพราะ `hand.glb` ถูกสร้างให้ delta ของ morph เป็นเวกเตอร์ที่บวกกันตรง ๆ
 * (ดูสเปก D-A2) — `round`/`medium` เป็นทรงฐาน ไม่มี target ของตัวเอง จึงไม่เปิดอะไรเลย
 */
export function applyNailMorphs(mesh: Mesh, shape: Nail['shape'], length: Nail['length']): void {
  const dictionary = mesh.morphTargetDictionary
  const count = mesh.geometry.morphAttributes.position?.length ?? 0
  if (!dictionary || count === 0) return

  const influences = mesh.morphTargetInfluences?.length === count
    ? mesh.morphTargetInfluences
    : new Array(count).fill(0)
  influences.fill(0)

  if (shape !== 'round') {
    const index = dictionary[shape]
    if (index !== undefined) influences[index] = 1
  }
  if (length !== 'medium') {
    const index = dictionary[length]
    if (index !== undefined) influences[index] = 1
  }

  mesh.morphTargetInfluences = influences
}
```

- [ ] **Step 4: รันแล้วยืนยันว่าผ่าน**

```bash
cd apps/web && npx vitest run src/3d/models/nailMorphs.test.ts
```

Expected: 5 เทสผ่าน

- [ ] **Step 5: commit**

```bash
git add apps/web/src/3d/models/nailMorphs.ts apps/web/src/3d/models/nailMorphs.test.ts
git commit -m "feat: translate nail shape and length into morph target influences"
```

---

## Task 9: `SetShapeCommand` / `SetLengthCommand` — เข้าระบบ history

**Files:**
- Modify: `apps/web/src/3d/history/commands/nailCommands.ts`
- Modify: `apps/web/src/3d/history/commands/commands.test.ts`

**Interfaces:**
- Consumes: `replaceNail` จาก `documentEdits.ts` (มีอยู่แล้ว)
- Produces: `SetShapeCommand`, `SetLengthCommand` — implements `Command` เหมือน `SetFinishCommand` ทุกประการ

- [ ] **Step 1: เพิ่มเทส round-trip ใน `commands.test.ts`**

เพิ่มหลังเทส `'restores a nail finish'`:

```typescript
  it('restores a nail shape', () => {
    expectRoundTrip(createEmptyDocument(), new SetShapeCommand(RIGHT_INDEX, 'round', 'stiletto'))
  })

  it('restores a nail length', () => {
    expectRoundTrip(createEmptyDocument(), new SetLengthCommand(RIGHT_INDEX, 'medium', 'long'))
  })
```

เพิ่มใน import จาก `./nailCommands.ts`:

```typescript
  SetFinishCommand,
  SetLengthCommand,
  SetShapeCommand,
```

- [ ] **Step 2: รันแล้วยืนยันว่าพัง**

```bash
cd apps/web && npx vitest run src/3d/history/commands/commands.test.ts
```

Expected: `SetShapeCommand`/`SetLengthCommand` ไม่มีอยู่ — TypeScript/import error

- [ ] **Step 3: เพิ่มคลาสใหม่ใน `nailCommands.ts`** (ต่อท้ายไฟล์ หลัง `SetFinishCommand`)

```typescript
export class SetShapeCommand implements Command {
  readonly label = 'เปลี่ยนทรงเล็บ'
  readonly key: NailKey
  readonly before: Nail['shape']
  readonly after: Nail['shape']
  readonly mergeKey?: string

  constructor(key: NailKey, before: Nail['shape'], after: Nail['shape'], mergeKey?: string) {
    this.key = key
    this.before = before
    this.after = after
    if (mergeKey !== undefined) this.mergeKey = mergeKey
  }

  do(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) =>
      nail.shape === this.after ? nail : { ...nail, shape: this.after })
  }

  undo(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) =>
      nail.shape === this.before ? nail : { ...nail, shape: this.before })
  }

  merge(next: Command): Command | null {
    if (!(next instanceof SetShapeCommand) || next.key !== this.key) return null
    if (this.mergeKey === undefined || next.mergeKey !== this.mergeKey) return null
    return new SetShapeCommand(this.key, this.before, next.after, this.mergeKey)
  }
}

export class SetLengthCommand implements Command {
  readonly label = 'เปลี่ยนความยาวเล็บ'
  readonly key: NailKey
  readonly before: Nail['length']
  readonly after: Nail['length']
  readonly mergeKey?: string

  constructor(key: NailKey, before: Nail['length'], after: Nail['length'], mergeKey?: string) {
    this.key = key
    this.before = before
    this.after = after
    if (mergeKey !== undefined) this.mergeKey = mergeKey
  }

  do(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) =>
      nail.length === this.after ? nail : { ...nail, length: this.after })
  }

  undo(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) =>
      nail.length === this.before ? nail : { ...nail, length: this.before })
  }

  merge(next: Command): Command | null {
    if (!(next instanceof SetLengthCommand) || next.key !== this.key) return null
    if (this.mergeKey === undefined || next.mergeKey !== this.mergeKey) return null
    return new SetLengthCommand(this.key, this.before, next.after, this.mergeKey)
  }
}
```

- [ ] **Step 4: รันแล้วยืนยันว่าผ่าน**

```bash
cd apps/web && npx vitest run src/3d/history/commands/commands.test.ts
```

Expected: ทุกเทสผ่าน

- [ ] **Step 5: commit**

```bash
git add apps/web/src/3d/history/commands/nailCommands.ts apps/web/src/3d/history/commands/commands.test.ts
git commit -m "feat: add SetShapeCommand and SetLengthCommand"
```

---

## Task 10: `designStore` — actions `setShape`/`setLength` + เชื่อม morph เข้า `useNailTextures`

**Files:**
- Modify: `apps/web/src/features/design/designStore.ts`
- Modify: `apps/web/src/3d/painting/useNailTextures.ts`
- Create: `apps/web/src/features/design/nailShape.test.ts`

**Interfaces:**
- Consumes: `SetShapeCommand`, `SetLengthCommand` จาก task 9; `applyNailMorphs` จาก task 8
- Produces: `DesignActions.setShape`, `DesignActions.setLength`

- [ ] **Step 1: เขียนเทส**

```typescript
// apps/web/src/features/design/nailShape.test.ts
import { describe, expect, it } from 'vitest'
import { EDITABLE_NAILS, createDesignStore } from './designStore.ts'

describe('setShape / setLength', () => {
  it('เปลี่ยนทรงของนิ้วที่เลือกแล้วเข้าประวัติ ย้อนได้', () => {
    const store = createDesignStore()
    store.getState().selectNail('right.index')
    store.getState().setShape('stiletto')

    expect(store.getState().document.nails['right.index'].shape).toBe('stiletto')
    expect(store.getState().history.state()).toMatchObject({ canUndo: true })

    store.getState().undo()
    expect(store.getState().document.nails['right.index'].shape).toBe('round')
  })

  it('เปลี่ยนความยาวของนิ้วที่เลือกแล้วเข้าประวัติ ย้อนได้', () => {
    const store = createDesignStore()
    store.getState().selectNail('right.index')
    store.getState().setLength('extra')

    expect(store.getState().document.nails['right.index'].length).toBe('extra')
    store.getState().undo()
    expect(store.getState().document.nails['right.index'].length).toBe('medium')
  })

  it('ใช้กับทุกนิ้วที่เลือกได้พร้อมกันผ่าน selectAll', () => {
    const store = createDesignStore()
    store.getState().selectAll()
    store.getState().setShape('almond')

    expect(EDITABLE_NAILS.every((key) => store.getState().document.nails[key].shape === 'almond')).toBe(true)
    store.getState().undo()
    expect(EDITABLE_NAILS.every((key) => store.getState().document.nails[key].shape === 'round')).toBe(true)
  })

  it('ไม่ทำอะไรถ้าเลือกทรง/ความยาวเดิม (ไม่บันทึกประวัติเปล่า)', () => {
    const store = createDesignStore()
    store.getState().selectNail('right.index')
    const revisionBefore = store.getState().revision
    store.getState().setShape('round')
    expect(store.getState().revision).toBe(revisionBefore)
  })
})
```

- [ ] **Step 2: รันแล้วยืนยันว่าพัง**

```bash
cd apps/web && npx vitest run src/features/design/nailShape.test.ts
```

Expected: `store.getState().setShape` ไม่ใช่ฟังก์ชัน

- [ ] **Step 3: แก้ `designStore.ts`**

เพิ่ม import (ต่อท้ายกลุ่ม import จาก `nailCommands.ts`):

```typescript
  SetLengthCommand,
  SetShapeCommand,
```

เพิ่มในอินเทอร์เฟส `DesignActions` (ถัดจาก `setFinish`):

```typescript
  setShape: (shape: Nail['shape'], mergeKey?: string) => void
  setLength: (length: Nail['length'], mergeKey?: string) => void
```

เพิ่ม action ในตัว store (ถัดจาก `setFinish:` ที่มีอยู่แล้ว):

```typescript
      setShape: (shape, mergeKey) => {
        const state = get()
        const commands = editableSelection(state.selection)
          .map((key) => new SetShapeCommand(key, state.document.nails[key].shape, shape, mergeKey))
        if (commands.length > 0) execute(commandFor('เปลี่ยนทรงเล็บ', commands, mergeKey))
      },

      setLength: (length, mergeKey) => {
        const state = get()
        const commands = editableSelection(state.selection)
          .map((key) => new SetLengthCommand(key, state.document.nails[key].length, length, mergeKey))
        if (commands.length > 0) execute(commandFor('เปลี่ยนความยาวเล็บ', commands, mergeKey))
      },
```

- [ ] **Step 4: รันแล้วยืนยันว่าผ่าน**

```bash
cd apps/web && npx vitest run src/features/design/nailShape.test.ts
```

Expected: 4 เทสผ่าน

- [ ] **Step 5: เชื่อม morph เข้า `useNailTextures.ts`** (ไม่มีเทสแยก — ครอบด้วยเทสเบราว์เซอร์
  ใน task 12 เพราะต้องมี mesh ที่มี morph จริงจาก `hand.glb`)

เพิ่ม import:

```typescript
import { applyNailMorphs } from '@/3d/models/nailMorphs.ts'
```

เพิ่มฟังก์ชัน `syncShape` ถัดจาก `syncFinish` ที่มีอยู่แล้ว:

```typescript
    const syncShape = (key: NailKey): void => {
      const mesh = parts.nails.get(key)
      if (!mesh) return
      const nail = store.getState().document.nails[key]
      applyNailMorphs(mesh, nail.shape, nail.length)
    }
```

แก้ลูปเริ่มต้น — จาก
```typescript
    for (const [key] of parts.nails) {
      const texture = new CanvasTexture(set.composite(key) as HTMLCanvasElement)
      maps.set(key, texture)
      syncFinish(key)
    }
```
เป็น
```typescript
    for (const [key] of parts.nails) {
      const texture = new CanvasTexture(set.composite(key) as HTMLCanvasElement)
      maps.set(key, texture)
      syncFinish(key)
      syncShape(key)
    }
```

แก้ callback ของ `store.subscribe` — จาก
```typescript
        set.rebuild(key)
        syncFinish(key)
```
เป็น
```typescript
        set.rebuild(key)
        syncFinish(key)
        syncShape(key)
```

- [ ] **Step 6: รัน typecheck + เทสทั้งหมดของ web**

```bash
cd apps/web && npx tsc --noEmit && npx vitest run
```

Expected: typecheck สะอาด เทสทั้งหมดผ่าน

- [ ] **Step 7: commit**

```bash
git add apps/web/src/features/design/designStore.ts apps/web/src/3d/painting/useNailTextures.ts apps/web/src/features/design/nailShape.test.ts
git commit -m "feat: wire nail shape/length into the store and mesh morph targets"
```

---

## Task 11: UI — เลือกทรง/ความยาวใน `PaintToolbar`

**Files:**
- Modify: `apps/web/src/features/design/PaintToolbar.tsx`

**Interfaces:**
- Consumes: `setShape`, `setLength` จาก task 10; `NAIL_SHAPES`, `NAIL_LENGTHS` จาก `@nail-studio/contracts`

- [ ] **Step 1: แก้ import**

```typescript
import { BRUSHES, FINISHES, NAIL_LENGTHS, NAIL_SHAPES, type Nail } from '@nail-studio/contracts'
```

เพิ่ม label ถัดจาก `FINISH_LABELS`:

```typescript
const SHAPE_LABELS: Record<Nail['shape'], string> = {
  round: 'มน',
  almond: 'อัลมอนด์',
  square: 'เหลี่ยม',
  squoval: 'เหลี่ยมมน',
  stiletto: 'แหลม',
}

const LENGTH_LABELS: Record<Nail['length'], string> = {
  short: 'สั้น',
  medium: 'กลาง',
  long: 'ยาว',
  extra: 'ยาวพิเศษ',
}
```

- [ ] **Step 2: อ่านค่า/action ในตัว component**

เพิ่มถัดจากบรรทัด `const finish = useDesign(...)`:

```typescript
  const setShape = useDesign((state) => state.setShape)
  const setLength = useDesign((state) => state.setLength)
  const shape = useDesign((state) => state.document.nails[primaryOf(state.selection)].shape)
  const length = useDesign((state) => state.document.nails[primaryOf(state.selection)].length)
```

- [ ] **Step 3: เพิ่ม UI** — แทรกสอง `<label className="field">` ถัดจากบล็อก `ผิวเล็บ`
  ที่มีอยู่แล้ว (ก่อน `<div className="tool-actions">`):

```tsx
      <label className="field">
        ทรงเล็บ
        <select
          value={shape}
          onChange={(event) => setShape(event.target.value as Nail['shape'])}
        >
          {NAIL_SHAPES.map((option) => (
            <option key={option} value={option}>{SHAPE_LABELS[option]}</option>
          ))}
        </select>
      </label>

      <label className="field">
        ความยาว
        <select
          value={length}
          onChange={(event) => setLength(event.target.value as Nail['length'])}
        >
          {NAIL_LENGTHS.map((option) => (
            <option key={option} value={option}>{LENGTH_LABELS[option]}</option>
          ))}
        </select>
      </label>
```

- [ ] **Step 4: รัน typecheck + lint**

```bash
cd apps/web && npx tsc --noEmit
cd "../.." && npm run -s lint
```

Expected: สะอาดทั้งคู่

- [ ] **Step 5: commit**

```bash
git add apps/web/src/features/design/PaintToolbar.tsx
git commit -m "feat: add shape and length selects to the paint toolbar"
```

---

## Task 12: ตรวจจริงบนเบราว์เซอร์ + ปิดเอกสาร

ไม่มีเทสอัตโนมัติในงานนี้ — เป็นด่านสุดท้ายที่พิสูจน์ว่าทุกชิ้นที่แยกเทสไว้ทำงาน
ร่วมกันจริงในสภาพแวดล้อมจริง เดินตามเกณฑ์ §11 ของสเปกทุกข้อ

**Files:**
- Modify: `docs/architecture.md` — เพิ่ม DECISION ใหม่สรุปงานนี้
- Modify: `docs/implementation-plan.md` — ปรับสถานะ Slice 4 ข้อ 4

- [ ] **Step 1: เปิด dev server แล้วโหลด editor**

```bash
npm run dev --workspace apps/web
```

- [ ] **Step 2: ตรวจตามเกณฑ์สเปก §11 ทีละข้อ**

- เลือกทรง `stiletto` แล้วดูเล็บบนจอ — ต้องเปลี่ยนทรงเห็นชัด และ **โคนเล็บยังแนบผิวนิ้ว
  ไม่มีช่องว่างหรือช่องว่างระหว่างเล็บกับผิวหนัง**
- กด Ctrl+Z — เล็บกลับเป็น `round`
- เลือกความยาว `extra` — เล็บยาวขึ้นเห็นชัด โคนไม่ขยับ
- คลิกเลือกนิ้วที่เพิ่งเปลี่ยนทรง (เช่น `stiletto`) แล้วดูแผงวาด 2 มิติ — รูปเล็บบนแผง
  ต้องเป็นทรงแหลม **ไม่ใช่วงรีทรงมนแบบเดิม** (พิสูจน์ว่า `nailFlatten.ts` อ่าน morph แล้ว)
- วาดวงกลมเล็ก ๆ บนแผง 2 มิติแล้วเทียบกับรอยบนเล็บจริงบนโมเดล 3 มิติ — ถ้ายังเห็นเป็นวงรี
  ยืดชัดเจนกว่าที่เคยวัดไว้ (D-25 บันทึกไว้ 1.4:1) ให้เทียบกับค่าที่ `verify:model` รายงาน
  ใน task 4 — ถ้าค่าความบิดจริงเกิน 1.15 อาการนี้คือสิ่งที่คาดไว้แล้ว ไม่ใช่บั๊กใหม่
- ถ้าเล็บดูหัวกลับ (ปลายเล็บชี้เข้าหาฝ่ามือแทนที่จะชี้ออก) — กลับไปแก้ `reunwrap_nails()`
  ใน task 3 ตามคอมเมนต์ที่เขียนไว้ (ลองตัด `1.0 -` ออก) แล้วรัน `npm run build:model` ใหม่

- [ ] **Step 3: เพิ่ม DECISION สรุปงานนี้ใน `docs/architecture.md`** ต่อท้าย D-26 ที่มีอยู่แล้ว
  (รูปแบบเดียวกับ D-25/D-26): บันทึกค่า `TAPER_START = 0.45` ที่ต้องคูณทุกสูตรเสมอ ค่า
  `MAX_UV_DISTORTION` ที่ตรวจได้จริงจาก task 4 (ไม่ใช่ 1.15 ที่ตั้งไว้ล่วงหน้า ถ้าต่างกัน)
  และเหตุผลที่ `nail_geometry.py` ใช้แกน PCA คนละแบบกับ `nailFlatten.ts` (ไม่ใช่ฟังก์ชัน
  เดียวกันเป๊ะ แค่แนวคิดเดียวกัน — บันทึกไว้กันคนในอนาคตสับสนว่าทำไมไม่ใช้โค้ดชุดเดียว)

- [ ] **Step 4: ปรับ `docs/implementation-plan.md`** — เพิ่มบรรทัดในหัวข้อ Slice 4 ข้อ 4 ว่า
  งาน UV re-unwrap ที่ค้างจาก Slice 2 (บันทึกไว้ใน D-25 ว่า "รอยหัวแปรงยังเป็นวงรี 1.4:1")
  ได้ทำแล้วในรอบนี้ พร้อมค่าความบิดที่วัดได้จริงหลังแก้ (เทียบก่อน/หลังให้เห็นตัวเลข)

- [ ] **Step 5: รันเทสทั้งชุดของ repo อีกครั้งเพื่อยืนยันไม่มีอะไรพัง**

```bash
npm run typecheck
npm run -s lint
npm run test
```

Expected: ทั้งสามคำสั่งผ่านสะอาด

- [ ] **Step 6: commit**

```bash
git add docs/architecture.md docs/implementation-plan.md
git commit -m "docs: close out the nail model pipeline (Slice 4 part A)"
```

---

## Self-Review

**ครอบคลุมสเปกครบไหม**:
- D-A1 (ยอมให้งานเก่าเพี้ยน) — ไม่ต้องมี task แยก เป็นผลธรรมชาติของ task 3 (ไม่มี migration)
- D-A2 (ความยาวเป็น morph) — task 2, 3, 8
- §3 โครงไปป์ไลน์ — task 1 (โครง), 3 (เนื้อหา)
- §4 ด่านตรวจ 4.1-4.4 — task 4
- §5 UV — task 2 (`project_to_uv`), 3 (`reunwrap_nails`)
- §6 แบบจำลองการดัด รวมการแก้ `TAPER_START` — task 2
- §7 ฝั่งรันไทม์ รวมจุดเสี่ยง `nailViews`/`nailFlatten` — task 6, 7, 8, 9, 10, 11
- §8 การทดสอบ — ครบทุกชั้น (python unittest: task 2, verify_model: task 4, vitest: task 6-10)
- §9 ผลกระทบ M0 — task 5
- §11 เกณฑ์ว่าเสร็จ — task 12 ไล่ตรงทุกข้อ

**สแกนหา placeholder**: ไม่มี "TBD"/"ทีหลัง" — จุดเดียวที่ปล่อยเป็นค่าที่ต้องวัดจริง
(ความบิด UV ที่แท้จริง, ตัวเลข M0 ใหม่) มีคำสั่งที่ระบุวิธีวัดและที่ที่ต้องบันทึกผลไว้ชัดเจน
ไม่ใช่ placeholder ที่ปล่อยลอย

**ความสอดคล้องของชื่อ/ชนิด**: `SetShapeCommand`/`SetLengthCommand` (task 9) ตรงกับที่
`designStore.ts` import (task 10) ตรงกับที่ `commands.test.ts` import (task 9) —
`applyNailMorphs(mesh, shape, length)` ที่นิยามใน task 8 ตรงกับที่เรียกใน task 10 —
`morphedPosition`/`morphedNormal(mesh, index, out)` ที่นิยามใน task 6 ตรงกับที่เรียกใน
task 7 ทั้งลำดับและชนิดพารามิเตอร์
