"""Build the two local FBX characters with fitted Mixamo rigs and baked locomotion.

Requires Blender 4.5. Run preview_sources.py once to stage sources in .tmp.
Source FBX files remain unchanged. Exported assets contain all textures.
"""
import bpy
import bmesh
import json
import math
import sys
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.kdtree import KDTree

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / '.tmp/characters'
OUT = ROOT / 'frontend/public/models/characters'
OUT.mkdir(parents=True, exist_ok=True)
CLIPS = {'Idle': '기본 자세.fbx', 'Walk': '걷기.fbx', 'Run': '달리기.fbx', 'Jump': 'Jump.fbx', 'Sit': 'Stand To Sit.fbx'}
CORE = ['Hips','Spine','Spine1','Spine2','Neck','Head']
LIMBS = ['Shoulder','Arm','ForeArm','Hand','UpLeg','Leg','Foot','ToeBase']
NAMES = CORE + [side + part for side in ['Left','Right'] for part in LIMBS]
PREFIX = 'mixamorig:'

def select(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

def sample_clips():
    clips = {}
    for label, filename in CLIPS.items():
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.fbx(filepath=str(Path('C:/Users/User/Downloads') / filename))
        arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
        action = arm.animation_data.action
        start, end = [int(x) for x in action.frame_range]
        bpy.context.view_layer.update()
        rest = {name: arm.matrix_world @ arm.data.bones[PREFIX+name].matrix_local for name in NAMES}
        samples = []
        for frame in range(start, end + 1):
            bpy.context.scene.frame_set(frame)
            samples.append({name: arm.matrix_world @ arm.pose.bones[PREFIX+name].matrix for name in NAMES})
        clips[label] = {'rest': rest, 'samples': samples, 'fps': bpy.context.scene.render.fps}
        print('SAMPLED', label, len(samples), clips[label]['fps'], flush=True)
    return clips

def landmarks(height, gender):
    # Fractions fitted against the supplied front views, not generic adult proportions.
    points = {'Hips': (0,0,.515), 'Spine': (0,0,.575), 'Spine1': (0,0,.635),
              'Spine2': (0,0,.698), 'Neck': (0,0,.777), 'Head': (0,0,.805)}
    for side, sign in [('Left',1),('Right',-1)]:
        values = {'Shoulder': (.041,0,.727), 'Arm': (.098,0,.725),
                  'ForeArm': (.163,-.006,.619), 'Hand': (.225,-.01,.524),
                  'UpLeg': (.058,0,.514), 'Leg': (.066,-.008,.278),
                  'Foot': (.071,.003,.065), 'ToeBase': (.071,-.07,.027)}
        if gender == 'female':
            values.update(Arm=(.089,0,.730), ForeArm=(.143,-.006,.619), Hand=(.190,-.01,.518),
                          UpLeg=(.061,0,.51), Leg=(.063,-.008,.275), Foot=(.066,.003,.065), ToeBase=(.066,-.065,.028))
        for part, (x,y,z) in values.items():
            points[side+part] = (sign*x,y,z)
    return {name: Vector(point)*height for name,point in points.items()}

def create_rig(height, gender, source_rest):
    points = landmarks(height, gender)
    data = bpy.data.armatures.new(gender + '-skeleton')
    rig = bpy.data.objects.new(gender + '-rig', data)
    bpy.context.collection.objects.link(rig)
    select(rig)
    bpy.ops.object.mode_set(mode='EDIT')
    parent = {'Hips': None, 'Spine':'Hips','Spine1':'Spine','Spine2':'Spine1','Neck':'Spine2','Head':'Neck'}
    tails = {'Hips':'Spine','Spine':'Spine1','Spine1':'Spine2','Spine2':'Neck','Neck':'Head'}
    for side in ['Left','Right']:
        chain = ['Shoulder','Arm','ForeArm','Hand']
        leg = ['UpLeg','Leg','Foot','ToeBase']
        for parts, root in [(chain,'Spine2'),(leg,'Hips')]:
            for i,part in enumerate(parts):
                name = side+part
                parent[name] = root if i == 0 else side+parts[i-1]
                if i < len(parts)-1: tails[name] = side+parts[i+1]
    for name in NAMES:
        bone = data.edit_bones.new(name)
        bone.head = points[name]
        if name in tails:
            bone.tail = points[tails[name]]
        elif name == 'Head':
            bone.tail = Vector((0,0,.96))*height
        elif name.endswith('Hand'):
            side = name[:-4]
            bone.tail = bone.head + (bone.head - points[side+'ForeArm']).normalized() * height * .077
        else:
            bone.tail = bone.head + Vector((0,-.04*height,0))
        src_rotation = source_rest[name].to_quaternion()
        source_y = src_rotation @ Vector((0,1,0))
        fit_rotation = source_y.rotation_difference((bone.tail-bone.head).normalized()) @ src_rotation
        bone.align_roll(fit_rotation @ Vector((0,0,1)))
        if parent[name]: bone.parent = data.edit_bones[parent[name]]
    bpy.ops.object.mode_set(mode='OBJECT')
    return rig

def prepare_mesh(gender, height):
    bpy.ops.wm.open_mainfile(filepath=str(WORK / gender / 'source.blend'))
    mesh = next(o for o in bpy.data.objects if o.type == 'MESH')
    mesh.name = gender + '-body'
    select(mesh)
    minimum = min(v.co.z for v in mesh.data.vertices)
    maximum = max(v.co.z for v in mesh.data.vertices)
    scale = height / (maximum-minimum)
    for vertex in mesh.data.vertices:
        vertex.co.z -= minimum
        vertex.co *= scale
    bm = bmesh.new()
    bm.from_mesh(mesh.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.00003)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh.data)
    bm.free()
    decimate = mesh.modifiers.new('Game mesh simplification','DECIMATE')
    decimate.ratio = min(1, 38000 / len(mesh.data.polygons))
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    for polygon in mesh.data.polygons: polygon.use_smooth = True
    for img in bpy.data.images:
        if img.size[0] > 2048: img.scale(2048,2048)
        img.pack()
    # FBX material conversion sometimes leaves a metallic link at full strength.
    for mat in mesh.data.materials:
        if mat and mat.use_nodes:
            bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
            for link in list(bsdf.inputs['Metallic'].links): mat.node_tree.links.remove(link)
            bsdf.inputs['Metallic'].default_value = 0
    return mesh

