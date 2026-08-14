"""แปลงโมเดลมือให้พร้อมใช้บนเว็บ — รันใน Blender เท่านั้น

blender --background --factory-startup --python tools/build_model.py

โมเดลต้นทางมีเล็บแยกเป็น mesh ห้าชิ้นพร้อม UV กางเต็ม 0-1 มาให้แล้ว งานที่เหลือ
จึงมีแค่เก็บกวาดของแปลกปลอม จัดท่านิ้วโป้ง อบท่าลง vertex แล้วเปลี่ยนชื่อให้ตรง
กับที่เว็บใช้ ไม่ต้องขุดเล็บออกจาก mesh มือหรือปั้นทรงเองเหมือนโมเดลเก่าอีกแล้ว
"""
import json
import math
import os
import sys

import bpy
import bmesh
from mathutils import Matrix, Quaternion, Vector
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nail_unwrap import FINGERS

# ROOT ยังคงเป็นรากของ repo นี้เหมือนเดิม (ไม่ใช่ apps/web) แต่ OUT_DIR ต่อ
# 'apps', 'web' เข้าไปก่อนถึง public/models เพราะโปรเจกต์ต้นทางเป็นโครงสร้างแบน
# ที่ tools/ กับ public/ อยู่ระดับเดียวกัน ส่วน repo นี้เป็น monorepo ที่ public/
# ของเว็บจริง ๆ อยู่ที่ apps/web/public/ ถ้าไม่ต่อ apps/web เข้าไป OUT_DIR จะไปสร้าง
# ไฟล์ที่ <repo root>/public/models ซึ่งเว็บไม่ได้ใช้เลย ส่วน SRC_GLB ยังอยู่ที่
# model/hand_source.glb ระดับรากของ repo นี้เหมือนเดิม ไม่ต้องแก้
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_GLB = os.path.join(ROOT, 'model', 'hand_source.glb')
OUT_DIR = os.path.join(ROOT, 'apps', 'web', 'public', 'models')
OUT_GLB = os.path.join(OUT_DIR, 'hand.glb')
OUT_META = os.path.join(OUT_DIR, 'nails.meta.json')

HAND_SRC = 'HAND_OBJECT_NAME'
HAND_OUT = 'Hand'
RIG_NAME = 'Armature'
# ทรงกลมรัศมี 1.0 ที่ติดมากับไฟล์ ใหญ่กว่ามือทั้งมือ 12 เท่า (มือสูง 0.16)
# ถ้าไม่ลบจะกลายเป็น occluder ครอบทั้งฉากแล้วการยิงรังสีของระบบระบายสีจะโดนมันหมด
STRAY = ('Icosphere',)

# โมเดลเรียกนิ้วก้อยว่า Pinky แต่เว็บเรียก little ต้องแปลงตอน export
NAIL_SRC = {
    'thumb': 'Nail_Thumb',
    'index': 'Nail_Index',
    'middle': 'Nail_Middle',
    'ring': 'Nail_Ring',
    'little': 'Nail_Pinky',
}

