"""
Blender headless script: import PLY mesh, build Mixamo armature from MHR70
keypoints, bind with automatic weights, export FBX.

Usage (called by generate_mannequins.py):
  blender --background --python blender_rig_export.py -- \
      --ply <mesh.ply> \
      --keypoints <keypoints_mhr70.json> \
      --output <mannequin.fbx>

Requires Blender 3.x or 4.x.
"""

import sys
import argparse
import json
import math
import os


def parse_args():
    # Arguments come after the "--" separator Blender passes to Python scripts
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []

    parser = argparse.ArgumentParser()
    parser.add_argument("--ply",        required=True,  help="Input PLY mesh path")
    parser.add_argument("--keypoints",  required=True,  help="MHR70 keypoints JSON path")
    parser.add_argument("--output",     required=True,  help="Output FBX path")
    return parser.parse_args(argv)


def load_keypoints(path: str):
    import numpy as np
    with open(path) as f:
        data = json.load(f)
    kpts = np.array(data["keypoints_3d"], dtype=np.float32)
    if kpts.ndim == 1:
        kpts = kpts.reshape(-1, 3)
    return kpts[:70]


def coord_mhr_to_blender(v):
    """
    SAM 3D Body / OpenCV camera space (X right, Y down, Z forward)
    → Blender world space (X right, Y forward, Z up).
    """
    x, y, z = float(v[0]), float(v[1]), float(v[2])
    return (x, z, -y)


def build_mixamo_armature(kpts, context):
    """
    Create a Mixamo-named armature from MHR70 keypoints.
    Returns the armature object.
    """
    import bpy
    from mathutils import Vector, Matrix

    # Import mapping from our helper module (added to sys.path by caller)
    from mhr_to_mixamo import compute_mixamo_bone_heads, MIXAMO_HIERARCHY

    raw_heads = compute_mixamo_bone_heads(kpts)

    # Convert all positions to Blender coordinate system
    heads = {name: Vector(coord_mhr_to_blender(pos))
             for name, pos in raw_heads.items()}

    # Create armature data + object
    arm_data = bpy.data.armatures.new("MannequinArmature")
    arm_data.display_type = "OCTAHEDRAL"
    arm_obj = bpy.data.objects.new("Armature", arm_data)
    context.collection.objects.link(arm_obj)
    context.view_layer.objects.active = arm_obj
    arm_obj.select_set(True)

    bpy.ops.object.mode_set(mode="EDIT")
    edit_bones = arm_data.edit_bones

    created = {}

    def get_tail(bone_name: str) -> Vector:
        """
        Tail = position of first child, or extrapolated from parent→head direction.
        """
        children = [n for n, p in MIXAMO_HIERARCHY.items() if p == bone_name]
        children_in_heads = [c for c in children if c in heads]
        if children_in_heads:
            return heads[children_in_heads[0]]
        # Leaf bone: extrapolate along parent→this direction
        parent = MIXAMO_HIERARCHY.get(bone_name)
        if parent and parent in heads:
            direction = heads[bone_name] - heads[parent]
            if direction.length < 1e-4:
                direction = Vector((0, 0, 0.05))
            return heads[bone_name] + direction * 0.5
        return heads[bone_name] + Vector((0, 0, 0.05))

    # Create bones in order so parents always exist first
    root_bones = [n for n, p in MIXAMO_HIERARCHY.items() if p is None]
    ordered = []
    queue = list(root_bones)
    while queue:
        bone = queue.pop(0)
        ordered.append(bone)
        children = [n for n, p in MIXAMO_HIERARCHY.items() if p == bone]
        queue.extend(children)

    for bone_name in ordered:
        if bone_name not in heads:
            continue

        eb = edit_bones.new(bone_name)
        eb.head = heads[bone_name]
        eb.tail = get_tail(bone_name)

        # Minimum bone length guard
        if (eb.tail - eb.head).length < 0.005:
            eb.tail = eb.head + Vector((0, 0, 0.05))

        parent_name = MIXAMO_HIERARCHY.get(bone_name)
        if parent_name and parent_name in created:
            eb.parent = created[parent_name]
            eb.use_connect = False  # Mixamo rigs are non-connected

        created[bone_name] = eb

    bpy.ops.object.mode_set(mode="OBJECT")
    return arm_obj


