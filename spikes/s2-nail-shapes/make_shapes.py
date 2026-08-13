"""
Spike S2 — สร้างทรงเล็บเป็น morph target ด้วยการดัด geometry ตามแกนที่หาด้วย PCA

รันด้วย:
    blender --background --python make_shapes.py -- <in.glb> <out.glb>

ปัญหาที่ต้องแก้
---------------
โมเดลต้นทางมีเล็บเป็น geometry ที่ปั้นมาแล้วทรงเดียว (round) และ topology ของแต่ละนิ้ว
ไม่เท่ากันเลย (index=81, middle=197, little=201, thumb=203, ring=289 verts)
จึงเขียนสูตรดัดที่อ้างดัชนี vertex ตายตัวไม่ได้ ต้องหากรอบพิกัดของเล็บแต่ละชิ้นเอง

วิธี
----
1. หาแกนหลักของเล็บด้วย PCA (eigen decomposition ของเมทริกซ์ความแปรปรวนร่วม 3×3)
   e0 = แกนยาว (โคนเล็บ → ปลายเล็บ)   e1 = แกนกว้าง   e2 = แกนหนา
2. ตัดสินว่าปลายไหนคือ "ปลายเล็บ" โดยเทียบความกว้างของสองฝั่ง — ฝั่งที่แคบกว่าคือปลาย
3. แปลงทุกจุดเป็นพิกัด (t, w, d) เทียบแกนเหล่านั้น แล้ว normalize t ให้อยู่ใน [0,1]
4. ใช้ฟังก์ชันน้ำหนัก g(t) ที่เป็น 0 แถวโคนเล็บและ 1 ที่ปลาย — การดัดจึงไม่แตะโคนเล็บ
   ซึ่งสำคัญมาก เพราะโคนเล็บต้องแนบกับผิวนิ้วเสมอไม่ว่าจะเลือกทรงไหน
5. สร้าง shape key หนึ่งอันต่อทรง แล้ว export เป็น morph target ใน glTF

ความซับซ้อน
-----------
สร้าง covariance : O(V)      eigen ของเมทริกซ์ 3×3 : O(1)
ดัดหนึ่งทรง      : O(V)      ทั้งหมด S ทรง × N เล็บ : O(S · N · V)
ที่ V ≤ 289, S = 4, N = 5 → ราว 5,800 การดำเนินการ ทำครั้งเดียวตอน build ไม่ใช่ runtime
"""

import sys
import numpy as np

import bpy

# ทรงพื้นฐานของโมเดลต้นทางคือ round จึงไม่ต้องมี shape key ของตัวเอง
SHAPES = ("almond", "square", "squoval", "stiletto")

# ช่วงที่เริ่มดัด — ต่ำกว่านี้คือโคนเล็บที่ต้องคงรูปไว้ให้แนบผิวนิ้ว
TAPER_START = 0.45


def log(message: str) -> None:
    print(f"[S2] {message}", flush=True)


def nail_objects():
    """คืน mesh ของเล็บทั้งห้า — รองรับทั้งชื่อ Nail_index และ Nail_index_Mesh"""
    found = {}
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        parts = obj.name.split("_")
        if parts[0] != "Nail" or len(parts) < 2:
            continue
        found[parts[1]] = obj
    return found


def local_frame(coords: np.ndarray):
    """หาแกนหลักของเล็บด้วย PCA และคืนพิกัด (t, w, d) ที่ normalize แล้ว

    ใช้ eigh ไม่ใช่ eig เพราะเมทริกซ์ความแปรปรวนร่วมเป็น symmetric เสมอ
    eigh เร็วกว่าและคืนค่าจริงเสมอ (eig อาจคืนจำนวนเชิงซ้อนจาก error การปัดเศษ)
    """
    centroid = coords.mean(axis=0)
    centered = coords - centroid
    covariance = centered.T @ centered / len(coords)
    eigenvalues, eigenvectors = np.linalg.eigh(covariance)
    order = np.argsort(eigenvalues)[::-1]
    axes = eigenvectors[:, order].T  # แถวที่ 0 = แกนที่กระจายมากสุด = แกนยาว

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


def taper_weight(t01: np.ndarray) -> np.ndarray:
    """0 ที่โคนเล็บ → 1 ที่ปลายเล็บ แบบนุ่มนวล (ยกกำลังสองกันรอยหักที่จุดเริ่ม)"""
    raw = np.clip((t01 - TAPER_START) / (1.0 - TAPER_START), 0.0, 1.0)
    return raw * raw


