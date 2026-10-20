"""Original procedural hand, authored from scratch; execute through Blender MCP.

No existing hand mesh, texture, armature or third-party asset is read.
Stages are callable separately so the live Blender stays reviewable.
"""
import math
import os
import json
import bpy
import bmesh
from mathutils import Vector, Matrix

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'apps', 'web', 'public', 'models')
FINGERS = {
    'index': ((-.025, .087, 0), (-.105, .994, -.015), (.037, .023, .019), .0087),
    'middle': ((-.006, .095, 0), (0, 1, -.015), (.042, .026, .020), .0091),
    'ring': ((.014, .090, -.0005), (.075, .997, -.025), (.039, .024, .019), .0085),
    'little': ((.031, .078, -.001), (.19, .981, -.025), (.030, .020, .017), .0070),
    'thumb': ((-.029, .030, -.002), (-.73, .68, -.035), (.030, .025, .022), .0100),
}
STEMS = {'thumb': 'Thumb', 'index': 'Index', 'middle': 'Middle', 'ring': 'Ring', 'little': 'Pinky'}


def mesh_object(name, vertices, faces, collection):
    data = bpy.data.meshes.new(name + '_Mesh')
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    for polygon in data.polygons:
        polygon.use_smooth = True
    return obj


def loft(name, rings, collection, sides=48):
    """rings = (center, across, normal, halfwidth, halfdepth), closed at both ends."""
    vertices, faces = [], []
    for center, across, normal, width, depth in rings:
        for side in range(sides):
            angle = side * math.tau / sides
            # A subtly flattened dorsum, fuller volar pad, no cylindrical tubes.
            z = math.cos(angle)
            z = math.copysign(abs(z) ** .82, z)
            point = center + across * (width * math.sin(angle)) + normal * (depth * z)
            vertices.append(tuple(point))
    for row in range(len(rings) - 1):
        for side in range(sides):
            a = row * sides + side
            b = row * sides + (side + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces.append(tuple(reversed(range(sides))))
    faces.append(tuple((len(rings) - 1) * sides + side for side in range(sides)))
    return mesh_object(name, vertices, faces, collection)


def finger_frame(finger):
    start, direction, lengths, radius = FINGERS[finger]
    along = Vector(direction).normalized()
    normal = Vector((-.20, -.16, .97)) if finger == 'thumb' else Vector((0, .015, 1))
    normal = (normal - along * normal.dot(along)).normalized()
    across = along.cross(normal).normalized()
    return Vector(start), along, across, normal, lengths, radius


def build_skin():
    # A dedicated scene preserves unrelated objects in any existing user scene.
    scene = bpy.data.scenes.new('Realistic Hand Studio')
    bpy.context.window.scene = scene
    collection = bpy.data.collections.new('HandSystem')
    scene.collection.children.link(collection)
    rings = []
    # Width and depth define the wrist, carpal heel, metacarpal fan and knuckles.
    profile = [(-.035, .020, .012), (-.022, .0205, .012), (-.005, .021, .0125),
               (.012, .024, .014), (.030, .031, .0145), (.052, .037, .013),
               (.072, .038, .0115), (.087, .031, .010), (.098, .019, .007)]
    for y, width, depth in profile:
        rings.append((Vector((.003, y, -.002)), Vector((1, 0, 0)), Vector((0, 0, 1)), width, depth))
    pieces = [loft('PalmVolume', rings, collection, 64)]
    for finger in FINGERS:
        start, along, across, normal, lengths, radius = finger_frame(finger)
        total = sum(lengths)
        rings = []
        for row in range(49):
            t = row / 48
            s = -.011 + (total + .011) * t
            q = max(0, s / total)
            # Proximal phalanx, PIP knuckle, distal pad, rounded fingertip.
            taper = 1 - .22 * q
            knuckle = 1 + .07 * math.exp(-((s - lengths[0]) / .006) ** 2)
            cap = math.sqrt(max(.008, 1 - max(0, (q - .89) / .11) ** 2))
            w = radius * taper * knuckle * cap
            depth = w * (.79 if finger == 'thumb' else .80)
            center = start + along * s + normal * (-.0015 * math.sin(math.pi * q))
            rings.append((center, across, normal, w, depth))
        pieces.append(loft('Volume_' + finger, rings, collection))
    # Thenar and hypothenar volumes, anatomically distinct pads in the palm.
    for name, center, scale in [('Thenar', (-.022, .035, -.007), (.018, .032, .014)), ('Hypothenar', (.023, .030, -.007), (.013, .030, .011))]:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, location=center)
        obj = bpy.context.object
        obj.name = name
        obj.scale = scale
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        pieces.append(obj)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in pieces:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = pieces[0]
    bpy.ops.object.join()
    skin = bpy.context.object
    skin.name = 'Hand'
    skin.data.name = 'Hand_Mesh'
    # Union into one continuous watertight skin, including the finger webbing.
    skin.data.remesh_voxel_size = .00085
    bpy.ops.object.voxel_remesh()
    modifier = skin.modifiers.new('Surface relaxation', 'SMOOTH')
    modifier.factor = .7
    modifier.iterations = 5
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    # Place flexion creases and dorsal knuckle folds into the geometry.
    for vertex in skin.data.vertices:
        point = vertex.co
        for finger in FINGERS:
            start, along, across, normal, lengths, radius = finger_frame(finger)
            relative = point - start
            s, x, z = relative.dot(along), relative.dot(across), relative.dot(normal)
            if s < .008 or s > sum(lengths) - .005 or abs(x) > radius * 1.1:
                continue
            fade = max(0, 1 - (x / (radius * 1.1)) ** 4)
            for joint in (lengths[0], lengths[0] + lengths[1]):
                for offset, strength in ((-.0016, .00016), (0, .00024), (.0015, .00012)):
                    groove = math.exp(-((s - joint - offset - .001 * (x / radius) ** 2) / .00048) ** 2)
                    vertex.co -= normal * (groove * strength * fade * (1 if z > 0 else -1))
    for polygon in skin.data.polygons:
        polygon.use_smooth = True
    skin['authorship'] = 'Original procedural geometry, created for Nail Studio. No imported hand assets.'
    skin['units'] = 'metres'
    skin['version'] = '1.0'
    print('NEW HAND:', len(skin.data.vertices), 'vertices;', len(skin.data.polygons), 'faces')
    # Frame the live viewport immediately, before texture/rig stages.
    bpy.ops.object.select_all(action='DESELECT')
    skin.select_set(True)
    bpy.context.view_layer.objects.active = skin
    from mathutils import Quaternion
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                area.spaces.active.clip_start = .001
                area.spaces.active.region_3d.view_distance = .34
                area.spaces.active.region_3d.view_location = (0, .075, 0)
                area.spaces.active.region_3d.view_rotation = Quaternion((1, 0, 0, 0))
    return skin