def skin(mesh, rig, gender, height):
    bpy.ops.object.select_all(action='DESELECT')
    mesh.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    unweighted = [v.index for v in mesh.data.vertices if not v.groups or sum(g.weight for g in v.groups) < 1e-6]
    if unweighted:
        # Tiny disconnected triangles can miss the heat solve; transfer from adjacent surface.
        if len(unweighted) > len(mesh.data.vertices)*.01:
            raise RuntimeError(f'Automatic weighting left {len(unweighted)} vertices unbound')
        missing=set(unweighted)
        tree=KDTree(len(mesh.data.vertices)-len(missing))
        for vertex in mesh.data.vertices:
            if vertex.index not in missing: tree.insert(vertex.co,vertex.index)
        tree.balance()
        for index in unweighted:
            _,nearest,distance=tree.find(mesh.data.vertices[index].co)
            if distance > height*.02: raise RuntimeError('Unbound disconnected geometry exceeds transfer radius')
            for weight in mesh.data.vertices[nearest].groups:
                mesh.vertex_groups[weight.group].add([index],weight.weight,'REPLACE')
        print('WEIGHT REPAIR',gender,len(unweighted),'isolated vertices',flush=True)
    # Keep the face and crown rigid; retain automatic torso influence at long hair tips.
    for vertex in mesh.data.vertices:
        if vertex.co.z > height * .80:
            for group in mesh.vertex_groups: group.remove([vertex.index])
            mesh.vertex_groups['Head'].add([vertex.index],1,'REPLACE')
    select(mesh)
    bpy.ops.object.vertex_group_limit_total(limit=4)
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    print('SKIN', gender, len(mesh.data.vertices),len(mesh.data.polygons), flush=True)

