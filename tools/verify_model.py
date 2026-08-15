"""ประตูตรวจ hand.glb ด้วย Python stdlib เท่านั้น"""
import json
import math
import os
import struct
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nail_geometry import local_frame, max_uv_distortion

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# ROOT ตั้งใจให้ชี้ apps/web ไม่ใช่รากของ monorepo — โปรเจกต์ต้นทางเป็นโครงสร้าง
# แบนที่ tools/ กับ public/ อยู่ระดับเดียวกัน แต่ repo นี้เป็น monorepo ที่ public/
# ของเว็บจริง ๆ อยู่ที่ apps/web/public/ จึงต้องต่อ 'apps', 'web' เพิ่มเข้าไป
# ไม่งั้นจะไปสร้าง/อ่านไฟล์ที่ <repo root>/public/models ซึ่งเว็บไม่ได้ใช้เลย
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GLB = os.path.join(ROOT, 'apps', 'web', 'public', 'models', 'hand.glb')
META = os.path.join(ROOT, 'apps', 'web', 'public', 'models', 'nails.meta.json')
NAILS = ['Nail_thumb', 'Nail_index', 'Nail_middle', 'Nail_ring', 'Nail_little']
# เลข 4 MB เดิมเป็นเป้าที่ตั้งเองตอนต้องบีบโมเดลเก่าลงจาก 37.7 MB ไม่ใช่ข้อจำกัด
# จากที่ไหน โมเดลใหม่คง texture 2048 ไว้ทั้งสี่ใบเพื่อความคมชัด (รวม 6.4 MB)
# บวก mesh มือ 63k จุด ได้ราว 11.2 MB จึงตั้งเพดานไว้ที่ 12
#
# ไฟล์เดิม 10.46 MB ตอนอบท่าลง vertex การเปิด skinning กลับมาเพิ่ม JOINTS_0 กับ
# WEIGHTS_0 ให้ mesh มือ 63k จุด (24 ไบต์/จุด ≈ 1.5 MB) บวก inverse bind matrices
# รวมแล้วราว 12 MB ซึ่งชนเพดาน 12.0 เดิมพอดี ขยับเป็น 14.0 ให้มีที่หายใจ
SIZE_BUDGET_MB = 14.0

# เดิมมีด่าน MIN_COVERAGE = 0.95 ตรงนี้ ตรวจว่า UV footprint กินพื้นที่สี่เหลี่ยม
# หน่วย 0-1 กี่เปอร์เซ็นต์ ใช้ได้กับ mapping แบบยืดเต็มสี่เหลี่ยมของเดิม (วัดได้
# 1.000 ทุกนิ้ว) แต่ task 3 เปลี่ยนมาใช้ projection ที่รักษาสัดส่วนจริงของเล็บ
# (aspect-preserving) พร้อม padding 6% ซึ่งตั้งใจเหลือช่องว่างรอบเล็บที่ไม่เป็น
# สี่เหลี่ยมจัตุรัส — วัดได้แค่ 0.445-0.525 ทั้งที่ mapping ถูกต้องสมบูรณ์ "พื้นที่
# ที่กิน" จึงไม่มีความหมายเป็นสัญญาณคุณภาพอีกต่อไปภายใต้การออกแบบใหม่นี้ ตัด
# ด่านนี้ออก (ค่าที่วัดได้จริงตอนตัด: thumb/index/middle/ring/little = 0.445-0.525
# ดู task-4-report.md) ด่านที่วัดคุณภาพ mapping แทนคือ MAX_UV_DISTORTION ด้านล่าง
# ส่วน union_coverage() ยังใช้อยู่ ห้ามลบ — MAX_OVERLAP ด้านล่างพึ่งมันตรวจ UV
# พับทับตัวเอง ซึ่งเป็นข้อบกพร่องจริงไม่ว่าจะใช้ mapping แบบไหน

