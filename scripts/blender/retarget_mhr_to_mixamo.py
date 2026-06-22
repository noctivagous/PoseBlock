"""
Retarget SAM 3D Body (MHR skeleton) mesh to Mixamo skeleton and export GLB.

Run headless:
  blender --background --python scripts/blender/retarget_mhr_to_mixamo.py -- \\
    --input assets/raw/teen_f_mhr.glb \\
    --template public/models/ybot_mixamo.glb \\
    --output public/models/teen_f_mixamo.glb
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import bpy


def parse_cli_args() -> dict:
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []

    args = {
        "input": None,
        "template": None,
        "output": None,
        "bone_map": None,
        "texture_max": 2048,
        "target_height": 1.7,
    }

    i = 0
    while i < len(argv):
        key = argv[i]
        if key.startswith("--") and i + 1 < len(argv):
            name = key[2:].replace("-", "_")
            if name in args:
                args[name] = argv[i + 1]
                i += 2
                continue
        i += 1

    if not args["input"] or not args["template"] or not args["output"]:
        raise SystemExit(
            "Usage: blender --background --python retarget_mhr_to_mixamo.py -- "
            "--input <mhr.glb> --template <mixamo.glb> --output <out.glb>"
        )

    return args


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        bpy.data.meshes.remove(block)
    for block in bpy.data.armatures:
        bpy.data.armatures.remove(block)


def import_glb(path: str) -> list[bpy.types.Object]:
    bpy.ops.import_scene.gltf(filepath=path)
    return list(bpy.context.selected_objects)


def find_armature(objects: list[bpy.types.Object]) -> bpy.types.Object | None:
    for obj in objects:
        if obj.type == "ARMATURE":
            return obj
    return None


def find_meshes(objects: list[bpy.types.Object]) -> list[bpy.types.Object]:
    return [o for o in objects if o.type == "MESH"]


def strip_prefix(name: str) -> str:
    if name.startswith("mixamorig:"):
        return name[len("mixamorig:") :]
    if name.startswith("mixamorig_"):
        return name[len("mixamorig_") :]
    return name


def load_bone_map(script_dir: Path) -> dict[str, str]:
    map_path = script_dir / "bone_map_mhr_mixamo.json"
    data = json.loads(map_path.read_text())
    return data["mhr_to_mixamo"]


def rename_mhr_bones(armature: bpy.types.Object, bone_map: dict[str, str]) -> None:
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="EDIT")
    edit_bones = armature.data.edit_bones

    for bone in list(edit_bones):
        key = bone.name.lower()
        key_stripped = strip_prefix(key)
        target = bone_map.get(key) or bone_map.get(key_stripped)
        if target and bone.name != target:
            bone.name = target

    bpy.ops.object.mode_set(mode="OBJECT")


def apply_mixamo_armature(
    source_meshes: list[bpy.types.Object],
    template_armature: bpy.types.Object,
) -> bpy.types.Object:
    """Parent meshes to template Mixamo armature and transfer weights."""
    target = template_armature

    for mesh_obj in source_meshes:
        # Remove old armature modifiers pointing to other rigs
        for mod in list(mesh_obj.modifiers):
            if mod.type == "ARMATURE":
                mesh_obj.modifiers.remove(mod)

        mesh_obj.parent = target
        mod = mesh_obj.modifiers.new(name="Armature", type="ARMATURE")
        mod.object = target

        bpy.context.view_layer.objects.active = mesh_obj
        bpy.ops.object.vertex_group_remove_from(use_all_groups=True)

        try:
            bpy.ops.object.data_transfer(
                data_type="VGROUP_WEIGHTS",
                use_create=True,
                vert_mapping="NEAREST",
                mix_mode="REPLACE",
            )
        except Exception:
            # Fallback: automatic weights from template rest pose
            bpy.ops.object.parent_set(type="ARMATURE_AUTO")

    return target


def normalize_height(objects: list[bpy.types.Object], target_height: float) -> None:
    meshes = [o for o in objects if o.type == "MESH"]
    if not meshes:
        return

    min_z = min(v.co.z for o in meshes for v in o.data.vertices)
    max_z = max(v.co.z for o in meshes for v in o.data.vertices)
    height = max_z - min_z
    if height <= 0:
        return

    scale = target_height / height
    for obj in objects:
        obj.scale = (scale, scale, scale)

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)


def downscale_textures(max_size: int) -> None:
    for image in bpy.data.images:
        if image.size[0] <= max_size and image.size[1] <= max_size:
            continue
        scale = min(max_size / image.size[0], max_size / image.size[1])
        new_w = int(image.size[0] * scale)
        new_h = int(image.size[1] * scale)
        image.scale(new_w, new_h)


def export_glb(path: str, objects: list[bpy.types.Object]) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)

    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
    )


def main() -> None:
    args = parse_cli_args()
    script_dir = Path(__file__).resolve().parent
    bone_map = load_bone_map(script_dir)

    clear_scene()

    print(f"Importing MHR source: {args['input']}")
    source_objects = import_glb(args["input"])
    source_armature = find_armature(source_objects)
    source_meshes = find_meshes(source_objects)

    if not source_meshes:
        raise RuntimeError("No mesh found in source GLB")

    if source_armature:
        rename_mhr_bones(source_armature, bone_map)

    print(f"Importing Mixamo template: {args['template']}")
    template_objects = import_glb(args["template"])
    template_armature = find_armature(template_objects)

    if not template_armature:
        raise RuntimeError("No armature found in template GLB")

    # Remove template mesh skin — keep armature only
    for obj in template_objects:
        if obj.type == "MESH":
            bpy.data.objects.remove(obj, do_unlink=True)

    # Use source skin with template rig
    target_armature = apply_mixamo_armature(source_meshes, template_armature)

    export_objects = source_meshes + [target_armature]
    normalize_height(export_objects, float(args["target_height"]))
    downscale_textures(int(args["texture_max"]))

    print(f"Exporting: {args['output']}")
    export_glb(args["output"], export_objects)
    print("Done.")


if __name__ == "__main__":
    main()