# หมุนนิ้วโป้งรอบแกนยาวของตัวเองกี่องศา
#
# วัดแล้วเล็บนิ้วโป้งหันต่างจากค่าเฉลี่ยของสี่นิ้ว 119.7 องศา ซึ่งเป็นกายวิภาคปกติ
# แต่ทำให้เกือบมองไม่เห็นเล็บจากมุมกล้องเริ่มต้น หมุนเต็ม 119.7 จะผิดรูปจนดูพัง
#
# ลองเรนเดอร์แล้วดูจริงด้วย tools/preview_render.py (ทั้งภาพมือเต็มและภาพซูมนิ้วโป้ง):
#   60.0 องศา — เห็นหน้าเล็บเป็นวงรีเต็มวง จัดกึ่งกลางปลายนิ้วพอดี ทาสีได้ชัดเจน
#     นิ้วยังดูเป็นนิ้วโป้งปกติ ไม่มีอาการบิดหรือล้นขอบนิ้ว นี่คือค่าที่เลือกใช้
#   75.0 องศา — ใกล้เคียงกับ 60.0 มาก เล็บยังดูเป็นวงรีปกติ แยกไม่ออกชัดเจนว่าดีกว่า
#     60.0 จริงหรือไม่
#   90.0 องศา — เริ่มเห็นเล็บเอียงไม่ตรงแกนนิ้วอีกต่อไป ขอบเล็บด้านหนึ่งเริ่มล้น
#     ออกนอกขอบเงานิ้วในภาพมือเต็ม ถือว่าเกินจุดที่ยังดูเป็นนิ้วโป้งปกติ
#
# เลือก 60.0 เพราะเห็นหน้าเล็บชัดเจนแล้วตั้งแต่ค่านี้ และยังมีระยะห่างจากจุดที่เริ่ม
# ผิดรูป (90.0) มากกว่าเลือก 75.0
#
# บทเรียนจากโมเดลเก่า: เคยหมุนนิ้วโป้ง 0.75 ของมุมเต็มแล้วนิ้วหลบไปหลังฝ่ามือ
# จนมองไม่เห็นเล็บเลย ต้องลดเหลือ 0.45 — โมเดลนี้คนละตัวคนละฐานวัด ใช้เทียบเป็น
# แนวทางไม่ได้ตรง ๆ แต่ยืนยันหลักการเดียวกัน: หมุนมากกว่าไม่ได้แปลว่าดีกว่าเสมอไป
#
# ตั้งเป็น 0.0 ตามที่เจ้าของงานสั่งให้คืนท่ามือเป็นแบบเดิม — ใช้ท่าของโมเดลต้นทาง
# ล้วน ๆ ไม่ดัดอะไรเลย แลกกับการที่เล็บนิ้วโป้งหันออกข้าง 119.7 องศาตามกายวิภาคจริง
# จึงทาสีได้ยากกว่าอีกสี่นิ้วจากมุมกล้องเริ่มต้น ผู้ใช้ต้องหมุนกล้องไปหาเอง
# ถ้าอยากได้กลับ ใส่ 60.0 คืน ค่าอื่นดูบันทึกการเรนเดอร์ด้านบน
THUMB_ROLL = 0.0


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    leftovers = [obj.name for obj in bpy.data.objects]
    if leftovers:
        raise RuntimeError('ฉากไม่ว่างหลัง factory reset: %s' % leftovers)


def import_and_clean():
    """import แล้วเก็บเฉพาะมือ เล็บห้าชิ้น และ rig ที่เหลือลบทิ้ง"""
    bpy.ops.import_scene.gltf(filepath=SRC_GLB)
    keep = {HAND_SRC, RIG_NAME} | set(NAIL_SRC.values())
    for obj in list(bpy.data.objects):
        if obj.name in keep:
            continue
        if obj.name in STRAY:
            print('CLEAN: ลบของแปลกปลอม %s (%s)' % (obj.name, obj.type))
        else:
            print('CLEAN: ลบ object ที่ไม่ได้ใช้ %s (%s)' % (obj.name, obj.type))
        bpy.data.objects.remove(obj, do_unlink=True)

    missing = [name for name in keep if name not in bpy.data.objects]
    if missing:
        raise RuntimeError('โมเดลต้นทางขาด object: %s' % sorted(missing))
    return bpy.data.objects[HAND_SRC], bpy.data.objects[RIG_NAME]


