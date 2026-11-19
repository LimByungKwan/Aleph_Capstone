"""Stationary Lumi guide: fitted rig, idle and greeting, no locomotion."""
import sys
import shutil
from pathlib import Path
import bpy
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_characters as pipeline

work = pipeline.WORK / 'lumi'
work.mkdir(parents=True, exist_ok=True)
shutil.copy2('C:/Users/User/Documents/카카오톡 받은 파일/루미.fbx', work / 'source.fbx')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(work / 'source.fbx'))
mesh = next(o for o in bpy.data.objects if o.type == 'MESH')
pipeline.select(mesh)
bpy.context.view_layer.update()
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.wm.save_as_mainfile(filepath=str(work / 'source.blend'))
pipeline.CLIPS = {'Idle': '기본 자세.fbx', 'Greeting': 'Hand Raising.fbx'}
clips = pipeline.sample_clips()
mesh = pipeline.prepare_mesh('lumi', 1.66)
rig = pipeline.create_rig(1.66, 'female', clips['Idle']['rest'])
pipeline.skin(mesh, rig, 'lumi', 1.66)
pipeline.bake(rig, mesh, clips, 1.66)
bpy.context.scene.render.fps = 30
bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=str(pipeline.OUT / 'lumi.glb'), export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='NLA_TRACKS', export_nla_strips=True,
    export_force_sampling=True, export_anim_slide_to_zero=True,
    export_image_format='JPEG', export_jpeg_quality=90, export_yup=True)
for track in rig.animation_data.nla_tracks: track.mute = True
rig.animation_data.action = bpy.data.actions['Idle']
bpy.context.scene.frame_set(1)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(pipeline.ROOT / 'assets/characters/lumi.blend'), compress=True)
pipeline.render_preview(mesh, rig, 'lumi', frame_samples=[1,78,130])
shutil.copy2(work / 'Idle-1.png', pipeline.ROOT / 'assets/characters/lumi-preview.png')