def deform(shape: str, t01, w, d, span):
    """คืนส่วนต่างของ (t, w, d) สำหรับทรงที่ระบุ

    หลักการของแต่ละทรง:
      almond   — สอบปลายเข้าหาแกนกลาง แล้วยืดตรงกลางออกนิดหน่อยให้ปลายมน ๆ แหลม
      stiletto — เหมือน almond แต่สอบแรงกว่าและยืดยาวกว่ามาก
      square   — ดันขอบข้างไปข้างหน้าให้ทันจุดกึ่งกลาง ทำให้ขอบหน้าที่เดิมโค้งกลายเป็นเส้นตรง
                 (นี่คือเหตุผลที่ใช้ w_norm เป็นตัวคูณ — ขอบขยับมาก จุดกลางขยับน้อย)
      squoval  — square ครึ่งแรง บวกการสอบเล็กน้อย = สี่เหลี่ยมมุมมน
    """
    g = taper_weight(t01)
    w_norm = np.abs(w) / max(np.abs(w).max(), 1e-9)

    if shape == "almond":
        return (1.0 - w_norm) * 0.10 * span * g, -w * 0.55 * g, np.zeros_like(d)
    if shape == "stiletto":
        return (1.0 - w_norm) * 0.34 * span * g, -w * 0.85 * g, np.zeros_like(d)
    if shape == "square":
        return w_norm * 0.11 * span * g, w * 0.18 * g, np.zeros_like(d)
    if shape == "squoval":
        return w_norm * 0.055 * span * g, w * 0.06 * g, np.zeros_like(d)
    raise ValueError(f"ไม่รู้จักทรง {shape}")


def add_shape_keys(obj) -> None:
    mesh = obj.data
    count = len(mesh.vertices)

    coords = np.empty(count * 3, dtype=np.float64)
    mesh.vertices.foreach_get("co", coords)
    coords = coords.reshape(count, 3)

    centroid, axes, t01, w, d, span = local_frame(coords)

    # พิกัดของ mesh อยู่ในสเกลของไฟล์ต้นทาง ไม่ใช่สเกลของฉาก — โมเดลนี้ถูกย่อ ~34 เท่า
    # ที่ระดับ armature ถ้ารายงานเป็นมิลลิเมตรจากพิกัด mesh ตรง ๆ จะได้ "เล็บยาว 326 มม."
    # ซึ่งผิด ต้องคูณสเกลโลกก่อนเสมอ
    #
    # หมายเหตุ: การดัดทั้งหมดคิดเป็น "สัดส่วนของ span" จึงไม่ขึ้นกับสเกล —
    # สเกลมีผลกับการรายงานเท่านั้น ไม่มีผลกับความถูกต้องของรูปทรง
    world_scale = float(sum(obj.matrix_world.to_scale()) / 3.0)

    if obj.data.shape_keys is None:
        obj.shape_key_add(name="Basis", from_mix=False)

    peak = 0.0
    for shape in SHAPES:
        dt, dw, dd = deform(shape, t01, w, d, span)
        # แปลงส่วนต่างในพิกัดของเล็บกลับเป็นพิกัดของ mesh
        delta = np.outer(dt, axes[0]) + np.outer(dw, axes[1]) + np.outer(dd, axes[2])
        peak = max(peak, float(np.linalg.norm(delta, axis=1).max()))

        key = obj.shape_key_add(name=shape, from_mix=False)
        key.data.foreach_set("co", (coords + delta).reshape(-1))
        key.value = 0.0

    # ตรวจว่าโคนเล็บไม่ขยับจริง — ถ้าขยับ เล็บจะหลุดจากผิวนิ้วเมื่อสลับทรง
    base_moved = float(np.abs(taper_weight(t01)[t01 < TAPER_START]).max(initial=0.0))

    log(
        f"{obj.name:<18} verts={count:>4} "
        f"ยาว={span * world_scale * 1000:6.2f}มม. "
        f"ขยับสูงสุด={peak * world_scale * 1000:5.2f}มม. "
        f"โคนเล็บขยับ={base_moved:.3f} "
        f"shape_keys={len(SHAPES)}"
    )


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if len(argv) != 2:
        raise SystemExit("ใช้: blender --background --python make_shapes.py -- <in.glb> <out.glb>")
    source, target = argv

    bpy.ops.wm.read_factory_settings(use_empty=True)
    log(f"นำเข้า {source}")
    bpy.ops.import_scene.gltf(filepath=source)

    nails = nail_objects()
    log(f"เจอ mesh เล็บ {len(nails)} ชิ้น: {', '.join(sorted(nails))}")
    if len(nails) != 5:
        raise SystemExit(f"คาดว่าจะเจอเล็บ 5 ชิ้น แต่เจอ {len(nails)}")

    for name in sorted(nails):
        add_shape_keys(nails[name])

    log(f"ส่งออก {target}")
    bpy.ops.export_scene.gltf(
        filepath=target,
        export_format="GLB",
        export_morph=True,
        export_morph_normal=True,
        export_skins=True,
        export_apply=False,
    )
    log("เสร็จ")


if __name__ == "__main__":
    main()