def nail_facing(obj, rig, base_bone, tip_bone):
    """ทิศที่หน้าเล็บหันไป

    ห้ามใช้ค่าเฉลี่ย normal ของทุกหน้า เพราะเล็บสามชิ้น (โป้ง กลาง ก้อย) เป็นก้อนปิด
    หน้าบนกับหน้าล่างหักล้างกันจนเหลือเกือบศูนย์ แล้ว normalize จะได้ทิศจาก error
    ปัดเศษล้วน ๆ วิธีนั้นให้ค่านิ้วก้อย 140.1 องศาทั้งที่ภาพเรนเดอร์เห็นชัดว่าปกติ

    วิธีที่ถูก: แกนที่ 3 ของ PCA คือทิศทะลุความหนา (แบนสุด) ส่วนเครื่องหมายเอาจาก
    "ต้องชี้ออกจากแกนกระดูกนิ้ว" ซึ่งไม่กำกวมเพราะเล็บอยู่บนหลังนิ้วเสมอ
    """
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    matrix = evaluated.matrix_world
    points = np.array([[float(x) for x in (matrix @ v.co)] for v in mesh.vertices])
    evaluated.to_mesh_clear()

    def head(name):
        return np.array([float(x) for x in (rig.matrix_world @ rig.pose.bones[name].head)])

    centre = points.mean(axis=0)
    along = head(tip_bone) - head(base_bone)
    along /= np.linalg.norm(along)
    _, _, vectors = np.linalg.svd(points - centre, full_matrices=False)
    normal = np.array(vectors[2], dtype=np.float64)

    offset = centre - head(base_bone)
    offset -= along * float(np.dot(offset, along))
    if np.linalg.norm(offset) < 1e-9:
        raise RuntimeError('เล็บ %s อยู่บนแกนกระดูกพอดี หาทิศหน้าเล็บไม่ได้' % obj.name)
    if float(np.dot(normal, offset)) < 0:
        normal = -normal
    return normal, along


def report_facings(rig):
    """พิมพ์ว่าเล็บแต่ละนิ้วหันต่างจากค่าเฉลี่ยสี่นิ้วกี่องศา"""
    facings = {}
    for finger, source in NAIL_SRC.items():
        # ชื่อกระดูกมาจากชื่อ object ตรง ๆ: Nail_Thumb -> Thumb3, Thumb4
        stem = source.split('_')[1]
        facings[finger], _ = nail_facing(
            bpy.data.objects[source], rig, '%s3' % stem, '%s4' % stem,
        )
    four = np.mean([facings[f] for f in facings if f != 'thumb'], axis=0)
    four /= np.linalg.norm(four)
    for finger in FINGERS:
        angle = math.degrees(math.acos(
            min(1.0, max(-1.0, float(np.dot(facings[finger], four)))),
        ))
        print('FACE: %-7s ต่างจากค่าเฉลี่ยสี่นิ้ว %5.1f องศา' % (finger, angle))
    return facings


def roll_thumb(rig, degrees):
    """หมุนนิ้วโป้งรอบแกนยาวของตัวเอง เพื่อให้เล็บหันออกมาพอทาสีได้

    ตั้งค่าผ่าน pose_bone.matrix ซึ่งอยู่ในพิกัด armature แล้วให้ Blender ถอดค่าหมุน
    ท้องถิ่นเอง จะได้ไม่ต้องแปลงพิกัดเองให้ผิด
    """
    if abs(degrees) < 1e-6:
        print('ROLL: ข้าม ไม่ได้ตั้งมุมไว้')
        return
    bpy.context.view_layer.update()
    base = rig.pose.bones['Thumb2']
    tip = rig.pose.bones['Thumb4']
    axis = (rig.matrix_world @ tip.tail) - (rig.matrix_world @ base.head)
    if axis.length < 1e-9:
        raise RuntimeError('นิ้วโป้งยาวเป็นศูนย์ หาแกนหมุนไม่ได้')
    axis.normalize()
    rotation = Quaternion(axis, math.radians(degrees))
    pivot = Matrix.Translation(base.head)
    base.matrix = pivot @ rotation.to_matrix().to_4x4() @ pivot.inverted() @ base.matrix
    bpy.context.view_layer.update()
    print('ROLL: หมุนนิ้วโป้ง %.1f องศา รอบแกน (%+.3f %+.3f %+.3f)'
          % (degrees, axis.x, axis.y, axis.z))


