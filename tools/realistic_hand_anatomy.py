"""Anatomical rebuild from original control surfaces, not an imported hand.

Uses the user's photographic references for proportions and form. Photographs
are not projected onto the model or included in the exported textures.
Run stages through Blender MCP; create_realistic_hand supplies studio/export.
"""
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from mathutils.noise import noise_vector
sys.path.insert(0, str(Path(__file__).resolve().parent))
import create_realistic_hand as base

# Adult manicure hand, metres. Explicit phalanges, not a straight cylinder chain.
FINGERS = {
    'index': ((-.025, .082, .001), (-.08, .997, 0), (.036, .023, .018), .0084),
    'middle': ((-.005, .091, .0015), (0, 1, 0), (.040, .026, .019), .0088),
    'ring': ((.014, .086, .0005), (.045, .999, 0), (.038, .024, .018), .0082),
    'little': ((.030, .074, -.001), (.14, .99, 0), (.029, .019, .016), .0068),
    'thumb': ((-.024, .030, -.004), (-.66, .74, .10), (.030, .025, .021), .0102),
}
STEMS = base.STEMS


def smooth(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def joints(finger):
    start, direction, lengths, radius = FINGERS[finger]
    points = [Vector(start)]
    for index, length in enumerate(lengths):
        if finger == 'thumb':
            axis = Vector(((-.66, .74, .10), (-.55, .78, .20), (-.48, .84, .25))[index]).normalized()
        else:
            axis = Vector(direction).normalized()
            axis.z = (-.025, -.075, -.12)[index]
            axis.x *= (1, .65, .4)[index]
            axis.normalize()
        points.append(points[-1] + axis * length)
    return points


def axes(finger, along):
    normal = Vector((-.50, -.40, .77)) if finger == 'thumb' else Vector((0, .015, 1))
    normal = (normal - along * normal.dot(along)).normalized()
    return along.cross(normal).normalized(), normal


def sample_finger(finger, s):
    points = joints(finger)
    lengths = FINGERS[finger][2]
    running = 0
    for i, length in enumerate(lengths):
        if s <= running + length or i == 2:
            t = (s - running) / length
            along = (points[i + 1] - points[i]).normalized()
            across, normal = axes(finger, along)
            return points[i].lerp(points[i + 1], t), along, across, normal
        running += length


def radius_at(finger, s):
    lengths, radius = FINGERS[finger][2:]
    total = sum(lengths)
    # Width keyframes at anatomical stations, not a linear taper: a full
    # proximal base, PIP/DIP condyles, narrower middle phalanx waist and a
    # pulp that widens again slightly around the nail before the round tip.
    p, m = lengths[0], lengths[0] + lengths[1]
    stations = ((-.012, 1.10), (0, 1.07), (p * .55, .95), (p, 1.0), (p + lengths[1] * .5, .86),
                (m, .87), (m + lengths[2] * .45, .91), (total, .90))
    shaft = stations[-1][1]
    for (s0, r0), (s1, r1) in zip(stations, stations[1:]):
        if s <= s1:
            shaft = r0 + (r1 - r0) * smooth((s - s0) / (s1 - s0))
            break
    pip = dip = waists = 0
    remaining = total - s
    cap = math.sqrt(max(.004, 1 - max(0, 1 - remaining / .0062) ** 2))
    buried_root = .65 + .35 * smooth((s + .012) / .012) if s < 0 else 1
    return radius * (shaft + pip + dip - waists) * cap * buried_root


def catmull(a, b, c, d, t):
    return .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t)


# (finger a, finger b, s-range on a, s-range on b, dorsal top, palmar bottom).
# top/bottom are multiples of the mean finger radius relative to the axes.
WEBS = (
    ('index', 'middle', (-.004, .013), (-.004, .014), .45, -.85),
    ('middle', 'ring', (-.004, .014), (-.004, .013), .45, -.85),
    ('ring', 'little', (-.004, .012), (-.004, .010), .45, -.85),
    ('thumb', 'index', (.004, .034), (-.010, .003), .32, -.70),
)