# เล็บสามชิ้น (โป้ง กลาง ก้อย) เป็นก้อนปิด ผิวบนกับผิวล่างใช้ UV ชุดเดียวกัน
# โดยตั้งใจ เพื่อให้สีที่วาดต่อเนื่องไปถึงขอบเล็บ อัตราส่วนจึงอยู่ที่ 2.00 พอดี
# ส่วนอีกสองชิ้นเป็นผิวเปิดได้ 1.00 เผื่อไว้ถึง 2.35
MAX_OVERLAP = 2.35
CTYPE = {
    5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2),
    5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4),
}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def load_glb(path):
    with open(path, 'rb') as stream:
        buffer = stream.read()
    magic, _, total = struct.unpack_from('<III', buffer, 0)
    assert magic == 0x46546C67, 'ไม่ใช่ไฟล์ GLB'
    offset, gltf, binary_offset = 12, None, None
    while offset < total:
        length, chunk_type = struct.unpack_from('<II', buffer, offset)
        if chunk_type == 0x4E4F534A:
            gltf = json.loads(buffer[offset + 8:offset + 8 + length].decode('utf-8'))
        elif chunk_type == 0x004E4942:
            binary_offset = offset + 8
        offset += 8 + length
    return buffer, gltf, binary_offset


def accessor(buffer, gltf, binary_offset, index):
    value = gltf['accessors'][index]
    fmt, size = CTYPE[value['componentType']]
    component_count = NCOMP[value['type']]
    # morph target deltas ที่ build_shapes.py อบออกมามีสัดส่วนจุดที่ไม่ขยับเยอะ (โคน
    # เล็บ) exporter จึงเลือกเก็บเป็น sparse accessor แทนอาร์เรย์เต็ม — ไม่มี
    # 'bufferView' บนตัว accessor เอง ค่าที่เหลือทั้งหมดถือเป็นศูนย์โดยปริยายตามสเปก
    # glTF 2.0 แล้วเอา sparse.indices/values มาทับเฉพาะแถวที่ระบุ
    if 'bufferView' in value:
        view = gltf['bufferViews'][value['bufferView']]
        base = binary_offset + view.get('byteOffset', 0) + value.get('byteOffset', 0)
        stride = view.get('byteStride') or size * component_count
        rows = [
            list(struct.unpack_from('<' + fmt * component_count, buffer, base + row * stride))
            for row in range(value['count'])
        ]
    else:
        rows = [[0] * component_count for _ in range(value['count'])]

    sparse = value.get('sparse')
    if sparse:
        index_info = sparse['indices']
        index_fmt, index_size = CTYPE[index_info['componentType']]
        index_view = gltf['bufferViews'][index_info['bufferView']]
        index_base = binary_offset + index_view.get('byteOffset', 0) + index_info.get('byteOffset', 0)
        indices = [
            struct.unpack_from('<' + index_fmt, buffer, index_base + i * index_size)[0]
            for i in range(sparse['count'])
        ]

        value_info = sparse['values']
        value_view = gltf['bufferViews'][value_info['bufferView']]
        value_base = binary_offset + value_view.get('byteOffset', 0) + value_info.get('byteOffset', 0)
        value_stride = value_view.get('byteStride') or size * component_count
        for position, row_index in enumerate(indices):
            rows[row_index] = list(struct.unpack_from(
                '<' + fmt * component_count, buffer, value_base + position * value_stride,
            ))

    return [tuple(row) for row in rows]


