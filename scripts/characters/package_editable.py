"""Package self-contained, editable Blender projects with Idle selected."""
import bpy
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
target = ROOT / 'assets/characters'
target.mkdir(parents=True, exist_ok=True)
for gender in ['male','female']:
    source = ROOT / '.tmp/characters' / gender
    bpy.ops.wm.open_mainfile(filepath=str(source / 'rigged.blend'))
    rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    for track in rig.animation_data.nla_tracks:
        track.mute = True
    rig.animation_data.action = bpy.data.actions['Idle']
    bpy.context.scene.frame_set(1)
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 181
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(target / f'{gender}.blend'), compress=True)
    shutil.copy2(source / 'Idle-1.png', target / f'{gender}-preview.png')