def add_rig():
    skin = bpy.data.objects['Hand']
    collection = skin.users_collection[0]
    data = bpy.data.armatures.new('AnatomicalHandRig')
    rig = bpy.data.objects.new('Armature', data)
    collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    def bone(name, head, tail, parent=None):
        item = data.edit_bones.new(name)
        item.head, item.tail = head, tail
        if parent:
            item.parent = data.edit_bones[parent]
        return item
    bone('Wrist', (0, -.035, 0), (0, 0, 0))
    bone('Palm', (0, 0, 0), (0, .025, 0), 'Wrist')
    for finger in FINGERS:
        start, along, _, _, lengths, _ = finger_frame(finger)
        stem = STEMS[finger]
        bone(stem + '1', (0, .025, 0), start, 'Palm')
        for index, length in enumerate(lengths):
            end = start + along * length
            bone(stem + str(index + 2), start, end, stem + str(index + 1))
            start = end
    bpy.ops.object.mode_set(mode='OBJECT')
    rig.show_in_front = True
    groups = {bone.name: skin.vertex_groups.new(name=bone.name) for bone in data.bones}
    def smooth(t):
        t = min(1, max(0, t))
        return t * t * (3 - 2 * t)
    for vertex in skin.data.vertices:
        candidates = []
        for finger in FINGERS:
            start, along, across, normal, lengths, radius = finger_frame(finger)
            relative = vertex.co - start
            s = relative.dot(along)
            if s < -.014 or s > sum(lengths) + .006:
                continue
            radial = math.hypot(relative.dot(across), relative.dot(normal))
            if radial > radius * 1.65:
                continue
            score = radial / radius + max(0, -s) / .01
            candidates.append((score, finger, s))
        if not candidates:
            groups['Palm' if vertex.co.y > -.005 else 'Wrist'].add([vertex.index], 1, 'REPLACE')
            continue
        _, finger, s = min(candidates)
        lengths = FINGERS[finger][2]
        stem = STEMS[finger]
        base = smooth((s + .010) / .024)
        # Linear blend skinning across a broad joint region, normalized per vertex.
        a = smooth((s - lengths[0] + .006) / .012)
        b = smooth((s - lengths[0] - lengths[1] + .005) / .010)
        weights = {'Palm': 1 - base, stem + '2': base * (1 - a), stem + '3': base * a * (1 - b), stem + '4': base * a * b}
        for name, weight in weights.items():
            if weight > 1e-6:
                groups[name].add([vertex.index], weight, 'REPLACE')
    skin.parent = rig
    modifier = skin.modifiers.new('Finger skinning', 'ARMATURE')
    modifier.object = rig
    modifier.use_deform_preserve_volume = True
    for finger in FINGERS:
        for index in (2, 3, 4):
            item = rig.pose.bones[STEMS[finger] + str(index)]
            item['joint'] = (('CMC', 'MCP', 'IP') if finger == 'thumb' else ('MCP', 'PIP', 'DIP'))[index - 2]
            item['flexion_limits_degrees'] = [-10 if index == 2 else 0, (85, 100, 75)[index - 2]]
    print('RIG:', len(data.bones), 'bones; all skin vertices weighted')
    return rig