def union_coverage(uv, indices, grid=256):
    """สัดส่วนพื้นที่ UV ที่ถูกสามเหลี่ยมครอบจริง นับซ้ำไม่ได้

    แรสเตอร์ไรซ์ลงตาราง grid x grid แล้วนับช่องที่โดน ต่างจากการบวกพื้นที่สามเหลี่ยม
    ตรงที่ส่วนที่ทับกันถูกนับครั้งเดียว จึงใช้จับ UV ที่พับทับตัวเองได้
    """
    filled = bytearray(grid * grid)
    for offset in range(0, len(indices), 3):
        ax, ay = uv[indices[offset]]
        bx, by = uv[indices[offset + 1]]
        cx, cy = uv[indices[offset + 2]]
        denominator = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(denominator) < 1e-12:
            continue
        lo_x = max(0, int(min(ax, bx, cx) * grid) - 1)
        hi_x = min(grid - 1, int(max(ax, bx, cx) * grid) + 1)
        lo_y = max(0, int(min(ay, by, cy) * grid) - 1)
        hi_y = min(grid - 1, int(max(ay, by, cy) * grid) + 1)
        for gy in range(lo_y, hi_y + 1):
            py = (gy + 0.5) / grid
            for gx in range(lo_x, hi_x + 1):
                px = (gx + 0.5) / grid
                w0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / denominator
                w1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / denominator
                w2 = 1.0 - w0 - w1
                if w0 >= 0 and w1 >= 0 and w2 >= 0:
                    filled[gy * grid + gx] = 1
    return sum(filled) / float(grid * grid)


def node_transform(node):
    """(เมทริกซ์หมุน+ย่อขยาย 3x3, เวกเตอร์เลื่อน) ของ node หนึ่งตัว"""
    x, y, z, w = node.get('rotation', [0.0, 0.0, 0.0, 1.0])
    rotation = [
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ]
    scale = node.get('scale', [1.0, 1.0, 1.0])
    matrix = [[rotation[r][c] * scale[c] for c in range(3)] for r in range(3)]
    return matrix, node.get('translation', [0.0, 0.0, 0.0])


def apply_matrix(matrix, vector, translation=(0.0, 0.0, 0.0)):
    return [
        sum(matrix[r][c] * vector[c] for c in range(3)) + translation[r]
        for r in range(3)
    ]


def unit(vector):
    length = math.sqrt(sum(component * component for component in vector))
    return [component / length for component in vector] if length > 1e-12 else list(vector)


def facing_outward(nail_points, nail_normals, skin_points, skin_normals, sample=40):
    """สัดส่วนของ normal เล็บที่หันไปทางเดียวกับผิวมือที่อยู่ใต้เล็บชิ้นนั้น

    ผิวมือใต้เล็บคือตัวอ้างอิงเดียวที่บอกได้ว่า "ออกนอกนิ้ว" คือทางไหน โดยไม่ต้องเดา
    ห้ามใช้ปริมาตรเชิงเครื่องหมายแทน เพราะเล็บทั้งห้าเป็นเปลือกเปิด ค่าที่ได้จะขึ้นกับ
    ระยะจากจุดกำเนิดไม่ใช่ทิศหน้า วัดแล้วเล็บชี้ได้ +3.9e-02 ทั้งที่หันผิดด้านอยู่
    """
    centre = [sum(p[axis] for p in nail_points) / len(nail_points) for axis in range(3)]
    ranked = sorted(
        range(len(skin_points)),
        key=lambda i: sum((skin_points[i][a] - centre[a]) ** 2 for a in range(3)),
    )
    skin = [0.0, 0.0, 0.0]
    for index in ranked[:sample]:
        near = unit(skin_normals[index])
        for axis in range(3):
            skin[axis] += near[axis]
    skin = unit(skin)
    agree = sum(
        1 for normal in nail_normals
        if sum(normal[axis] * skin[axis] for axis in range(3)) > 0.0
    )
    return agree / float(len(nail_normals))


JOINT_COUNT = 22
# ชื่อบอร์นที่โค้ดฝั่งเว็บอ้างถึงตรง ๆ (src/three/handBones.ts) — ถ้ามีคนเปลี่ยนชื่อ
# ใน Blender จำนวน joint ยังเท่าเดิม 22 ด่านนับจำนวนจึงผ่านฉลุย แล้วไปพังตอน
# runtime ที่ collectBones แทน ตรวจชื่อไว้ตรงนี้จะเจอตั้งแต่ตอน build
REQUIRED_JOINTS = ['Palm', 'Index1', 'Middle1', 'Ring1', 'Pinky1', 'Thumb2']
NAIL_BONES = {
    'Nail_thumb': 'Thumb4',
    'Nail_index': 'Index4',
    'Nail_middle': 'Middle4',
    'Nail_ring': 'Ring4',
    'Nail_little': 'Pinky4',
}
TARGET_NAMES = ('almond', 'square', 'squoval', 'stiletto', 'short', 'long', 'extra')
MAX_UV_DISTORTION = 1.15