def bake(rig, mesh, clips, height):
    rest = {b.name:b.matrix_local.copy() for b in rig.data.bones}
    rig.animation_data_create()
    for label,clip in clips.items():
        action = bpy.data.actions.new(label)
        rig.animation_data.action = action
        samples = clip['samples']
        count = len(samples)
        source_hip = clip['rest']['Hips'].translation.z
        ratio = rest['Hips'].translation.z/source_hip
        poses = []
        for index,sample in enumerate(samples):
            desired = {}
            for name in NAMES:
                canonical = rest[name].to_quaternion()
                if name.endswith(('Arm','ForeArm','Hand')):
                    canonical = clip['rest'][name].to_quaternion()
                desired[name] = sample[name].to_quaternion() @ clip['rest'][name].to_quaternion().inverted() @ canonical
            phase = index / (count-1)
            root = sample['Hips'].translation.copy()
            drift = samples[0]['Hips'].translation.lerp(samples[-1]['Hips'].translation,phase)
            root.x = (root.x-drift.x)*ratio
            root.y = (root.y-drift.y)*ratio
            root.z = (root.z-source_hip)*ratio
            if label == 'Jump': root.z = 0  # Physics owns vertical displacement.
            rotations = {}
            for bone in rig.data.bones:
                name = bone.name
                parent = bone.parent
                rest_relative = rest[parent.name].to_quaternion().inverted() @ rest[name].to_quaternion() if parent else rest[name].to_quaternion()
                pose_relative = desired[parent.name].inverted() @ desired[name] if parent else desired[name]
                rotations[name] = rest_relative.inverted() @ pose_relative
            poses.append((rotations,root))
        # Close each loop over its final five samples (the source endpoint is almost equal).
        for index in range(max(1,count-5),count) if label not in ('Jump', 'Sit') else []:
            alpha = (index-(count-5))/4
            alpha = alpha*alpha*(3-2*alpha)
            rotations,root = poses[index]
            for name in rotations: rotations[name] = rotations[name].slerp(poses[0][0][name],alpha)
            poses[index] = (rotations, root.lerp(poses[0][1],alpha))
        for index,(rotations,root) in enumerate(poses):
            frame = index+1
            bpy.context.scene.frame_set(frame)
            for bone in rig.pose.bones:
                bone.rotation_mode = 'QUATERNION'
                bone.rotation_quaternion = rotations[bone.name]
                bone.location = (0,0,0)
            hips = rig.pose.bones['Hips']
            hips.location = rest['Hips'].to_quaternion().inverted() @ root
            bpy.context.view_layer.update()
            # Correct sole penetration caused by changed leg/shoe proportions.
            evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
            low = min(v.co.z for v in evaluated.data.vertices)
            if low < 0:
                hips.location += rest['Hips'].to_quaternion().inverted() @ Vector((0,0,-low))
            for bone in rig.pose.bones:
                bone.keyframe_insert('rotation_quaternion',frame=frame,group=bone.name)
            hips.keyframe_insert('location',frame=frame,group='Hips')
        track = rig.animation_data.nla_tracks.new()
        track.name = label
        track.strips.new(label,1,action)
        track.mute = True
        print('BAKED', label, count, flush=True)
    rig.animation_data.action = None
    for track in rig.animation_data.nla_tracks: track.mute = False
    return

def render_preview(mesh, rig, gender):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 16
    scene.render.resolution_x = 600
    scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100
    scene.world = bpy.data.worlds.new('Preview world')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.18,.20,.25,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .6
    for location,energy,size in [((2,-3,4),450,4),((-2,-1,2),200,3),((0,2,3),350,3)]:
        bpy.ops.object.light_add(type='AREA',location=location)
        light=bpy.context.object
        light.data.energy=energy
        light.data.size=size
        light.rotation_euler=(Vector((0,0,1))-light.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=(2,-5,1.3))
    camera = bpy.context.object
    camera.rotation_euler=(Vector((0,0,.86))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO'
    camera.data.ortho_scale=2.08
    scene.camera=camera
    for track in rig.animation_data.nla_tracks: track.mute=True
    for label in CLIPS:
        rig.animation_data.action=bpy.data.actions[label]
        for frame in ([1] if label=='Idle' else [1,8,16]):
            scene.frame_set(frame)
            scene.render.filepath=str(WORK/gender/f'{label}-{frame}.png')
            bpy.ops.render.render(write_still=True)

clips = sample_clips()
genders = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['male','female']
for gender in genders:
    height=1.72 if gender=='male' else 1.66
    mesh=prepare_mesh(gender,height)
    rig=create_rig(height,gender,clips['Idle']['rest'])
    skin(mesh,rig,gender,height)
    bake(rig,mesh,clips,height)
    scene=bpy.context.scene
    scene.render.fps=clips['Idle']['fps']
    scene.frame_start=1
    scene.frame_end=181
    bpy.ops.object.select_all(action='DESELECT')
    mesh.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.wm.save_as_mainfile(filepath=str(WORK/gender/'rigged.blend'))
    bpy.ops.export_scene.gltf(filepath=str(OUT/f'{gender}.glb'), export_format='GLB', use_selection=True,
        export_animations=True, export_animation_mode='NLA_TRACKS', export_nla_strips=True,
        export_force_sampling=True, export_anim_slide_to_zero=True,
        export_image_format='JPEG', export_jpeg_quality=90, export_yup=True)
    print('EXPORTED',gender,(OUT/f'{gender}.glb').stat().st_size,flush=True)
    render_preview(mesh,rig,gender)