def add_nails():
    rig = bpy.data.objects['Armature']
    collection = rig.users_collection[0]
    material = bpy.data.materials.new('Rose quartz gel')
    material.use_nodes = True
    shader = next(node for node in material.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (.62, .27, .31, 1)
    shader.inputs['Roughness'].default_value = .19
    shader.inputs['Coat Weight'].default_value = .8
    for finger in FINGERS:
        start, along, across, normal, lengths, radius = finger_frame(finger)
        distal = start + along * (lengths[0] + lengths[1])
        # A nail bed on the dorsal side of the distal phalanx, proximal root fixed.
        bed_length = lengths[2] * .73
        bed_width = radius * 1.37
        origin = distal + along * (lengths[2] * .13) + normal * (radius * .80 * .80)
        rows, columns = 32, 20
        layer_size = (rows + 1) * (columns + 1)
        vertices, faces, uv = [], [], []
        for layer in range(2):
            for row in range(rows + 1):
                t = row / rows
                for column in range(columns + 1):
                    u = column / columns
                    x = u * 2 - 1
                    root = .72 + .28 * min(1, t / .18)
                    profile = root * math.sqrt(max(.025, 1 - max(0, (t - .55) / .46) ** 2))
                    y = bed_length * t + bed_length * .06 * x * x * max(0, 1 - t / .2)
                    z = bed_width * .10 * (1 - x * x) - .00025 * t * t - layer * .00035
                    p = origin + across * (x * bed_width * .5 * profile) + along * y + normal * z
                    vertices.append(tuple(p)); uv.append((u, t))
        for row in range(rows):
            for column in range(columns):
                a = row * (columns + 1) + column
                b, c, d = a + 1, a + columns + 1, a + columns + 2
                faces.extend([(a, b, d, c), (a + layer_size, c + layer_size, d + layer_size, b + layer_size)])
        rim = list(range(columns + 1)) + [r * (columns + 1) + columns for r in range(1, rows + 1)] + [rows * (columns + 1) + c for c in range(columns - 1, -1, -1)] + [r * (columns + 1) for r in range(rows - 1, 0, -1)]
        for index, a in enumerate(rim):
            b = rim[(index + 1) % len(rim)]
            faces.append((a, a + layer_size, b + layer_size, b))
        nail = mesh_object('Nail_' + finger, vertices, faces, collection)
        uv_layer = nail.data.uv_layers.new(name='NailUV')
        for loop in nail.data.loops:
            uv_layer.data[loop.index].uv = uv[loop.vertex_index]
        nail.data.materials.append(material)
        group = nail.vertex_groups.new(name=STEMS[finger] + '4')
        group.add(list(range(len(vertices))), 1, 'REPLACE')
        nail.parent = rig
        modifier = nail.modifiers.new('Distal attachment', 'ARMATURE')
        modifier.object = rig
        socket = bpy.data.objects.new(finger.title() + '_NailRoot', None)
        collection.objects.link(socket)
        socket.parent, socket.parent_type, socket.parent_bone = rig, 'BONE', STEMS[finger] + '4'
        socket.matrix_world = Matrix.Translation(origin)
        socket.empty_display_size = .003
        nail['socket'] = socket.name
        nail['root_locked'] = True
    print('NAILS: five original closed shells, five distal sockets, independent UVs')


def add_skin_material():
    skin = bpy.data.objects['Hand']
    material = bpy.data.materials.new('Skin — pores, mottling and subsurface')
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    shader = next(node for node in nodes if node.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (.64, .40, .29, 1)
    shader.inputs['Roughness'].default_value = .57
    shader.inputs['Subsurface Weight'].default_value = .07
    shader.inputs['Subsurface Radius'].default_value = (1, .42, .25)
    shader.inputs['Subsurface Scale'].default_value = .002
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 2200
    noise.inputs['Detail'].default_value = 3
    coordinates = nodes.new('ShaderNodeTexCoord')
    links.new(coordinates.outputs['Object'], noise.inputs['Vector'])
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .19
    bump.inputs['Distance'].default_value = .00010
    links.new(noise.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], shader.inputs['Normal'])
    skin.data.materials.clear()
    skin.data.materials.append(material)
    print('SKIN: PBR + procedural pore normal + subsurface')


def refine_skin():
    """Sculpt shallow tendons, knuckle pads, flexion creases and pigmentation."""
    skin = bpy.data.objects['Hand']
    bpy.context.view_layer.objects.active = skin
    relax = skin.modifiers.new('Soften palm transitions', 'SMOOTH')
    relax.factor, relax.iterations = .9, 16
    bpy.ops.object.modifier_apply(modifier=relax.name)
    colors = skin.data.color_attributes.new(name='SkinPigment', type='FLOAT_COLOR', domain='POINT')
    for vertex in skin.data.vertices:
        x, y, z = vertex.co
        crease, blush = 0.0, 0.0
        if z > .003 and .008 < y < .095:
            fade = math.sin(math.pi * min(1, max(0, (y - .008) / .087))) ** 1.3
            for finger in ('index', 'middle', 'ring', 'little'):
                start = Vector(FINGERS[finger][0])
                line_x = start.x * (.3 + .7 * y / start.y)
                ridge = math.exp(-((x - line_x) / .0022) ** 2)
                vertex.co.z += .00065 * ridge * fade
                pad = math.exp(-((y - start.y + .003) / .007) ** 2 - ((x - start.x) / .007) ** 2)
                vertex.co.z += .0009 * pad
                blush = max(blush, pad * .25)
        if z < -.005:
            # Three major palmar folds; their curves terminate within the palm.
            for curve, extent in ((.055 + .13 * x + 5 * x * x, .032), (.035 - .28 * x + 7 * x * x, .025), (.009 + 1.8 * x * x, .021)):
                if abs(x) < extent:
                    groove = math.exp(-((y - curve) / .00065) ** 2) * (1 - (x / extent) ** 6)
                    vertex.co.z += .00055 * groove
                    crease = max(crease, groove)
        for finger in FINGERS:
            start, along, across, normal, lengths, radius = finger_frame(finger)
            relative = vertex.co - start
            s, side, dorsal = relative.dot(along), relative.dot(across), relative.dot(normal)
            if s < .008 or s > sum(lengths) - .006 or abs(side) > radius:
                continue
            fade = max(0, 1 - (side / radius) ** 4)
            for joint in (lengths[0], lengths[0] + lengths[1]):
                pad = math.exp(-((s - joint) / .0045) ** 2)
                blush = max(blush, pad * .45)
                for offset, depth in ((-.0019, .00013), (0, .00032), (.0017, .00016)):
                    groove = math.exp(-((s - joint - offset + .0014 * (side / radius) ** 2) / .0006) ** 2) * fade
                    vertex.co -= normal * (groove * depth * (1 if dorsal > 0 else -1))
                    crease = max(crease, groove * .65)
        pigment = .68 - crease * .085 - blush * .05
        colors.data[vertex.index].color = (pigment * 1.025, pigment, pigment * (1 - blush * .10), 1)
    skin.data.update()
    material = skin.data.materials[0]
    nodes, links = material.node_tree.nodes, material.node_tree.links
    shader = next(node for node in nodes if node.type == 'BSDF_PRINCIPLED')
    attribute = nodes.new('ShaderNodeVertexColor')
    attribute.layer_name = 'SkinPigment'
    # Neutral pigment texture will be multiplied by the selected skin tone at runtime.
    links.new(attribute.outputs['Color'], shader.inputs['Base Color'])
    shader.inputs['Subsurface Weight'].default_value = .045
    # Small physical scene: softboxes use modest power to preserve skin detail.
    for obj in bpy.context.scene.objects:
        if obj.type == 'LIGHT':
            obj.data.energy *= .16
    print('SCULPT: dorsal tendons, knuckle pads, palmar folds, joint wrinkles, pigment')


def smart_unwrap(skin):
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(70), island_margin=.012)
    bpy.ops.object.mode_set(mode='OBJECT')