def check_skin(buffer, gltf, binary_offset, check):
    """เล็บต้องผูกกับบอร์นเดียวล้วน — nailViews ฝั่งเว็บพึ่งข้อนี้ตรง ๆ

    ถ้าวันหนึ่งมีคนไปทาน้ำหนักใหม่ใน Blender จนเล็บผูกสองบอร์น สูตรเมทริกซ์เดียว
    ต่อเล็บใน nailViews จะผิดทันทีโดยไม่มีอะไรฟ้อง กล้องจะไปจ่อผิดที่เงียบ ๆ
    ด่านนี้จึงต้องดักไว้ตั้งแต่ตอน build
    """
    skins = gltf.get('skins', [])
    check(len(skins) == 1, 'มี skin เดียว (พบ %d)' % len(skins))
    if not skins:
        return
    joints = skins[0].get('joints', [])
    check(len(joints) == JOINT_COUNT,
          'skin มี %d joints (คาด %d)' % (len(joints), JOINT_COUNT))

    nodes = gltf['nodes']
    joint_names = {nodes[index].get('name', '') for index in joints}
    missing = [name for name in REQUIRED_JOINTS if name not in joint_names]
    check(not missing,
          'มีบอร์นที่ฝั่งเว็บอ้างถึงครบ' + (' (ขาด: %s)' % ', '.join(missing) if missing else ''))

    checked = set()
    for node in nodes:
        name = node.get('name', '')
        if name not in NAIL_BONES or 'mesh' not in node:
            continue
        checked.add(name)
        check('skin' in node, '%s เป็น skinned mesh' % name)
        attributes = gltf['meshes'][node['mesh']]['primitives'][0]['attributes']
        has_weights = 'JOINTS_0' in attributes and 'WEIGHTS_0' in attributes
        check(has_weights, '%s มีข้อมูลน้ำหนัก skin' % name)
        if not has_weights:
            continue
        joint_data = accessor(buffer, gltf, binary_offset, attributes['JOINTS_0'])
        weight_data = accessor(buffer, gltf, binary_offset, attributes['WEIGHTS_0'])
        expected = NAIL_BONES[name]
        rigid = True
        bones_used = set()
        for js, ws in zip(joint_data, weight_data):
            ranked = sorted(zip(js, ws), key=lambda pair: -pair[1])
            if abs(ranked[0][1] - 1.0) > 1e-4:
                rigid = False
            bones_used.add(nodes[joints[ranked[0][0]]].get('name', '?'))
        check(rigid, '%s ผูกบอร์นเดียวน้ำหนักเต็ม 1.0 ทุกจุด' % name)
        check(bones_used == {expected},
              '%s ผูกกับ %s (พบ %s)' % (name, expected, sorted(bones_used)))

    # ลูปข้างบนเงียบสนิทถ้าไม่มี node ไหนชื่อตรงกับ NAIL_BONES เลย (เช่นมีคนเปลี่ยน
    # ชื่อ mesh ใน Blender) ซึ่งเป็นโหมดพังที่ผิดสำหรับด่านที่มีไว้จับ pipeline drift
    # โดยเฉพาะ — ต้องยืนยันว่าตรวจครบทั้งห้าชิ้นจริง ไม่ใช่แค่ "ที่เจอไม่มีตัวไหนพัง"
    absent = sorted(set(NAIL_BONES) - checked)
    check(not absent,
          'ตรวจ mesh เล็บครบทั้ง %d ชิ้น' % len(NAIL_BONES)
          + (' (ไม่พบ: %s)' % ', '.join(absent) if absent else ''))


