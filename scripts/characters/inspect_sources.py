"""Run with Blender --background --python scripts/characters/inspect_sources.py."""
import bpy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCES = {
    'male': Path('C:/Users/User/Documents/카카오톡 받은 파일/남캐/Meshy_AI_Midnight_Aura_1119010906_texture_fbx/Meshy_AI_Midnight_Aura_1119010906_texture.fbx'),
    'female': Path('C:/Users/User/Documents/카카오톡 받은 파일/여캐/Meshy_AI_Midnight_Urban_Muse_1119010846_texture_fbx/Meshy_AI_Midnight_Urban_Muse_1119010846_texture.fbx'),
    'Idle': Path('C:/Users/User/Downloads/기본 자세.fbx'),
    'Walk': Path('C:/Users/User/Downloads/걷기.fbx'),
    'Run': Path('C:/Users/User/Downloads/달리기.fbx'),
}

result = {}
for key, path in SOURCES.items():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(path))
    objects = []
    for obj in bpy.data.objects:
        entry = {'name': obj.name, 'type': obj.type, 'location': list(obj.location), 'rotation': list(obj.rotation_euler), 'scale': list(obj.scale), 'dimensions': list(obj.dimensions)}
        if obj.type == 'MESH':
            entry.update(vertices=len(obj.data.vertices), polygons=len(obj.data.polygons), vertex_groups=len(obj.vertex_groups), materials=[m.name for m in obj.data.materials if m])
        if obj.type == 'ARMATURE':
            entry['bones'] = [{'name': b.name, 'parent': b.parent.name if b.parent else None, 'head': list(obj.matrix_world @ b.head_local), 'tail': list(obj.matrix_world @ b.tail_local)} for b in obj.data.bones]
        objects.append(entry)
    result[key] = {'objects': objects, 'actions': [{'name': a.name, 'range': list(a.frame_range)} for a in bpy.data.actions], 'images': [{'name': i.name, 'size': list(i.size), 'path': i.filepath} for i in bpy.data.images]}
    print('SOURCE', key, json.dumps(result[key], ensure_ascii=True), flush=True)
out = ROOT / '.tmp/characters'
out.mkdir(parents=True, exist_ok=True)
(out / 'inspection.json').write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding='utf-8')