def build_web(a, b, a_range, b_range, top, bottom, collection, rows=28, sides=40):
    radius = (FINGERS[a][3] + FINGERS[b][3]) * .5
    vertices, faces = [], []
    for row in range(rows + 1):
        t = row / rows * .96
        ca, _, _, na = sample_finger(a, a_range[0] + (a_range[1] - a_range[0]) * t)
        cb, _, _, nb = sample_finger(b, b_range[0] + (b_range[1] - b_range[0]) * t)
        mid, span = (ca + cb) * .5, cb - ca
        half = span.length * .5
        across = span.normalized()
        normal = (na + nb).normalized()
        normal = (normal - across * normal.dot(across)).normalized()
        # Dorsal face descends towards the palmar face; the free edge keeps a
        # rounded ~3 mm thickness (a zero-thickness sheet voxelises raggedly).
        edge = bottom * .62
        upper = radius * (top + (edge + .34 - top) * smooth(t))
        lower = radius * (bottom + (edge - bottom) * smooth(t))
        for side in range(sides):
            angle = side * math.tau / sides
            c = math.cos(angle)
            z = (upper if c >= 0 else -lower) * math.copysign(abs(c) ** .55, c)
            point = mid + across * (half * math.sin(angle)) + normal * z
            vertices.append(tuple(point))
    for row in range(rows):
        for side in range(sides):
            p = row * sides + side; q = row * sides + (side + 1) % sides
            faces.append((p, q, q + sides, p + sides))
    faces.extend([tuple(reversed(range(sides))), tuple(rows * sides + s for s in range(sides))])
    return base.mesh_object('Web_' + a + '_' + b, vertices, faces, collection)


