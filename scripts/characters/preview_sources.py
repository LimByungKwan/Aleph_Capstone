import bpy
import json
import shutil
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.tmp/characters'
SOURCES = json.loads((OUT / 'inspection.json').read_text(encoding='utf-8'))

def camera_at(position, target):
    bpy.ops.object.camera_add(location=position)
    camera = bpy.context.object
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 2.15
    bpy.context.scene.camera = camera

for gender, folder, stem in [('male','남캐','Meshy_AI_Midnight_Aura_1119010906_texture'), ('female','여캐','Meshy_AI_Midnight_Urban_Muse_1119010846_texture')]:
    src = Path('C:/Users/User/Documents/카카오톡 받은 파일') / folder / (stem + '_fbx')
    local = OUT / gender
    local.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src / (stem + '.fbx'), local / 'source.fbx')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(local / 'source.fbx'))
    mesh = next(o for o in bpy.data.objects if o.type == 'MESH')
    bpy.context.view_layer.update()
    bpy.context.view_layer.objects.active = mesh
    mesh.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    coords = [v.co for v in mesh.data.vertices]
    print(gender, 'BOUND', [min(v[i] for v in coords) for i in range(3)], [max(v[i] for v in coords) for i in range(3)], flush=True)
    # Save normalized inspection coordinates for the fitting script.
    bpy.ops.wm.save_as_mainfile(filepath=str(local / 'source.blend'))
    for img in bpy.data.images:
        if img.size[0] > 2048:
            img.scale(2048, 2048)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 12
    scene.render.resolution_x = 600
    scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100
    scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (0.25,0.25,0.25,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = 0.7
    bpy.ops.object.light_add(type='AREA', location=(1,-3,4))
    bpy.context.object.data.energy = 450
    bpy.context.object.data.shape = 'DISK'
    bpy.context.object.data.size = 4
    bpy.context.object.rotation_euler = (Vector((0,0,1)) - bpy.context.object.location).to_track_quat('-Z','Y').to_euler()
    camera_at((0,-4,0), (0,0,0))
    scene.render.filepath = str(local / 'front.png')
    bpy.ops.render.render(write_still=True)