def keep_rig(rig):
    """คงบอร์นและ skin ไว้ ไม่อบท่าลง vertex อีกต่อไป

    เดิมฟังก์ชันนี้ชื่อ bake_pose และ apply armature modifier ทิ้งเพื่อให้ท่าติดไป
    กับไฟล์แน่ ๆ (เคยลองส่งท่าผ่าน exporter แล้วไม่สำเร็จกับโมเดลรุ่นก่อน) แลกกับ
    การเสีย skinning ซึ่งตอนนั้นเว็บไม่ได้ใช้

    ตอนนี้เว็บต้องใช้ — สไลเดอร์ปรับสัดส่วนมือทำงานด้วยการตั้ง scale ที่บอร์น
    ถ้าอบท่าทิ้งไปก็ไม่เหลืออะไรให้ปรับ จึงคงไว้ทั้งชุดแล้วให้ท่าเดินทางไปกับ
    node transform ของบอร์นแทน (export_rest_position_armature=False)
    """
    meshes = [obj for obj in bpy.data.objects if obj.type == 'MESH']
    bound = [obj for obj in meshes
             if any(item.type == 'ARMATURE' for item in obj.modifiers)]
    expected = 1 + len(NAIL_SRC)
    if len(bound) != expected:
        raise RuntimeError('mesh ที่ผูก armature มี %d ชิ้น จาก %d ที่ควรมี'
                           % (len(bound), expected))
    for obj in bound:
        if obj.parent is not rig:
            raise RuntimeError('%s ไม่ได้เป็นลูกของ %s' % (obj.name, rig.name))
    print('RIG: คงบอร์นไว้ %d ชิ้น mesh ที่ผูก armature %d ชิ้น'
          % (len(rig.data.bones), len(bound)))


def drop_actions(rig):
    """ตัด action ทิ้งก่อน export

    exporter เขียน bind pose ตาม action ที่ผูกอยู่กับ rig แทนท่าที่จัดไว้จริง
    (บันทึกไว้ที่ tools/verify_model.py ตอนเจอปัญหานี้ครั้งแรก) ตั้ง
    export_animations=False อย่างเดียวไม่พอ เพราะมันคุมแค่ว่าจะเขียน animation
    ออกไปไหม ไม่ได้คุมว่า bind pose มาจากไหน ตัดที่ต้นทางให้ไม่เหลืออะไรให้หยิบ
    """
    if rig.animation_data:
        rig.animation_data_clear()
    for action in list(bpy.data.actions):
        print('CLEAN: ตัด action %s ทิ้ง' % action.name)
        bpy.data.actions.remove(action)
    if bpy.data.actions:
        raise RuntimeError('ยังเหลือ action ค้างอยู่ %d ตัว' % len(bpy.data.actions))


def is_watertight(obj):
    """mesh ปิดสนิทไหม — ทุกขอบต้องถูกใช้โดยสองหน้าพอดี"""
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    closed = all(len(edge.link_faces) == 2 for edge in mesh.edges)
    mesh.free()
    return closed


def signed_volume(obj):
    """ปริมาตรเชิงเครื่องหมาย — บวกคือหน้าหันออก ใช้ได้เฉพาะ mesh ที่ปิดสนิท

    ใช้ทฤษฎีบทไดเวอร์เจนซ์: รวม v0 . (v1 x v2) / 6 ทุกสามเหลี่ยม
    ห้ามใช้กับเปลือกเปิด เพราะค่าจะขึ้นกับระยะจากจุดกำเนิดแทนที่จะบอกทิศหน้า
    """
    mesh = obj.data
    mesh.calc_loop_triangles()
    total = 0.0
    for tri in mesh.loop_triangles:
        a, b, c = (mesh.vertices[i].co for i in tri.vertices)
        total += a.dot(b.cross(c))
    return total / 6.0