def check_morphs(gltf, names, check):
    """ด่าน 4.1 — morph ครบ 7 ต่อเล็บ ชื่อตรงเรียงลำดับเป๊ะ"""
    for wanted in NAILS:
        hits = [index for index, name in enumerate(names) if name == wanted + '_Mesh']
        if not hits:
            continue
        mesh = gltf['meshes'][hits[0]]
        primitive = mesh['primitives'][0]
        # targetNames อยู่ที่ mesh.extras ตามธรรมเนียม glTF 2.0 (ไม่ใช่ primitive.extras)
        # — Blender exporter เขียนไว้ตรงนี้ และ nail_geometry.py คอมเมนต์ไว้เช่นกัน
        target_names = mesh.get('extras', {}).get('targetNames', [])
        check(
            tuple(target_names) == TARGET_NAMES,
            '%s มี morph target ครบ 7 อัน เรียงลำดับถูก (พบ: %s)' % (wanted, target_names),
        )
        # targetNames เป็นแค่ metadata — ตรวจแยกว่า primitive.targets จริงมีครบตามจำนวน
        # ไม่งั้น GLB ที่ targetNames ถูกแต่ POSITION target หายไปบางอัน จะผ่านด่านนี้ไปได้
        # ทั้งที่ check_base_still ใช้ zip(target_names, targets) ซึ่งตัดปลายให้เงียบ ๆ
        targets = primitive.get('targets', [])
        check(
            len(targets) == len(TARGET_NAMES),
            '%s มี target จริง %d ชุด' % (wanted, len(TARGET_NAMES)),
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
        # targetNames อยู่ที่ mesh.extras (ดูเหตุผลใน check_morphs ด้านบน)
        target_names = mesh.get('extras', {}).get('targetNames', [])
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


def main():
    failures = []

    def check(ok, message):
        print(('  ok   ' if ok else '  FAIL ') + message)
        if not ok:
            failures.append(message)
        return ok

    print('ตรวจ', GLB)
    check(os.path.exists(GLB), 'มีไฟล์ hand.glb')
    check(os.path.exists(META), 'มีไฟล์ nails.meta.json')
    if failures:
        print('\nไม่ผ่าน: ยังไม่ได้รัน build_model.py')
        return 1

    size_mb = os.path.getsize(GLB) / 1e6
    check(size_mb <= SIZE_BUDGET_MB,
          'ขนาดไฟล์ %.2f MB ≤ %.1f MB' % (size_mb, SIZE_BUDGET_MB))
    buffer, gltf, binary_offset = load_glb(GLB)
    names = [mesh.get('name', '') for mesh in gltf.get('meshes', [])]
    print('  mesh ที่พบ:', names)
    # เดิมด่านนี้ห้ามมี rig เพราะท่าถูกอบลง vertex แล้ว ตอนนี้กลับด้าน: สไลเดอร์
    # ปรับสัดส่วนมือฝั่งเว็บตั้ง scale ที่บอร์น ถ้าไม่มี rig ก็ไม่เหลืออะไรให้ปรับ
    check_skin(buffer, gltf, binary_offset, check)
    check_morphs(gltf, names, check)
    check_base_still(buffer, gltf, binary_offset, names, check)
    check_uv_distortion(buffer, gltf, binary_offset, names, check)
    check_skin_weights_sum(buffer, gltf, binary_offset, names, check)
    # โมเดลนี้ตั้งใจส่งเป็นท่านิ่ง ไม่มี animation: action Hand_Flex_Demo ที่ติดมากับ
    # rig ทำให้ exporter เขียน bind pose ตาม action แทนท่าที่จัดไว้ และเว็บก็ไม่ได้
    # เล่น animation อยู่แล้ว ด่านจึงตรวจว่า "ไม่มี" ไม่ใช่ "ต้องมี"
    check(not gltf.get('animations'), 'ไม่มี animation ติดมา (ตั้งใจส่งเป็นท่านิ่ง)')

    # ไม่มีระบบทรงเล็บแล้ว เล็บนิ้วละหนึ่ง mesh ตรงตัว
    # ถ้ายังมี mesh ลงท้าย _square/_round หลงเหลือ แปลว่ารันด้วย pipeline เก่า
    stale = [name for name in names if name.endswith(('_square_Mesh', '_round_Mesh'))]
    check(not stale,
          'ไม่มี mesh ทรงเก่าหลงเหลือ' + (' (พบ: %s)' % ', '.join(stale) if stale else ''))
    check(not any('Icosphere' in name for name in names),
          'ไม่มี Icosphere ที่จะบังการยิงรังสี')
    # ถ้ามือหายไปแต่เล็บทั้งห้ายังอยู่ครบ ด่านข้างล่างที่ไล่ตรวจ NAILS จะผ่านหมดโดย
    # ไม่มีใครรู้ว่าเว็บจะเจอเล็บลอยไม่มีมือรองรับและไม่มีผิวให้ยิงรังสีบัง
    check('Hand_Mesh' in names, 'มี mesh Hand')

    # ทิศหน้าเล็บ — ด่านนี้มีเพราะเคยหลุดมาแล้วและไม่มีด่านไหนจับได้เลย
    #
    # โมเดลต้นทางส่งเล็บมาหันหน้าเข้าเนื้อนิ้วทั้งห้าชิ้น (สามชิ้นลำดับจุดกลับด้าน
    # อีกสองชิ้นลำดับจุดถูกแต่ normal ที่ฝังมาชี้สวนทาง) three.js ตัดหน้าหลังทิ้ง
    # ตามค่าเริ่มต้น เล็บจึงเรนเดอร์ออกมาเป็นสีดำ และ Raycaster ก็เคารพ material.side
    # เหมือนกัน รังสีเลยทะลุผ่านเล็บไป ผู้ใช้ทาสีบน 3D ไม่ได้เลยสักนิ้ว
    # ตอนนั้น UV coverage 1.000 ชื่อ mesh ครบ ขนาดไฟล์ผ่าน ทุกด่านเขียว
    nodes = {node.get('name'): node for node in gltf.get('nodes', []) if 'mesh' in node}
    if check('Hand' in nodes, 'มี node Hand สำหรับอ้างอิงทิศผิว'):
        hand_matrix, hand_offset = node_transform(nodes['Hand'])
        hand_primitive = gltf['meshes'][nodes['Hand']['mesh']]['primitives'][0]
        # สุ่มทีละ 20 จุดพอ มือมี 63k จุดและเราต้องการแค่ทิศผิวคร่าว ๆ ใต้เล็บ
        skin_points = [
            apply_matrix(hand_matrix, point, hand_offset)
            for point in accessor(
                buffer, gltf, binary_offset, hand_primitive['attributes']['POSITION'],
            )[::20]
        ]
        skin_normals = [
            apply_matrix(hand_matrix, normal)
            for normal in accessor(
                buffer, gltf, binary_offset, hand_primitive['attributes']['NORMAL'],
            )[::20]
        ]
        for wanted in NAILS:
            node = nodes.get(wanted)
            if node is None:
                continue
            matrix, offset = node_transform(node)
            primitive = gltf['meshes'][node['mesh']]['primitives'][0]
            points = [
                apply_matrix(matrix, point, offset)
                for point in accessor(
                    buffer, gltf, binary_offset, primitive['attributes']['POSITION'],
                )
            ]
            normals = [
                apply_matrix(matrix, normal)
                for normal in accessor(
                    buffer, gltf, binary_offset, primitive['attributes']['NORMAL'],
                )
            ]
            outward = facing_outward(points, normals, skin_points, skin_normals)
            check(outward >= 0.5,
                  '%s หันหน้าออกนอกนิ้ว (%.0f%% ของ normal ≥ 50%%)'
                  % (wanted, outward * 100))

    for wanted in NAILS:
        # ต้องเทียบชื่อแบบตรงตัว ไม่ใช่ startswith ไม่งั้น Nail_thumb จะไปแมตช์
        # Nail_thumb_oval แล้วด่านจะตรวจ mesh ผิดตัวโดยไม่มีใครรู้
        hits = [index for index, name in enumerate(names) if name == wanted + '_Mesh']
        if not check(bool(hits), 'มี mesh %s' % wanted):
            continue
        mesh = gltf['meshes'][hits[0]]
        check(len(mesh['primitives']) == 1, '%s มี primitive เดียว' % wanted)
        primitive = mesh['primitives'][0]
        attributes = primitive['attributes']
        check('TEXCOORD_0' in attributes, '%s มี TEXCOORD_0' % wanted)
        # เดิมด่านนี้ห้ามมี JOINTS_0 ค้างเพราะตอนนั้นอบท่าลง vertex แล้วไม่ควรเหลือ
        # skin weights อะไรทั้งสิ้น ตอนนี้เล็บทุกชิ้นตั้งใจผูกกับบอร์นเดียว (ดู
        # check_skin ด้านบนที่ตรวจละเอียดกว่านี้แล้วว่าน้ำหนักเต็ม 1.0 บอร์นเดียว)
        # ด่านนี้จึงขัดกับ requirement ใหม่โดยตรง ตัดออกแทนที่ด้วย check_skin
        check('TEXCOORD_1' not in attributes, '%s ไม่มี UV เก่าค้าง' % wanted)

        uv = accessor(buffer, gltf, binary_offset, attributes['TEXCOORD_0'])
        flat = [coordinate for point in uv for coordinate in point]
        check(all(math.isfinite(coordinate) for coordinate in flat),
              '%s UV ไม่มี NaN/inf' % wanted)
        check(all(-1e-6 <= coordinate <= 1 + 1e-6 for coordinate in flat),
              '%s UV อยู่ใน [0,1]' % wanted)

        indices = [
            item[0] for item in accessor(
                buffer, gltf, binary_offset, primitive['indices'],
            )
        ]
        area = 0.0
        for offset in range(0, len(indices), 3):
            a, b, c = uv[indices[offset]], uv[indices[offset + 1]], uv[indices[offset + 2]]
            area += abs(
                (b[0] - a[0]) * (c[1] - a[1])
                - (c[0] - a[0]) * (b[1] - a[1])
            ) / 2
        covered = union_coverage(uv, indices)
        # ผลรวมพื้นที่สามเหลี่ยมมากกว่าพื้นที่ที่ถูกครอบจริงมาก = UV พับทับตัวเอง
        # ซึ่งทำให้ลายที่วาดไปโผล่ซ้ำสองที่บนเล็บ วัดจากผลรวมอย่างเดียวจับไม่ได้
        overlap = area / covered if covered > 0 else float('inf')
        check(overlap <= MAX_OVERLAP,
              '%s ไม่มี UV ทับซ้อนเกินที่ควร (ผลรวม/พื้นที่จริง = %.2f ≤ %.2f)'
              % (wanted, overlap, MAX_OVERLAP))

    with open(META, encoding='utf-8') as stream:
        meta = json.load(stream)
    # เว็บไม่ได้อ่าน nails.meta.json เลย เกตนี้จับได้แค่การแก้ไฟล์ meta ด้วยมือ
    # ไม่ตรงกับ mesh จริง แต่ยังตรวจไว้เพราะไฟล์นี้เป็นเอกสารอ้างอิงที่ตั้งใจให้ถูก
    check(
        meta.get('nails') == {finger: 'Nail_%s' % finger
                              for finger in ('thumb', 'index', 'middle', 'ring', 'little')},
        'meta ชี้ไปที่ mesh เล็บครบทั้ง 5 นิ้ว',
    )

    print()
    if failures:
        print('ไม่ผ่าน %d ข้อ:' % len(failures))
        for failure in failures:
            print('  -', failure)
        return 1
    print('ผ่านทั้งหมด')
    return 0


if __name__ == '__main__':
    sys.exit(main())
