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