def skin_direction_under(obj, hand, sample=40):
    """ทิศที่ผิวมือใต้เล็บชิ้นนี้หันไป — ใช้เป็นตัวอ้างอิงว่า 'ออกนอกนิ้ว' คือทางไหน"""
    centre = sum((obj.matrix_world @ v.co for v in obj.data.vertices),
                 Vector((0.0, 0.0, 0.0))) / len(obj.data.vertices)
    rotation = hand.matrix_world.to_3x3()
    ranked = sorted(hand.data.vertices,
                    key=lambda v: ((hand.matrix_world @ v.co) - centre).length)
    direction = Vector((0.0, 0.0, 0.0))
    for vertex in ranked[:sample]:
        direction += (rotation @ vertex.normal).normalized()
    if direction.length < 1e-9:
        raise RuntimeError('หาทิศผิวมือใต้เล็บ %s ไม่ได้' % obj.name)
    return direction.normalized()


def faces_point_outward(obj, hand):
    """หน้าเล็บหันออกจากนิ้วหรือไม่

    ต้องแยกวิธีวัดตามชนิดของ mesh เพราะไม่มีวิธีเดียวที่ใช้ได้กับทั้งสองแบบ:
    ปริมาตรเชิงเครื่องหมายใช้ได้เฉพาะก้อนปิด ส่วน normal เฉลี่ยใช้ได้เฉพาะเปลือกเปิด
    (ก้อนปิดมีหน้าบนกับหน้าล่างหักล้างกันจนเหลือเกือบศูนย์ วัดไม่ได้)

    เคยพลาดตรงนี้มาแล้ว: ใช้ปริมาตรอย่างเดียวกับทุกเล็บ แล้วเล็บชี้กับนางซึ่งเป็น
    เปลือกเปิดให้ค่าบวกจากระยะห่างจุดกำเนิด ไม่ใช่จากทิศหน้า จึงถูกข้ามไปทั้งที่
    กลับด้านอยู่ วัดซ้ำด้วย normal พบว่าหน้าที่หันออกเป็น 0%
    """
    if is_watertight(obj):
        return signed_volume(obj) > 0.0
    outward = skin_direction_under(obj, hand)
    rotation = obj.matrix_world.to_3x3()
    agree = sum(1 for polygon in obj.data.polygons
                if (rotation @ polygon.normal).dot(outward) > 0.0)
    return agree * 2 > len(obj.data.polygons)


def fix_nail_normals(hand):
    """กลับทิศหน้าเล็บที่กลับด้านให้หันออกทั้งหมด

    วัดจากไฟล์ต้นทางแล้วพบว่าเล็บทั้งห้าหันหน้าเข้าเนื้อนิ้ว — เป็นมาแต่ต้นทาง
    ไม่ใช่ pipeline นี้ทำ (เทียบไฟล์ต้นทางกับไฟล์ที่ export แล้วตรงกัน)

    ปล่อยไว้ไม่ได้เพราะพังสองทางพร้อมกัน: three.js ตัดหน้าหลังทิ้งตามค่าเริ่มต้น
    (FrontSide) จึงเรนเดอร์ผิวด้านในของก้อนเล็บออกมาเป็นสีดำ และ Raycaster ก็เคารพ
    material.side เหมือนกัน รังสีจึงทะลุผ่านเล็บไปโดยไม่เกิด intersection
    ผู้ใช้เลยทาสีบนเล็บใน 3D ไม่ได้เลย ทั้งที่ทุกด่านตรวจผ่านหมด
    """
    for finger, source in NAIL_SRC.items():
        obj = bpy.data.objects[source]
        # ล้าง custom split normals ของทุกเล็บก่อนเสมอ ไม่ใช่เฉพาะชิ้นที่ต้องกลับหน้า
        #
        # โมเดลนี้ฝัง normal มาเองและมันไม่ตรงกับลำดับจุด วัดแล้วเล็บชี้กับนางมีลำดับ
        # จุดถูกต้อง 100% แต่ normal ที่ฝังมาชี้สวนทางผิวมือ (-0.89) พอเคยล้างเฉพาะ
        # ชิ้นที่กลับหน้า สองนิ้วนี้จึงรอดออกไปทั้งที่ normal ผิด เรนเดอร์ออกมาดำอยู่ดี
        # ล้างทิ้งทั้งหมดแล้วให้ Blender คำนวณจากลำดับจุด เหลือแหล่งความจริงเดียว
        if obj.data.has_custom_normals:
            bpy.ops.object.select_all(action='DESELECT')
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            bpy.ops.mesh.customdata_custom_splitnormals_clear()
            print('NORMALS: %-7s ล้าง custom split normals ที่ฝังมา' % finger)
        kind = 'ก้อนปิด' if is_watertight(obj) else 'เปลือกเปิด'
        if faces_point_outward(obj, hand):
            print('NORMALS: %-7s ทิศหน้าถูกอยู่แล้ว (%s)' % (finger, kind))
            continue
        # กลับลำดับจุดตรง ๆ ด้วย bmesh ไม่ใช้ normals_make_consistent
        #
        # ลอง normals_make_consistent(inside=False) ก่อนแล้ว วัดได้ปริมาตรยังติดลบ
        # เท่าเดิม มันคือการทำให้ "สอดคล้องกันเอง" ตามการเดาของ Blender ซึ่ง mesh
        # ชุดนี้สอดคล้องกันอยู่แล้ว แค่สอดคล้องกันในทางที่กลับด้าน
        # reverse_faces กลับทุกหน้าแน่นอนโดยไม่ต้องเดา แล้วเราวัดผลยืนยันอีกชั้น
        mesh = bmesh.new()
        mesh.from_mesh(obj.data)
        bmesh.ops.reverse_faces(mesh, faces=mesh.faces)
        mesh.to_mesh(obj.data)
        mesh.free()
        obj.data.update()
        if not faces_point_outward(obj, hand):
            raise RuntimeError('กลับทิศหน้าเล็บ %s แล้วยังไม่หันออก' % finger)
        print('NORMALS: %-7s กลับทิศหน้าแล้ว (%s)' % (finger, kind))