# Generators may replace this with a seam-based unwrap for their own topology.
UNWRAP = smart_unwrap


def bake_skin():
    """Bake procedural details to portable PBR maps, retaining the editable source nodes."""
    scene = bpy.context.scene
    skin = bpy.data.objects['Hand']
    bpy.ops.object.select_all(action='DESELECT')
    skin.select_set(True)
    bpy.context.view_layer.objects.active = skin
    # Rest mesh is baked before posing; UVs and textures travel with the skin.
    UNWRAP(skin)
    material = skin.data.materials[0]
    nodes, links = material.node_tree.nodes, material.node_tree.links
    shader = next(node for node in nodes if node.type == 'BSDF_PRINCIPLED')
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 8
    scene.render.bake.margin = 8
    os.makedirs(os.path.join(OUT, 'realistic-hand-textures'), exist_ok=True)
    images = {}
    for label, mode, resolution in [('basecolor', 'DIFFUSE', 2048), ('normal', 'NORMAL', 2048), ('roughness', 'ROUGHNESS', 1024)]:
        image = bpy.data.images.new('Hand_' + label, width=resolution, height=resolution)
        if label != 'basecolor':
            image.colorspace_settings.name = 'Non-Color'
        target = nodes.new('ShaderNodeTexImage')
        target.image = image
        nodes.active = target
        bpy.ops.object.bake(type=mode, pass_filter={'COLOR'} if mode == 'DIFFUSE' else set())
        image.filepath_raw = os.path.join(OUT, 'realistic-hand-textures', label + '.png')
        image.file_format = 'PNG'
        image.save()
        image.pack()
        images[label] = (image, target)
    links.new(images['basecolor'][1].outputs['Color'], shader.inputs['Base Color'])
    normal = nodes.new('ShaderNodeNormalMap')
    links.new(images['normal'][1].outputs['Color'], normal.inputs['Color'])
    links.new(normal.outputs['Normal'], shader.inputs['Normal'])
    links.new(images['roughness'][1].outputs['Color'], shader.inputs['Roughness'])
    scene.render.engine = 'BLENDER_EEVEE'
    print('BAKED: 2K base color + 2K tangent normal + 1K roughness')