def build_skin():
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    scene = bpy.data.scenes.new('Realistic Hand Studio')
    bpy.context.window.scene = scene
    collection = bpy.data.collections.new('Original Anatomical Hand')
    scene.collection.children.link(collection)
    # Cuff → radial/ulnar wrist → carpal heel → metacarpal fan.
    profile = [(-.120, .026, .019), (-.095, .024, .017), (-.060, .021, .014), (-.024, .0182, .0115),
               (-.006, .0185, .011), (.012, .023, .012), (.033, .030, .013), (.054, .035, .012),
               # The dorsal palm sinks under the finger roots so the metacarpal
               # heads read as knuckles, not as a shelf the fingers hang from.
               (.070, .0355, .0100), (.082, .030, .0068), (.090, .021, .0040), (.097, .010, .0012)]
    vertices, faces = [], []
    rows, sides = 100, 64
    for row in range(rows + 1):
        y = profile[0][0] + (profile[-1][0] - profile[0][0]) * row / rows
        i = next((i for i in range(len(profile) - 1) if profile[i + 1][0] >= y), len(profile) - 2)
        t = (y - profile[i][0]) / (profile[i + 1][0] - profile[i][0])
        width = catmull(profile[max(0, i - 1)][1], profile[i][1], profile[i + 1][1], profile[min(len(profile) - 1, i + 2)][1], t)
        depth = catmull(profile[max(0, i - 1)][2], profile[i][2], profile[i + 1][2], profile[min(len(profile) - 1, i + 2)][2], t)
        for side in range(sides):
            angle = side * math.tau / sides
            x = width * math.sin(angle) + .002
            dorsal = math.cos(angle)
            # Dorsum gently domed, palm fuller around the thenar/hypothenar pads.
            z = depth * (math.copysign(abs(dorsal) ** .60, dorsal) if dorsal > 0 else dorsal) - .0015
            if dorsal < 0 and -.01 < y < .09:
                # Thenar, hypothenar and distal palmar pads as smooth swelling,
                # not unioned ellipsoids (which left hard visible outlines).
                weight = abs(dorsal) ** .5
                thenar = math.exp(-((x + .018) / .013) ** 2 - ((y - .030) / .024) ** 2)
                hypothenar = math.exp(-((x - .020) / .010) ** 2 - ((y - .034) / .028) ** 2)
                pads = math.exp(-((y - .074) / .008) ** 2) * (1 - smooth((abs(x) - .022) / .01))
                z -= weight * (.0055 * thenar + .0026 * hypothenar + .0012 * pads)
            if x < 0 and .005 < y < .065:
                # The thenar eminence rounds the radial border into the thumb.
                x -= .0035 * math.exp(-((y - .033) / .018) ** 2) * max(0, -math.sin(angle)) ** 2
            vertices.append((x, y, z))
    for row in range(rows):
        for side in range(sides):
            a = row * sides + side; b = row * sides + (side + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces.extend([tuple(reversed(range(sides))), tuple(rows * sides + s for s in range(sides))])
    pieces = [base.mesh_object('PalmAnatomy', vertices, faces, collection)]
    for finger in FINGERS:
        total = sum(FINGERS[finger][2])
        vertices, faces = [], []
        rows, sides = 96, 64
        for row in range(rows + 1):
            s = -.018 + (total + .018) * row / rows
            center, along, across, normal = sample_finger(finger, s)
            # Roots dive palmwards inside the palm so no tube end is exposed.
            center = center - normal * ((0 if finger == 'thumb' else .0045) * smooth(-s / .014))
            radius = radius_at(finger, s)
            lengths = FINGERS[finger][2]
            distal = smooth((s - lengths[0] - lengths[1]) / (lengths[2] * .45))
            for side in range(sides):
                angle = side * math.tau / sides
                lateral = radius * math.sin(angle)
                dorsal = math.cos(angle)
                # Flatten the nail-bearing dorsal surface; keep a fuller pulp pad
                # that bulges below and beside the nail on the distal phalanx.
                depth = radius * ((.71 - .07 * distal) if dorsal >= 0 else (.89 + .09 * distal))
                z = depth * (math.copysign(abs(dorsal) ** .77, dorsal))
                point = center + across * lateral + normal * z
                vertices.append(tuple(point))
        for row in range(rows):
            for side in range(sides):
                a = row * sides + side; b = row * sides + (side + 1) % sides
                faces.append((a, b, b + sides, a + sides))
        faces.extend([tuple(reversed(range(sides))), tuple(rows * sides + s for s in range(sides))])
        pieces.append(base.mesh_object('Phalanges_' + finger, vertices, faces, collection))
    # Interdigital webs: palmar-lying wedges spanning axis to axis. Their dorsal
    # face descends towards the palm, so the free edge forms the U-shaped
    # saddle between fingers instead of a round blob over the knuckles.
    for left, right, a_range, b_range, top, bottom in WEBS:
        pieces.append(build_web(left, right, a_range, b_range, top, bottom, collection))
    bpy.ops.object.select_all(action='DESELECT')
    for obj in pieces: obj.select_set(True)
    bpy.context.view_layer.objects.active = pieces[0]
    bpy.ops.object.join()
    skin = bpy.context.object; skin.name = 'Hand'; skin.data.name = 'Hand_Mesh'
    skin.data.remesh_voxel_size = .00065
    bpy.ops.object.voxel_remesh()
    modifier = skin.modifiers.new('Tissue union smoothing', 'SMOOTH')
    modifier.factor, modifier.iterations = .65, 7
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    # Extra relaxation only where the unioned parts meet (finger roots, webs,
    # thumb base), leaving the fingertips and nail grooves crisp.
    junction = skin.vertex_groups.new(name='Junctions')
    for vertex in skin.data.vertices:
        weight = 0.0
        for finger in FINGERS:
            distance, s, *_ = closest_finger(finger, vertex.co)
            if distance < (FINGERS[finger][3] * 2.2) ** 2:
                reach = .030 if finger == 'thumb' else .010
                weight = max(weight, math.exp(-((s - reach * .4) / reach) ** 2))
        if weight > .02: junction.add([vertex.index], weight, 'REPLACE')
    modifier = skin.modifiers.new('Junction relax', 'SMOOTH')
    modifier.factor, modifier.iterations, modifier.vertex_group = .8, 30, junction.name
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    skin.vertex_groups.remove(skin.vertex_groups['Junctions'])
    for polygon in skin.data.polygons: polygon.use_smooth = True
    skin['authorship'] = 'New original control surfaces, no imported geometry or projected reference photographs.'
    skin['units'] = 'metres'
    skin['generator'] = 'tools/realistic_hand_anatomy.py'
    print('ANATOMY:', len(skin.data.vertices), 'vertices, continuous forearm/palm/phalanges')
    return skin


def closest_finger(finger, point):
    points, lengths = joints(finger), FINGERS[finger][2]
    best, running = None, 0
    for index, length in enumerate(lengths):
        along = (points[index + 1] - points[index]).normalized()
        raw_s = (point - points[index]).dot(along)
        s = max(0, min(length, raw_s))
        center = points[index] + along * s
        distance = (point - center).length_squared
        across, normal = axes(finger, along)
        result = (distance, running + raw_s, (point - center).dot(across), (point - center).dot(normal), across, normal)
        if best is None or distance < best[0]: best = result
        running += length
    return best


def sculpt_detail():
    skin = bpy.data.objects['Hand']
    pigment = skin.data.color_attributes.new(name='SkinPigment', type='FLOAT_COLOR', domain='POINT')
    for vertex in skin.data.vertices:
        x, y, z = vertex.co
        crease, redness, vein, fingertip = 0.0, 0.0, 0.0, 0.0
        # Shallow extensor tendons and metacarpal heads, no tall parallel ridges.
        if z > .003 and .003 < y < .11:
            fade = math.sin(math.pi * smooth((y - .003) / .086)) if y < .089 else 0
            for finger in ('index', 'middle', 'ring', 'little'):
                root = Vector(FINGERS[finger][0])
                line = root.x * (.22 + .78 * y / root.y)
                tendon = math.exp(-((x - line) / .0020) ** 2)
                vertex.co.z += .00027 * tendon * fade
                # Knuckle relief has its own smooth falloff (it previously
                # stopped at the tendon range and left a step at the roots).
                knuckle = math.exp(-((x - root.x) / .0068) ** 2 - ((y - root.y + .002) / .006) ** 2)
                vertex.co.z += .0006 * knuckle
                redness = max(redness, .35 * knuckle)
            # Veins branch sparsely; color is extremely subtle under the skin.
            for line in (-.012 + .10 * y + .002 * math.sin(y * 90), .011 - .12 * y):
                vein = max(vein, math.exp(-((x - line) / .00085) ** 2) * fade)
        # Palmar folds are curved, not straight horizontal bands.
        if z < -.003 and -.005 < y < .078:
            for curve, extent in ((.059 + .25 * x + 4 * x * x, .032), (.036 - .22 * x + 6 * x * x, .028), (.009 + 2.5 * x * x, .019)):
                if abs(x) < extent:
                    fold = math.exp(-((y - curve) / .0009) ** 2) * max(0, 1 - (x / extent) ** 6)
                    vertex.co.z += .00032 * fold
                    crease = max(crease, fold)
        # Bracelet folds at the wrist on the volar face.
        if z < 0 and abs(x) < .018:
            for fold_y in (-.005, -.010):
                fold = math.exp(-((y - fold_y - .0015 * (x / .018) ** 2) / .0009) ** 2) * (1 - (x / .018) ** 4)
                vertex.co.z += .00014 * fold
                crease = max(crease, .5 * fold)
        for finger in FINGERS:
            distance, s, lateral, dorsal, across, normal = closest_finger(finger, vertex.co)
            lengths, radius = FINGERS[finger][2:]
            total = sum(lengths)
            if distance > (radius * 1.35) ** 2 or s < .009 or s > total - .005 or abs(lateral) > radius:
                continue
            fade = max(0, 1 - (lateral / radius) ** 4)
            for joint in (lengths[0], lengths[0] + lengths[1]):
                redness = max(redness, .40 * math.exp(-((s - joint) / .006) ** 2))
                # Broken, nested creases rather than circumferential ring cuts.
                for offset, depth in ((-.0015, .00012), (0, .00025), (.0015, .00010)):
                    bend = .0012 * (lateral / radius) ** 2 + .00025 * math.sin(lateral * 1200)
                    fold = math.exp(-((s - joint - offset + bend) / .00045) ** 2) * fade
                    face = smooth(abs(dorsal) / radius)
                    vertex.co -= normal * (fold * depth * face * (1 if dorsal > 0 else -1))
                    crease = max(crease, fold * face * .65)
            # Fine folds between the larger knuckle creases, visible up close.
            near_joint = max(math.exp(-((s - lengths[0]) / .0045) ** 2), math.exp(-((s - lengths[0] - lengths[1]) / .004) ** 2))
            fine = max(0, math.sin(s * 5200 + math.sin(lateral * 900))) ** 12 * near_joint
            vertex.co -= normal * (fine * .000045 * fade * (1 if dorsal > 0 else -1))
            # Raised eponychium: the skin lip covers the proximal nail plate.
            nail_root = lengths[0] + lengths[1] + lengths[2] * .24
            half = radius * .63
            root_curve = nail_root + .0012 * min(1.3, lateral / half) ** 2
            cuticle = math.exp(-((s - root_curve) / .00045) ** 2) * max(0, 1 - (lateral / (half * 1.15)) ** 8)
            if dorsal > 0 and abs(lateral) < half * 1.15:
                vertex.co += normal * (.00027 * cuticle)
            # Nail groove: the bed sinks so the plate sits inside the skin, and
            # the lateral folds rise beside it instead of the plate capping the
            # fingertip. Both fade out before the free edge / hyponychium.
            if dorsal > 0:
                lat = abs(lateral) / half
                along_bed = smooth((s - root_curve + .0004) / .0009) * (1 - smooth((s - (total - .0085)) / .003))
                recess = along_bed * (1 - smooth((lat - .80) / .28))
                ridge = smooth((s - root_curve + .0025) / .002) * (1 - smooth((s - (total - .0085)) / .003))
                fold = ridge * math.exp(-((lat - 1.10) / .20) ** 2)
                vertex.co += normal * (.00018 * fold - .00026 * recess)
            # Pink fingertip pulp and nail-fold blush.
            tip = smooth((s - lengths[0] - lengths[1] - lengths[2] * .2) / (lengths[2] * .5))
            fingertip = max(fingertip, tip * (.75 if dorsal < 0 else .45))
        # Colour zones are multipliers around a neutral mean (the runtime tone
        # multiplies this map), so they survive any skin tone selection.
        x, y, z = vertex.co
        palm = smooth(-z / .006) * smooth((y + .01) / .02) * (1 - smooth((y - .09) / .01))
        dorsum = smooth(z / .004)
        wrist = 1 - smooth((y + .03) / .03)
        noise = noise_vector(vertex.co * 180).x
        mottle = noise_vector(vertex.co * 45).y
        lum = .76 + noise * .022 + mottle * .02 - crease * .12
        warm = redness * 1.0 + fingertip * .55 + palm * .30
        r = lum * (1 + .20 * warm + .02 * dorsum) * (1 - .05 * vein)
        g = lum * (1 - .13 * warm - .015 * wrist) * (1 - .035 * vein)
        b = lum * (1 - .16 * warm - .04 * dorsum) * (1 + .05 * vein)
        pigment.data[vertex.index].color = (r, g, b, 1)
    skin.data.update()
    print('SCULPT: phalangeal folds, nail folds, tendon relief, subtle vein pigmentation')


def optimize_skin():
    skin = bpy.data.objects['Hand']
    bpy.context.view_layer.objects.active = skin
    modifier = skin.modifiers.new('Runtime topology budget', 'DECIMATE')
    modifier.ratio = .60
    modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    print('TOPOLOGY:', len(skin.data.vertices), 'vertices, folded areas preserved adaptively')


def add_rig():
    skin = bpy.data.objects['Hand']; collection = skin.users_collection[0]
    data = bpy.data.armatures.new('Original anatomical skeleton')
    rig = bpy.data.objects.new('Armature', data); collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig; rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    def bone(name, head, tail, parent=None):
        b = data.edit_bones.new(name); b.head, b.tail = head, tail
        if parent: b.parent = data.edit_bones[parent]
    bone('Forearm', (0, -.12, 0), (0, -.005, 0))
    bone('Wrist', (0, -.005, 0), (0, .012, 0), 'Forearm')
    bone('Palm', (0, .012, 0), (0, .030, 0), 'Wrist')
    for finger in FINGERS:
        points, stem = joints(finger), STEMS[finger]
        bone(stem + '1', (0, .030, 0), points[0], 'Palm')
        for index in range(3): bone(stem + str(index + 2), points[index], points[index + 1], stem + str(index + 1))
    bpy.ops.object.mode_set(mode='OBJECT')
    groups = {b.name: skin.vertex_groups.new(name=b.name) for b in data.bones}
    for vertex in skin.data.vertices:
        options = []
        for finger in FINGERS:
            distance, s, *_ = closest_finger(finger, vertex.co)
            radius = FINGERS[finger][3]
            if -.012 < s < sum(FINGERS[finger][2]) + .006 and distance < (radius * 1.6) ** 2:
                options.append((math.sqrt(distance) / radius + max(0, -s) / .008, finger, s))
        if options:
            _, finger, s = min(options)
            lengths, stem = FINGERS[finger][2], STEMS[finger]
            root = smooth((s + .010) / .022)
            a = smooth((s - lengths[0] + .006) / .012)
            b = smooth((s - lengths[0] - lengths[1] + .0045) / .009)
            weights = {'Palm': 1 - root, stem + '2': root * (1 - a), stem + '3': root * a * (1 - b), stem + '4': root * a * b}
            ordered = sorted(options)
            if len(ordered) > 1 and s < .014 and ordered[1][0] - ordered[0][0] < .6:
                _, other, other_s = ordered[1]
                blend = .5 + .5 * smooth((ordered[1][0] - ordered[0][0]) / .6)
                other_root = smooth((other_s + .010) / .022)
                weights = {stem + '2': root * blend, STEMS[other] + '2': other_root * (1 - blend), 'Palm': 1 - root * blend - other_root * (1 - blend)}
        else:
            wrist = smooth((vertex.co.y + .019) / .028)
            palm = smooth((vertex.co.y - .003) / .018)
            weights = {'Forearm': 1 - wrist, 'Wrist': wrist * (1 - palm), 'Palm': wrist * palm}
        for name, weight in weights.items():
            if weight > 1e-6: groups[name].add([vertex.index], weight, 'REPLACE')
    skin.parent = rig
    modifier = skin.modifiers.new('Anatomical skinning', 'ARMATURE'); modifier.object = rig
    modifier.use_deform_preserve_volume = True
    rig.show_in_front = True
    print('RIG: 23 bones, separate forearm/wrist, curved phalanges, normalized weights')


def add_nails():
    skin, rig = bpy.data.objects['Hand'], bpy.data.objects['Armature']
    collection = skin.users_collection[0]
    depsgraph = bpy.context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(skin, depsgraph)
    material = bpy.data.materials.new('Natural nail — keratin and clear coat')
    material.use_nodes = True
    shader = next(node for node in material.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (.72, .45, .43, 1)
    shader.inputs['Roughness'].default_value = .27
    shader.inputs['Coat Weight'].default_value = .35
    for finger in FINGERS:
        points, radius = joints(finger), FINGERS[finger][3]
        along = (points[3] - points[2]).normalized()
        across, normal = axes(finger, along)
        distal_length = FINGERS[finger][2][2]
        origin = points[2] + along * (distal_length * .24)
        length, width = distal_length * .64, radius * 1.25
        rows, columns = 40, 24
        layer_size = (rows + 1) * (columns + 1)
        top, uv = [], []
        for row in range(rows + 1):
            t = row / rows
            for column in range(columns + 1):
                u, x = column / columns, column / columns * 2 - 1
                root = .70 + .30 * smooth(t / .23)
                lateral = x * width * .5 * root
                root_round = .0012 * x * x * (1 - t)
                tip_round = width * .20 * x * x * smooth((t - .70) / .30)
                flat = origin + along * (length * t + root_round - tip_round) + across * lateral
                hit, _, _, _ = bvh.ray_cast(flat + normal * .035, -normal, .07)
                if hit is None: raise RuntimeError('Nail bed ray missed: ' + finger)
                # Top of a .28 mm plate; bottom is embedded .06 mm into its bed.
                point = hit + normal * .00022
                top.append(tuple(point)); uv.append((u, t))
        vertices = top + [tuple(Vector(p) - normal * .00028) for p in top]
        uv += uv[:]
        faces = []
        for row in range(rows):
            for column in range(columns):
                a = row * (columns + 1) + column
                b, c, d = a + 1, a + columns + 1, a + columns + 2
                faces.extend([(a, b, d, c), (a + layer_size, c + layer_size, d + layer_size, b + layer_size)])
        rim = list(range(columns + 1)) + [r * (columns + 1) + columns for r in range(1, rows + 1)] + [rows * (columns + 1) + c for c in range(columns - 1, -1, -1)] + [r * (columns + 1) for r in range(rows - 1, 0, -1)]
        for i, a in enumerate(rim):
            b = rim[(i + 1) % len(rim)]
            faces.append((a, a + layer_size, b + layer_size, b))
        nail = base.mesh_object('Nail_' + finger, vertices, faces, collection)
        layer = nail.data.uv_layers.new(name='NailUV')
        for loop in nail.data.loops: layer.data[loop.index].uv = uv[loop.vertex_index]
        nail.data.materials.append(material)
        group = nail.vertex_groups.new(name=STEMS[finger] + '4'); group.add(list(range(len(vertices))), 1, 'REPLACE')
        nail.parent = rig
        modifier = nail.modifiers.new('Rigid distal nail socket', 'ARMATURE'); modifier.object = rig
        # The runtime interpolates this measured skin-fit bed, rather than
        # guessing a floating plane from a bounding box/PCA.
        nail['bedRows'], nail['bedColumns'] = rows, columns
        nail['bedAlong'], nail['bedNormal'] = list(along), list(normal)
        nail['bedSamples'] = [coordinate for point in top for coordinate in point]
        nail['nailBedClearanceMetres'] = .00022
        socket = bpy.data.objects.new(finger.title() + '_NailRoot', None)
        collection.objects.link(socket)
        socket.parent, socket.parent_type, socket.parent_bone = rig, 'BONE', STEMS[finger] + '4'
        socket.matrix_world = Matrix.Translation(origin)
        socket.empty_display_size = .002
    print('NAILS: ray-fitted to actual skin; .28mm shells, buried roots, measured bed cages')


def add_skin_material():
    skin = bpy.data.objects['Hand']
    material = bpy.data.materials.new('Living skin — pores and pigment')
    material.use_nodes = True
    skin.data.materials.clear(); skin.data.materials.append(material)
    nodes, links = material.node_tree.nodes, material.node_tree.links
    shader = next(node for node in nodes if node.type == 'BSDF_PRINCIPLED')
    shader.inputs['Subsurface Weight'].default_value = .085
    shader.inputs['Subsurface Radius'].default_value = (1, .38, .22)
    shader.inputs['Subsurface Scale'].default_value = .0018
    coordinates = nodes.new('ShaderNodeTexCoord')
    pigment = nodes.new('ShaderNodeVertexColor'); pigment.layer_name = 'SkinPigment'
    links.new(pigment.outputs['Color'], shader.inputs['Base Color'])
    noise = nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 2350; noise.inputs['Detail'].default_value = 3
    links.new(coordinates.outputs['Object'], noise.inputs['Vector'])
    pores = nodes.new('ShaderNodeTexVoronoi'); pores.feature = 'DISTANCE_TO_EDGE'; pores.inputs['Scale'].default_value = 3100
    links.new(coordinates.outputs['Object'], pores.inputs['Vector'])
    bump1 = nodes.new('ShaderNodeBump'); bump1.inputs['Strength'].default_value = .23; bump1.inputs['Distance'].default_value = .000085
    links.new(noise.outputs['Fac'], bump1.inputs['Height'])
    bump2 = nodes.new('ShaderNodeBump'); bump2.inputs['Strength'].default_value = .14; bump2.inputs['Distance'].default_value = .00004
    links.new(pores.outputs['Distance'], bump2.inputs['Height']); links.new(bump1.outputs['Normal'], bump2.inputs['Normal'])
    links.new(bump2.outputs['Normal'], shader.inputs['Normal'])
    roughness = nodes.new('ShaderNodeMapRange')
    roughness.inputs['From Min'].default_value = 0; roughness.inputs['From Max'].default_value = 1
    roughness.inputs['To Min'].default_value = .77; roughness.inputs['To Max'].default_value = 1
    links.new(noise.outputs['Fac'], roughness.inputs['Value']); links.new(roughness.outputs[0], shader.inputs['Roughness'])
    print('SKIN: neutral pigment + vascular tint + two-scale pores + spatial roughness')


def prepare_studio():
    base.setup_studio()
    scene = bpy.context.scene
    scene.camera.location = (0, .032, .50)
    scene.camera.data.ortho_scale = .355
    scene.camera.rotation_euler = (Vector((0, .032, 0)) - scene.camera.location).to_track_quat('-Z', 'Y').to_euler()
    for obj in scene.objects:
        if obj.type == 'LIGHT': obj.data.energy *= .18
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                from mathutils import Quaternion
                area.spaces.active.region_3d.view_location = (0, .035, 0)
                area.spaces.active.region_3d.view_distance = .45
                area.spaces.active.region_3d.view_rotation = Quaternion((1, 0, 0, 0))
                area.spaces.active.clip_start = .001
                area.spaces.active.overlay.show_extras = False


def add_cuticles():
    """Thin skin lips cover the measured plate root, with matching skin UVs."""
    skin, rig = bpy.data.objects['Hand'], bpy.data.objects['Armature']
    collection = skin.users_collection[0]
    bvh = BVHTree.FromObject(skin, bpy.context.evaluated_depsgraph_get())
    skin_uv = skin.data.uv_layers.active.data
    for finger in FINGERS:
        nail = bpy.data.objects['Nail_' + finger]
        rows, columns = nail['bedRows'], nail['bedColumns']
        samples = nail['bedSamples']
        along = (joints(finger)[3] - joints(finger)[2]).normalized()
        _, normal = axes(finger, along)
        point = lambda column, row: Vector(samples[(row * (columns + 1) + column) * 3:(row * (columns + 1) + column) * 3 + 3])
        path = []
        side_rows = int(rows * .40)
        # Down one lateral fold, around the cuticle, up the opposite fold.
        path.extend(point(0, row) for row in range(side_rows, 0, -1))
        path.extend(point(column, 0) for column in range(columns + 1))
        path.extend(point(columns, row) for row in range(1, side_rows + 1))
        vertices, faces = [], []
        sides = 8
        for i, center in enumerate(path):
            tangent = (path[min(len(path) - 1, i + 1)] - path[max(0, i - 1)]).normalized()
            cross = tangent.cross(normal).normalized()
            fade = min(1, (i + 1) / 5, (len(path) - i) / 5)
            radius = .00015 * fade
            center = center - normal * .00011
            for side in range(sides):
                angle = side * math.tau / sides
                p = center + cross * (math.sin(angle) * radius) + normal * (math.cos(angle) * radius)
                vertices.append(tuple(p))
        for row in range(len(path) - 1):
            for side in range(sides):
                a = row * sides + side; b = row * sides + (side + 1) % sides
                # Path orientation differs around the U; normals are recalculated below.
                faces.append((a, b, b + sides, a + sides))
        faces.append(tuple(reversed(range(sides))))
        faces.append(tuple((len(path) - 1) * sides + side for side in range(sides)))
        obj = base.mesh_object('Cuticle_' + finger, vertices, faces, collection)
        import bmesh
        bm = bmesh.new(); bm.from_mesh(obj.data); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(obj.data); bm.free()
        uv = obj.data.uv_layers.new(name='SkinUV')
        # Choose one skin UV island per face. Interpolating vertex UVs taken
        # from different islands creates the black/chipped rim seen in closeup.
        for face in obj.data.polygons:
            center = sum((obj.data.vertices[index].co for index in face.vertices), Vector()) / len(face.vertices)
            _, _, face_index, _ = bvh.find_nearest(center)
            loops = list(skin.data.polygons[face_index].loop_indices)[:3]
            a, b, c = [skin.data.vertices[skin.data.loops[loop].vertex_index].co for loop in loops]
            ab, ac = b - a, c - a
            d00, d01, d11 = ab.dot(ab), ab.dot(ac), ac.dot(ac)
            divisor = d00 * d11 - d01 * d01
            for loop_index in face.loop_indices:
                p = obj.data.vertices[obj.data.loops[loop_index].vertex_index].co
                ap = p - a; d20, d21 = ap.dot(ab), ap.dot(ac)
                if abs(divisor) > 1e-20:
                    v, w = (d11 * d20 - d01 * d21) / divisor, (d00 * d21 - d01 * d20) / divisor
                    tex = skin_uv[loops[0]].uv * (1 - v - w) + skin_uv[loops[1]].uv * v + skin_uv[loops[2]].uv * w
                else: tex = skin_uv[loops[0]].uv
                uv.data[loop_index].uv = tex
        obj.data.materials.append(skin.data.materials[0])
        group = obj.vertex_groups.new(name=STEMS[finger] + '4'); group.add(list(range(len(vertices))), 1, 'REPLACE')
        obj.parent = rig
        modifier = obj.modifiers.new('Distal skin fold', 'ARMATURE'); modifier.object = rig
        obj['skinPart'] = True
    print('CUTICLES: five buried skin lips; skin-matched UVs, distal attachment')


def uv_region(point):
    """(region, signed dorsal height): each finger beyond its root, palm, forearm."""
    best = None
    for finger in FINGERS:
        distance, s, _, dorsal, _, _ = closest_finger(finger, point)
        radius = FINGERS[finger][3]
        root = .012 if finger == 'thumb' else .004
        if s > root and distance < (radius * 1.5) ** 2 and (best is None or distance < best[0]):
            best = (distance, finger, dorsal)
    if best: return best[1], best[2]
    return ('forearm' if point.y < -.03 else 'palm'), point.z + .0015


def seam_unwrap(skin):
    """Dorsal / palmar halves per finger, palm and forearm, split along the
    lateral midlines and at the finger roots / wrist.
    Smart projection fragmented the voxel surface into hundreds of islands,
    wasting texels and putting normal-map seams across the visible dorsum."""
    import bmesh
    bpy.ops.object.mode_set(mode='OBJECT')
    info = [uv_region(v.co) for v in skin.data.vertices]
    bm = bmesh.new(); bm.from_mesh(skin.data)
    for edge in bm.edges:
        (ra, da), (rb, db) = info[edge.verts[0].index], info[edge.verts[1].index]
        edge.seam = ra != rb or (da >= 0) != (db >= 0)
    bm.to_mesh(skin.data); bm.free()
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.unwrap(method='CONFORMAL', margin=.004)
    bpy.ops.uv.pack_islands(margin=.004, rotate=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    print('UV: seam unwrap, dorsal/palmar halves per region')


def finish():
    # Bake original procedural maps. Photographic references are not used as textures.
    base.UNWRAP = seam_unwrap
    base.bake_skin()
    base.apply_skin_tint()
    mat = bpy.data.objects['Hand'].data.materials[0]
    shader = next(node for node in mat.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
    link = shader.inputs['Roughness'].links[0].from_socket
    factor = mat.node_tree.nodes.new('ShaderNodeMath'); factor.operation = 'MULTIPLY'; factor.inputs[1].default_value = .60
    mat.node_tree.links.new(link, factor.inputs[0]); mat.node_tree.links.new(factor.outputs[0], shader.inputs['Roughness'])
    add_cuticles()
    # The demo poses use the anatomical axes of this new armature.
    original_frame = base.finger_frame
    def frame(finger):
        start = joints(finger)[0]; along = (joints(finger)[1] - start).normalized()
        across, normal = axes(finger, along)
        return start, along, across, normal, FINGERS[finger][2], FINGERS[finger][3]
    base.finger_frame = frame
    base.add_pose_library()
    base.finger_frame = original_frame
    base.export_asset()
    print('ANATOMICAL REBUILD FINISHED')


if __name__ == '__main__':
    build_skin(); sculpt_detail(); optimize_skin(); add_rig(); add_nails(); add_skin_material(); prepare_studio(); finish()