def rename_meshes():
    """เปลี่ยนชื่อ object และ mesh data ให้ตรงกับที่เว็บมองหา"""
    hand = bpy.data.objects[HAND_SRC]
    hand.name = HAND_OUT
    hand.data.name = '%s_Mesh' % HAND_OUT
    for finger, source in NAIL_SRC.items():
        obj = bpy.data.objects[source]
        obj.name = 'Nail_%s' % finger
        obj.data.name = 'Nail_%s_Mesh' % finger
        print('NAME: %s -> %s' % (source, obj.name))


def main():
    reset_scene()
    _hand, rig = import_and_clean()
    report_facings(rig)
    roll_thumb(rig, THUMB_ROLL)
    fix_nail_normals(_hand)
    drop_actions(rig)
    keep_rig(rig)
    rename_meshes()

    os.makedirs(OUT_DIR, exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        export_format='GLB',
        # คง texture ขนาดเดิม 2048 ไว้ ไม่ย่อ เพื่อความคมชัดสูงสุด
        export_image_format='AUTO',
        export_animations=False,
        # ต้องเปิด เพื่อให้สไลเดอร์ปรับสัดส่วนมือฝั่งเว็บมีบอร์นให้ปรับ
        export_skins=True,
        # ต้องเป็น False ไม่งั้นจะได้ท่า rest แทนท่าจริงของโมเดลต้นทาง
        export_rest_position_armature=False,
        export_apply=False,
    )
    # เว็บปัจจุบันไม่ได้อ่านไฟล์นี้เลย เก็บไว้เป็นสัญญา/เอกสารอ้างอิงว่าเล็บนิ้วไหน
    # ตรงกับ mesh ชื่ออะไร เผื่อมีระบบภายนอกอื่นมาต่อยอดในอนาคต
    meta = {'nails': {finger: 'Nail_%s' % finger for finger in FINGERS}}
    with open(OUT_META, 'w', encoding='utf-8') as stream:
        json.dump(meta, stream, ensure_ascii=False, indent=2)
    print('DONE: %s %.2f MB' % (OUT_GLB, os.path.getsize(OUT_GLB) / 1e6))


if __name__ == '__main__':
    main()