def apply_skin_tint():
    material = bpy.data.objects['Hand'].data.materials[0]
    shader = next(node for node in material.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
    color = shader.inputs['Base Color'].links[0].from_socket
    tint = material.node_tree.nodes.new('ShaderNodeMixRGB')
    tint.blend_type = 'MULTIPLY'
    tint.inputs[0].default_value = 1
    tint.inputs[2].default_value = (.88, .62, .45, 1)
    material.node_tree.links.new(color, tint.inputs[1])
    material.node_tree.links.new(tint.outputs[0], shader.inputs['Base Color'])


def add_pose_library():
    """Five real bone poses in a scrub/playable source timeline; GLB stays reusable."""
    from mathutils import Quaternion
    scene = bpy.context.scene
    rig = bpy.data.objects['Armature']
    rig.animation_data_clear()
    action = bpy.data.actions.new('Hand Studio — five pose demonstrations')
    action.use_fake_user = True
    rig.animation_data_create()
    rig.animation_data.action = action
    scene.timeline_markers.clear()
    poses = {}
    for frame, preset in ((1, 'open'), (35, 'relaxed'), (70, 'soft_fist'), (105, 'pinch'), (140, 'v'), (175, 'open')):
        joints = {finger: [0, 0, 0, 0] for finger in FINGERS}
        opposition = 0
        if preset == 'relaxed':
            for i, finger in enumerate(('thumb', 'index', 'middle', 'ring', 'little')):
                joints[finger] = [8 + i * 2, 12 + i * 2, 6 + i, 0]
        elif preset == 'soft_fist':
            joints = {finger: [48, 65, 38, 0] for finger in FINGERS}
            joints['thumb'] = [12, 20, 12, 0]
            opposition = 28
        elif preset == 'pinch':
            joints['thumb'] = [35, 12, 6, -12]
            joints['index'] = [20, 80, 35, 0]
            for finger in ('middle', 'ring', 'little'):
                joints[finger] = [16, 24, 12, 0]
            opposition = 45
        elif preset == 'v':
            joints['thumb'] = [16, 25, 18, 0]
            joints['ring'] = [52, 72, 42, 0]
            joints['little'] = [55, 76, 45, 0]
            joints['index'][3], joints['middle'][3] = 10, -8
            opposition = 22
        for finger in FINGERS:
            _, _, _, normal, _, _ = finger_frame(finger)
            for index in range(3):
                bone = rig.pose.bones[STEMS[finger] + str(index + 2)]
                local_normal = bone.bone.matrix_local.to_quaternion().inverted() @ normal
                flex = Vector((0, 1, 0)).cross(-local_normal).normalized()
                rotation = Quaternion((1, 0, 0, 0))
                if index == 0:
                    spread = joints[finger][3] - (opposition * .7 if finger == 'thumb' else 0)
                    rotation @= Quaternion(local_normal, math.radians(spread))
                rotation @= Quaternion(flex, math.radians(joints[finger][index]))
                if finger == 'thumb' and index == 0:
                    rotation @= Quaternion((0, 1, 0), math.radians(opposition * .4))
                bone.rotation_mode = 'QUATERNION'
                bone.rotation_quaternion = rotation
                bone.keyframe_insert('rotation_quaternion', frame=frame, group=finger)
        poses[preset] = {'joints': {finger: dict(zip(('mcp', 'pip', 'dip', 'spread'), value)) for finger, value in joints.items()}, 'opposition': opposition}
        scene.timeline_markers.new(preset.replace('_', ' ').title(), frame=frame)
    scene.frame_start, scene.frame_end = 1, 175
    scene.frame_set(1)
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'realistic-hand-v1.poses.json'), 'w', encoding='utf-8') as stream:
        json.dump(poses, stream, indent=2)
    print('POSE LIBRARY: Open / Relaxed / Soft fist / Pinch / V, frames 1–175')


