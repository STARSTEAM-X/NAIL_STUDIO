"""Linear-time structural/geometry acceptance checks for the NEW hand asset."""
import json
import math
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'apps/web/public/models/realistic-hand-v1.glb'
FINGERS = ('thumb', 'index', 'middle', 'ring', 'little')
COMPONENTS = {5121: ('B', 1), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
WIDTHS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def verify():
    raw = ASSET.read_bytes()
    assert raw[:4] == b'glTF' and struct.unpack_from('<I', raw, 4)[0] == 2
    size = struct.unpack_from('<I', raw, 12)[0]
    document = json.loads(raw[20:20 + size])
    binary = 20 + size + 8

    def accessor(index):
        item = document['accessors'][index]
        view = document['bufferViews'][item['bufferView']]
        kind, component_size = COMPONENTS[item['componentType']]
        width = WIDTHS[item['type']]
        stride = view.get('byteStride', component_size * width)
        offset = binary + view.get('byteOffset', 0) + item.get('byteOffset', 0)
        return [struct.unpack_from('<' + kind * width, raw, offset + row * stride) for row in range(item['count'])]

    nodes = {node.get('name'): node for node in document['nodes']}
    expected = {'Hand'} | {'Nail_' + finger for finger in FINGERS} | {'Cuticle_' + finger for finger in FINGERS}
    meshes = {name: node for name, node in nodes.items() if 'mesh' in node}
    assert set(meshes) == expected, set(meshes)
    assert len(document['skins']) == 1
    assert len(document['skins'][0]['joints']) == 23
    assert all(stem + str(index) in nodes for stem in ('Thumb', 'Index', 'Middle', 'Ring', 'Pinky') for index in (1, 2, 3, 4))
    assert all(finger.title() + '_NailRoot' in nodes for finger in FINGERS)
    assert len(raw) < 16 * 1024 * 1024, 'GLB exceeds the 16 MiB budget'
    counts = {}
    for name, node in meshes.items():
        primitive = document['meshes'][node['mesh']]['primitives'][0]
        attributes = primitive['attributes']
        assert {'POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0'} <= attributes.keys(), name
        positions = accessor(attributes['POSITION'])
        normals = accessor(attributes['NORMAL'])
        uv = accessor(attributes['TEXCOORD_0'])
        weights = accessor(attributes['WEIGHTS_0'])
        joints = accessor(attributes['JOINTS_0'])
        assert all(math.isfinite(value) for rows in (positions, normals, uv, weights) for row in rows for value in row), name
        assert all(abs(sum(row) - 1) < 1e-4 for row in weights), name
        assert all(0 <= joint < 23 for row in joints for joint in row), name
        assert all(-1e-5 <= value <= 1.00001 for row in uv for value in row), name
        if name.startswith('Nail_'):
            assert all(abs(row[0] - 1) < 1e-5 for row in weights), name
            assert len({row[0] for row in joints}) == 1, name
        indices = [row[0] for row in accessor(primitive['indices'])]
        # UV seams duplicate vertices. Weld positions for a geometric manifold
        # check without changing/exporting geometry or searching vertex pairs.
        ids, welded = {}, []
        for point in positions:
            key = tuple(round(value, 7) for value in point)
            if key not in ids:
                ids[key] = len(ids)
            welded.append(ids[key])
        edges, volume = {}, 0.0
        for cursor in range(0, len(indices), 3):
            ia, ib, ic = indices[cursor:cursor + 3]
            a, b, c = positions[ia], positions[ib], positions[ic]
            volume += (a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6
            for start, end in ((ia, ib), (ib, ic), (ic, ia)):
                left, right = welded[start], welded[end]
                edge = (min(left, right), max(left, right))
                edges[edge] = edges.get(edge, 0) + 1
        assert volume > 0, (name, 'inward winding', volume)
        assert all(count == 2 for count in edges.values()), (name, 'open/nonmanifold shell')
        counts[name] = {'vertices': len(positions), 'triangles': len(indices) // 3, 'volumeM3': volume}
    skin_material = document['materials'][document['meshes'][nodes['Hand']['mesh']]['primitives'][0]['material']]
    assert 'normalTexture' in skin_material
    assert 'baseColorTexture' in skin_material['pbrMetallicRoughness']
    assert 'metallicRoughnessTexture' in skin_material['pbrMetallicRoughness']
    assert not any(skin_material.get('emissiveFactor', [])), 'Skin must not emit light'
    source = (ROOT / 'tools/create_realistic_hand.py').read_text(encoding='utf-8')
    assert 'import_scene' not in source and 'hand_source.glb' not in source
    result = {'asset': str(ASSET), 'bytes': len(raw), 'bones': 23, 'nailSockets': 5, 'meshes': counts, 'checks': 'PASS: closed shells, winding, finite UVs, weights, bone bindings, PBR maps, new geometry provenance'}
    print(json.dumps(result, indent=2))
    return result


if __name__ == '__main__':
    verify()
