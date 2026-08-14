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