def export_asset():
    scene = bpy.context.scene
    rig = bpy.data.objects['Armature']
    previous_active = bpy.context.view_layer.objects.active
    previous_selected = list(bpy.context.selected_objects)
    previous_mode = previous_active.mode if previous_active else 'OBJECT'
    if previous_mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    for obj in rig.children_recursive:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = rig
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT, 'realistic-hand-v1.glb'), export_format='GLB',
        use_selection=True, use_active_scene=True, export_skins=True, export_animations=False,
        export_rest_position_armature=True, export_extras=True, export_yup=False,
    )
    manifest = {
        'modelId': 'realistic-hand-v1', 'schemaVersion': '1.0', 'units': 'metres',
        'authorship': 'Original procedural mesh, rig, UVs and textures authored from scratch for Nail Studio.',
        'source': 'model/realistic-hand-v1.blend', 'generator': bpy.data.objects['Hand'].get('generator', 'tools/create_realistic_hand.py'),
        'bones': len(rig.data.bones), 'basis': 'X: palm width, Y: fingers, Z: dorsum; metres',
        'externalAssets': [], 'rightHandAsset': 'realistic-hand-v1.glb',
        'leftHand': 'Independent skeleton clone, mirrored across X at runtime.',
        'nails': {finger: {'mesh': 'Nail_' + finger, 'distalBone': STEMS[finger] + '4', 'socket': finger.title() + '_NailRoot'} for finger in FINGERS},
    }
    with open(os.path.join(OUT, 'realistic-hand-v1.meta.json'), 'w', encoding='utf-8') as stream:
        json.dump(manifest, stream, indent=2)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in previous_selected:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = previous_active
    if previous_active and previous_mode != 'OBJECT':
        previous_active.select_set(True)
        bpy.ops.object.mode_set(mode=previous_mode)
    save_source()
    print('EXPORTED ORIGINAL HAND ASSET')


