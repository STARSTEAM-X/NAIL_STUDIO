"""เรนเดอร์ภาพตรวจเล็บ — รันใน Blender

    blender --background --factory-startup --python tools/preview_render.py
    blender --background --factory-startup --python tools/preview_render.py -- thumb

ใช้ดูว่าเล็บหันออกมาพอทาสีได้ทุกนิ้ว โดยเฉพาะนิ้วโป้งที่ต้องหมุนด้วย THUMB_ROLL
"""
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GLB = os.path.join(ROOT, 'public', 'models', 'hand.glb')
FINGERS = ('thumb', 'index', 'middle', 'ring', 'little')


def frame_on_nails(camera_object, target):
    """เล็งกล้องไปที่ปลายนิ้วแทนที่จะเป็นทั้งมือ เพื่อให้เห็นทรงเล็บชัด"""
    direction = target - camera_object.location
    camera_object.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    finger = argv[0] if argv else None
    if finger is not None and finger not in FINGERS:
        raise SystemExit('นิ้วที่รองรับ: %s' % ', '.join(FINGERS))

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=GLB)

    nails = [
        obj for obj in bpy.data.objects
        if obj.name.startswith('Nail_')
        and (finger is None or obj.name.split('_')[1] == finger)
    ]
    if not nails:
        raise SystemExit('ไม่พบเล็บในไฟล์')
    if finger:
        # ซ่อนเล็บนิ้วอื่น ไม่งั้นกล้องที่ซูมเข้ามาจะติดเล็บข้างเคียงเข้ามาในเฟรม
        for obj in bpy.data.objects:
            if obj.name.startswith('Nail_') and obj not in nails:
                obj.hide_render = True

    # ทุกอย่างต้องอ่านจาก mesh ที่ผ่าน depsgraph แล้ว ไม่ใช่ mesh ดิบ
    #
    # bound_box กับ polygon.normal ของ object ดิบไม่เคยเห็น armature deform
    # ตอนลองจัดท่ามือครั้งแรก ค่า facing ออกมาเท่าเดิมเป๊ะทุกหลักทศนิยมทั้งที่
    # จัดท่าไปแล้ว กล้องจึงเล็งตามท่าพักขณะที่ภาพเป็นท่าใหม่
    depsgraph = bpy.context.evaluated_depsgraph_get()

    def evaluated_polygons(obj):
        """คืน (matrix_world, list ของ polygon) หลังผ่าน modifier ทั้งหมดแล้ว"""
        evaluated = obj.evaluated_get(depsgraph)
        return evaluated.matrix_world, evaluated.to_mesh()

    centre = Vector((0, 0, 0))
    count = 0
    for obj in nails:
        matrix, mesh_data = evaluated_polygons(obj)
        for vertex in mesh_data.vertices:
            centre += matrix @ vertex.co
            count += 1
        obj.evaluated_get(depsgraph).to_mesh_clear()
    centre /= count

    # ย้อมเล็บที่กำลังตรวจให้เป็นสีแดงสด ผิวมือกับเล็บเป็นสีขาวทั้งคู่
    # ถ้าไม่ย้อมจะแยกไม่ออกว่าเล็บวางอยู่ตรงไหนหรือหายไปไหน
    marker = bpy.data.materials.new('PreviewNail')
    marker.use_nodes = True
    principled = marker.node_tree.nodes['Principled BSDF']
    principled.inputs['Base Color'].default_value = (0.42, 0.45, 0.28, 1)
    principled.inputs['Roughness'].default_value = 0.85
    for obj in nails:
        obj.data.materials.clear()
        obj.data.materials.append(marker)

    camera_data = bpy.data.cameras.new('PreviewCam')
    camera_data.lens = 60
    # near-clip เริ่มต้นของ Blender คือ 0.1 ม. แต่มือทั้งมือสูงราว 0.25 ม.
    # ถ้าไม่ลดค่านี้ ภาพซูมใกล้จะถูกตัดจนได้เฟรมว่างเปล่า
    camera_data.clip_start = 0.0005
    camera_data.clip_end = 5.0
    camera = bpy.data.objects.new('PreviewCam', camera_data)
    bpy.context.collection.objects.link(camera)

    # ทิศหน้าเล็บ: แกนที่ 3 ของ PCA ของกลุ่มจุดเล็บทั้งหมด แล้วเลือกเครื่องหมายให้
    # ชี้ออกจากใจกลางมือ ห้ามเฉลี่ย normal ของทุกหน้า เพราะเล็บสามชิ้นเป็นก้อนปิด
    # หน้าบนกับหน้าล่างหักล้างกันจนเหลือเกือบศูนย์ แล้วทิศที่ได้จะมาจาก error ปัดเศษ
    #
    # ต้องวางบล็อกนี้ไว้หลังจากคำนวณ centre แล้ว เพราะใช้ centre หาเครื่องหมาย
    cloud = []
    for obj in nails:
        matrix, mesh_data = evaluated_polygons(obj)
        for vertex in mesh_data.vertices:
            cloud.append([float(x) for x in (matrix @ vertex.co)])
        obj.evaluated_get(depsgraph).to_mesh_clear()
    cloud = np.array(cloud)
    _, _, vectors = np.linalg.svd(cloud - cloud.mean(axis=0), full_matrices=False)
    facing = Vector([float(x) for x in vectors[2]])
    hand = bpy.data.objects.get('Hand')
    if hand is None:
        raise SystemExit('ไม่พบ mesh ชื่อ Hand ในไฟล์')

    # หาเครื่องหมายของ facing จาก normal ผิวหนังใต้เล็บแต่ละชิ้น ห้ามใช้ระยะจาก
    # origin ของมือ (ที่ข้อมือ) ไปยัง centre ของเล็บ เพราะปลายนิ้วอยู่ไกลจากข้อมือ
    # ตามแกนยาวของนิ้วมากกว่าตามแกนหน้า-หลังของมือมาก ผลต่างตำแหน่งจึงถูกครอบงำ
    # ด้วยทิศยาวของนิ้ว (ขึ้นไปตามนิ้ว) ไม่ใช่ทิศหน้า-หลังที่ต้องการแยกฝ่ามือออกจาก
    # หลังมือ — ลองแล้วได้เครื่องหมายที่พลิกกลับ กล้องไปเล็งฝ่ามือแทนหลังมือ
    hand_matrix, hand_mesh = evaluated_polygons(hand)
    hand_rotation = hand_matrix.to_3x3()
    hand_points = np.array([[float(x) for x in (hand_matrix @ v.co)] for v in hand_mesh.vertices])
    hand_normals = np.array([[float(x) for x in (hand_rotation @ v.normal)] for v in hand_mesh.vertices])
    hand.evaluated_get(depsgraph).to_mesh_clear()

    outward = np.zeros(3)
    for obj in nails:
        matrix, mesh_data = evaluated_polygons(obj)
        nail_points = np.array([[float(x) for x in (matrix @ v.co)] for v in mesh_data.vertices])
        obj.evaluated_get(depsgraph).to_mesh_clear()
        nail_centre = nail_points.mean(axis=0)
        distances = np.linalg.norm(hand_points - nail_centre, axis=1)
        nearest = np.argsort(distances)[:20]
        outward += hand_normals[nearest].mean(axis=0)
    outward = Vector([float(x) for x in outward])

    if facing.dot(outward) < 0:
        facing = -facing
    facing.normalize()
    print('FACING: %.3f %.3f %.3f' % (facing.x, facing.y, facing.z))
    camera.location = centre + facing * (0.05 if finger else 0.28)
    frame_on_nails(camera, centre)
    bpy.context.scene.camera = camera

    key = bpy.data.objects.new('Key', bpy.data.lights.new('Key', type='AREA'))
    key.data.energy = 6
    key.data.size = 0.35
    key.location = camera.location + Vector((0.06, 0.0, 0.10))
    key.rotation_euler = (Vector((0, 0, 0)) - Vector(key.location - centre)).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.collection.objects.link(key)

    fill = bpy.data.objects.new('Fill', bpy.data.lights.new('Fill', type='AREA'))
    fill.data.energy = 2
    fill.data.size = 0.5
    fill.location = camera.location + Vector((-0.12, 0.0, -0.04))
    bpy.context.collection.objects.link(fill)

    world = bpy.data.worlds.new('PreviewWorld')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.04, 0.04, 0.05, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = 1.0
    bpy.context.scene.world = world

    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 900
    scene.render.resolution_y = 700
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = 'PNG'
    out = os.path.join(ROOT, 'public', 'models',
                       'preview%s.png' % (('_' + finger) if finger else ''))
    scene.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print('PREVIEW: %s' % out)


if __name__ == '__main__':
    main()