def import_ply(ply_path: str, context):
    """Import PLY and return the mesh object."""
    import bpy

    before = set(bpy.data.objects.keys())
    bpy.ops.wm.ply_import(filepath=ply_path)
    after = set(bpy.data.objects.keys())
    new_objs = after - before
    if not new_objs:
        raise RuntimeError(f"PLY import produced no new objects: {ply_path}")

    mesh_obj = bpy.data.objects[list(new_objs)[0]]
    mesh_obj.name = "MannequinMesh"

    # SAM 3D Body PLY: OpenCV space (X right, Y down, Z forward)
    # Apply rotation so it aligns with Blender Z-up world
    mesh_obj.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.select_all(action="DESELECT")
    mesh_obj.select_set(True)
    context.view_layer.objects.active = mesh_obj
    bpy.ops.object.transform_apply(rotation=True, scale=True)

    return mesh_obj


def bind_mesh_to_armature(mesh_obj, arm_obj, context):
    """
    Parent the mesh to the armature and compute automatic skinning weights.
    """
    import bpy

    bpy.ops.object.select_all(action="DESELECT")
    mesh_obj.select_set(True)
    arm_obj.select_set(True)
    context.view_layer.objects.active = arm_obj

    # Parent with automatic weights (heat diffusion skinning)
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")

    # Rename armature modifier to a standard name
    for mod in mesh_obj.modifiers:
        if mod.type == "ARMATURE":
            mod.name = "Armature"
            break


def export_fbx(arm_obj, mesh_obj, output_path: str):
    """Export mesh + armature as FBX."""
    import bpy

    bpy.ops.object.select_all(action="DESELECT")
    mesh_obj.select_set(True)
    arm_obj.select_set(True)

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    bpy.ops.export_scene.fbx(
        filepath=output_path,
        use_selection=True,
        # Axis convention for fbx2glb / standard glTF pipeline
        axis_forward="-Z",
        axis_up="Y",
        # Armature settings
        add_leaf_bones=False,
        use_armature_deform_only=True,
        # No baked animations (T-pose bind only)
        bake_anim=False,
        # Geometry
        mesh_smooth_type="FACE",
        use_mesh_modifiers=True,
        # Naming
        use_custom_props=False,
    )
    print(f"[blender_rig_export] FBX written: {output_path}")


def main():
    import bpy

    args = parse_args()

    # Add the sam3d tools dir to sys.path so mhr_to_mixamo can be imported
    script_dir = os.path.dirname(os.path.abspath(__file__))
    if script_dir not in sys.path:
        sys.path.insert(0, script_dir)

    context = bpy.context

    # Clear default scene
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Load keypoints
    kpts = load_keypoints(args.keypoints)
    print(f"[blender_rig_export] Loaded {len(kpts)} MHR70 keypoints")

    # Import mesh
    print(f"[blender_rig_export] Importing PLY: {args.ply}")
    mesh_obj = import_ply(args.ply, context)

    # Build armature
    print("[blender_rig_export] Building Mixamo armature...")
    arm_obj = build_mixamo_armature(kpts, context)

    # Bind mesh to armature with automatic weights
    print("[blender_rig_export] Computing automatic skinning weights...")
    bind_mesh_to_armature(mesh_obj, arm_obj, context)

    # Export
    print(f"[blender_rig_export] Exporting FBX: {args.output}")
    export_fbx(arm_obj, mesh_obj, args.output)

    print("[blender_rig_export] Done.")


if __name__ == "__main__":
    main()