def setup_studio():
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1
    try:
        scene.render.engine = 'BLENDER_EEVEE'
    except TypeError as error:
        raise RuntimeError('EEVEE unavailable: ' + str(error)) from error
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    scene.world = bpy.data.worlds.new('Neutral studio')
    scene.world.use_nodes = True
    background = next(node for node in scene.world.node_tree.nodes if node.type == 'BACKGROUND')
    background.inputs[0].default_value = (.18, .16, .14, 1)
    background.inputs[1].default_value = .4
    collection = scene.collection
    camera_data = bpy.data.cameras.new('StudioCamera')
    camera = bpy.data.objects.new('StudioCamera', camera_data)
    collection.objects.link(camera)
    camera.location = (0, .08, .40)
    target = Vector((0, .08, 0))
    camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = .28
    camera_data.clip_start = .001
    scene.camera = camera
    for name, position, power, size, color in [('Key softbox', (-.12, .14, .22), 8, .20, (1, .93, .87)), ('Fill softbox', (.15, .06, .18), 5, .18, (.86, .92, 1)), ('Rim softbox', (.03, .22, -.08), 6, .14, (1, 1, 1))]:
        data = bpy.data.lights.new(name, 'AREA')
        data.energy, data.shape, data.size, data.color = power, 'DISK', size, color
        light = bpy.data.objects.new(name, data)
        collection.objects.link(light)
        light.location = position
        light.rotation_euler = (target - light.location).to_track_quat('-Z', 'Y').to_euler()
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                area.spaces.active.shading.type = 'MATERIAL'
                area.spaces.active.overlay.show_floor = False
                area.spaces.active.overlay.show_extras = False
    print('STUDIO: neutral light, 1200-square camera, metric units')


def save_source():
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'model', 'realistic-hand-v1.blend'))
    print('SOURCE SAVED')


if __name__ == '__main__':
    build_skin()
    add_rig()
    add_nails()
    add_skin_material()
    setup_studio()
    refine_skin()
    bake_skin()
    apply_skin_tint()
    add_pose_library()
    export_asset()
