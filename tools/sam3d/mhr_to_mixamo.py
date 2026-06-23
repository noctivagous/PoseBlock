"""
MHR70 keypoint indices and Mixamo bone position computation.

SAM 3D Body outputs 70 keypoints from the Momentum Human Rig (MHR).
This module maps those keypoints to Mixamo bone positions, computes
a full Mixamo armature hierarchy, and provides helpers for retargeting
MHR body_pose_params to Mixamo quaternion rotations.

MHR70 index reference (from sam_3d_body/metadata/mhr70.py):
  0  nose            5  left_shoulder     6  right_shoulder
  7  left_elbow      8  right_elbow       9  left_hip
  10 right_hip      11  left_knee        12  right_knee
  13 left_ankle     14  right_ankle      15  left_big_toe
  16 left_small_toe 17  left_heel        18  right_big_toe
  19 right_small_toe 20 right_heel       21-40 right hand
  41 right_wrist    42-61 left hand      62 left_wrist
  63 left_olecranon 64 right_olecranon   65 left_cubital_fossa
  66 right_cubital_fossa  67 left_acromion  68 right_acromion
  69 neck
"""

from __future__ import annotations

import numpy as np
from typing import Dict

# ---------------------------------------------------------------------------
# MHR70 keypoint index constants
# ---------------------------------------------------------------------------

MHR = {
    "nose":                 0,
    "left_eye":             1,
    "right_eye":            2,
    "left_ear":             3,
    "right_ear":            4,
    "left_shoulder":        5,
    "right_shoulder":       6,
    "left_elbow":           7,
    "right_elbow":          8,
    "left_hip":             9,
    "right_hip":           10,
    "left_knee":           11,
    "right_knee":          12,
    "left_ankle":          13,
    "right_ankle":         14,
    "left_big_toe":        15,
    "left_small_toe":      16,
    "left_heel":           17,
    "right_big_toe":       18,
    "right_small_toe":     19,
    "right_heel":          20,
    # Right hand (tip → wrist direction)
    "right_thumb_tip":     21,
    "right_thumb_1":       22,
    "right_thumb_2":       23,
    "right_thumb_3":       24,   # MCP (near wrist)
    "right_index_tip":     25,
    "right_index_1":       26,
    "right_index_2":       27,
    "right_index_3":       28,   # MCP
    "right_middle_tip":    29,
    "right_middle_1":      30,
    "right_middle_2":      31,
    "right_middle_3":      32,   # MCP
    "right_ring_tip":      33,
    "right_ring_1":        34,
    "right_ring_2":        35,
    "right_ring_3":        36,   # MCP
    "right_pinky_tip":     37,
    "right_pinky_1":       38,
    "right_pinky_2":       39,
    "right_pinky_3":       40,   # MCP
    "right_wrist":         41,
    # Left hand (tip → wrist direction)
    "left_thumb_tip":      42,
    "left_thumb_1":        43,
    "left_thumb_2":        44,
    "left_thumb_3":        45,   # MCP
    "left_index_tip":      46,
    "left_index_1":        47,
    "left_index_2":        48,
    "left_index_3":        49,   # MCP
    "left_middle_tip":     50,
    "left_middle_1":       51,
    "left_middle_2":       52,
    "left_middle_3":       53,   # MCP
    "left_ring_tip":       54,
    "left_ring_1":         55,
    "left_ring_2":         56,
    "left_ring_3":         57,   # MCP
    "left_pinky_tip":      58,
    "left_pinky_1":        59,
    "left_pinky_2":        60,
    "left_pinky_3":        61,   # MCP
    "left_wrist":          62,
    # Extra landmarks
    "left_olecranon":      63,   # back of left elbow
    "right_olecranon":     64,   # back of right elbow
    "left_cubital_fossa":  65,   # front of left elbow crease
    "right_cubital_fossa": 66,   # front of right elbow crease
    "left_acromion":       67,   # left shoulder blade tip
    "right_acromion":      68,   # right shoulder blade tip
    "neck":                69,
}

# ---------------------------------------------------------------------------
# Mixamo skeleton hierarchy (parent → [children])
# Names match y-bot-bind.json / PoseBlock convention (no "mixamorig:" prefix)
# ---------------------------------------------------------------------------

MIXAMO_HIERARCHY: Dict[str, str | None] = {
    # Torso
    "Hips":         None,
    "Spine":        "Hips",
    "Spine1":       "Spine",
    "Spine2":       "Spine1",
    "Neck":         "Spine2",
    "Head":         "Neck",
    "HeadTop_End":  "Head",
    # Left arm
    "LeftShoulder":     "Spine2",
    "LeftArm":          "LeftShoulder",
    "LeftForeArm":      "LeftArm",
    "LeftHand":         "LeftForeArm",
    "LeftHandThumb1":   "LeftHand",
    "LeftHandThumb2":   "LeftHandThumb1",
    "LeftHandThumb3":   "LeftHandThumb2",
    "LeftHandThumb4":   "LeftHandThumb3",
    "LeftHandIndex1":   "LeftHand",
    "LeftHandIndex2":   "LeftHandIndex1",
    "LeftHandIndex3":   "LeftHandIndex2",
    "LeftHandIndex4":   "LeftHandIndex3",
    "LeftHandMiddle1":  "LeftHand",
    "LeftHandMiddle2":  "LeftHandMiddle1",
    "LeftHandMiddle3":  "LeftHandMiddle2",
    "LeftHandMiddle4":  "LeftHandMiddle3",
    "LeftHandRing1":    "LeftHand",
    "LeftHandRing2":    "LeftHandRing1",
    "LeftHandRing3":    "LeftHandRing2",
    "LeftHandRing4":    "LeftHandRing3",
    "LeftHandPinky1":   "LeftHand",
    "LeftHandPinky2":   "LeftHandPinky1",
    "LeftHandPinky3":   "LeftHandPinky2",
    "LeftHandPinky4":   "LeftHandPinky3",
    # Right arm
    "RightShoulder":    "Spine2",
    "RightArm":         "RightShoulder",
    "RightForeArm":     "RightArm",
    "RightHand":        "RightForeArm",
    "RightHandThumb1":  "RightHand",
    "RightHandThumb2":  "RightHandThumb1",
    "RightHandThumb3":  "RightHandThumb2",
    "RightHandThumb4":  "RightHandThumb3",
    "RightHandIndex1":  "RightHand",
    "RightHandIndex2":  "RightHandIndex1",
    "RightHandIndex3":  "RightHandIndex2",
    "RightHandIndex4":  "RightHandIndex3",
    "RightHandMiddle1": "RightHand",
    "RightHandMiddle2": "RightHandMiddle1",
    "RightHandMiddle3": "RightHandMiddle2",
    "RightHandMiddle4": "RightHandMiddle3",
    "RightHandRing1":   "RightHand",
    "RightHandRing2":   "RightHandRing1",
    "RightHandRing3":   "RightHandRing2",
    "RightHandRing4":   "RightHandRing3",
    "RightHandPinky1":  "RightHand",
    "RightHandPinky2":  "RightHandPinky1",
    "RightHandPinky3":  "RightHandPinky2",
    "RightHandPinky4":  "RightHandPinky3",
    # Left leg
    "LeftUpLeg":    "Hips",
    "LeftLeg":      "LeftUpLeg",
    "LeftFoot":     "LeftLeg",
    "LeftToeBase":  "LeftFoot",
    "LeftToe_End":  "LeftToeBase",
    # Right leg
    "RightUpLeg":   "Hips",
    "RightLeg":     "RightUpLeg",
    "RightFoot":    "RightLeg",
    "RightToeBase": "RightFoot",
    "RightToe_End": "RightToeBase",
}


def _pt(kpts: np.ndarray, name: str) -> np.ndarray:
    """Return the 3D position for a named MHR70 keypoint."""
    return kpts[MHR[name]]


def _mid(*pts: np.ndarray) -> np.ndarray:
    return np.mean(np.stack(pts), axis=0)


def compute_mixamo_bone_heads(kpts: np.ndarray) -> Dict[str, np.ndarray]:
    """
    Compute Mixamo bone head positions from MHR70 keypoints.

    Args:
        kpts: float32 array of shape (70, 3), MHR70 keypoints in 3D space.

    Returns:
        Dict mapping Mixamo bone name → head position (3,).
    """
    ls = _pt(kpts, "left_shoulder")
    rs = _pt(kpts, "right_shoulder")
    le = _pt(kpts, "left_elbow")
    re = _pt(kpts, "right_elbow")
    lw = _pt(kpts, "left_wrist")
    rw = _pt(kpts, "right_wrist")
    lh = _pt(kpts, "left_hip")
    rh = _pt(kpts, "right_hip")
    lk = _pt(kpts, "left_knee")
    rk = _pt(kpts, "right_knee")
    la = _pt(kpts, "left_ankle")
    ra = _pt(kpts, "right_ankle")
    neck = _pt(kpts, "neck")
    nose = _pt(kpts, "nose")
    la_kpts = _pt(kpts, "left_acromion")
    ra_kpts = _pt(kpts, "right_acromion")

    hips = _mid(lh, rh)

    # Spine chain interpolated between hips and neck
    spine_dir = neck - hips
    spine   = hips  + 0.25 * spine_dir
    spine1  = hips  + 0.50 * spine_dir
    spine2  = hips  + 0.75 * spine_dir

    # Head: between neck and nose (approximate skull base)
    head_base = neck + 0.4 * (nose - neck)
    head_top  = neck + 1.2 * (nose - neck)

    # Shoulders: from spine2 toward acromion
    left_shoulder_pos  = _mid(spine2, la_kpts)
    right_shoulder_pos = _mid(spine2, ra_kpts)

    # Foot/toe landmarks
    lbt  = _pt(kpts, "left_big_toe")
    lst  = _pt(kpts, "left_small_toe")
    rbt  = _pt(kpts, "right_big_toe")
    rst  = _pt(kpts, "right_small_toe")
    l_toe_base = _mid(lbt, lst)
    r_toe_base = _mid(rbt, rst)
    l_toe_end  = l_toe_base + (l_toe_base - la) * 0.3
    r_toe_end  = r_toe_base + (r_toe_base - ra) * 0.3

    def hand_bones(side: str, wrist_pos: np.ndarray) -> Dict[str, np.ndarray]:
        cap = side[0].upper() + side[1:]  # "Left" or "Right"
        out: Dict[str, np.ndarray] = {f"{cap}Hand": wrist_pos}
        for fname, mname in [
            ("thumb",  "Thumb"),
            ("index",  "Index"),
            ("middle", "Middle"),
            ("ring",   "Ring"),
            ("pinky",  "Pinky"),
        ]:
            # MHR dict uses "index" for index finger (not "forefinger")
            fname_key = fname

            if fname == "thumb":
                mcp = _pt(kpts, f"{side}_thumb_3")
                pip = _pt(kpts, f"{side}_thumb_2")
                dip = _pt(kpts, f"{side}_thumb_1")
                tip = _pt(kpts, f"{side}_thumb_tip")
            else:
                try:
                    mcp = _pt(kpts, f"{side}_{fname_key}_3")
                    pip = _pt(kpts, f"{side}_{fname_key}_2")
                    dip = _pt(kpts, f"{side}_{fname_key}_1")
                    tip = _pt(kpts, f"{side}_{fname_key}_tip")
                except KeyError:
                    # Fallback: interpolate from wrist
                    mcp = wrist_pos
                    pip = mcp
                    dip = mcp
                    tip = mcp

            out[f"{cap}Hand{mname}1"] = mcp
            out[f"{cap}Hand{mname}2"] = pip
            out[f"{cap}Hand{mname}3"] = dip
            out[f"{cap}Hand{mname}4"] = tip

        return out

    positions: Dict[str, np.ndarray] = {
        # Torso
        "Hips":         hips,
        "Spine":        spine,
        "Spine1":       spine1,
        "Spine2":       spine2,
        "Neck":         neck,
        "Head":         head_base,
        "HeadTop_End":  head_top,
        # Left arm
        "LeftShoulder":  left_shoulder_pos,
        "LeftArm":       ls,
        "LeftForeArm":   le,
        "LeftHand":      lw,
        # Right arm
        "RightShoulder": right_shoulder_pos,
        "RightArm":      rs,
        "RightForeArm":  re,
        "RightHand":     rw,
        # Left leg
        "LeftUpLeg":    lh,
        "LeftLeg":      lk,
        "LeftFoot":     la,
        "LeftToeBase":  l_toe_base,
        "LeftToe_End":  l_toe_end,
        # Right leg
        "RightUpLeg":   rh,
        "RightLeg":     rk,
        "RightFoot":    ra,
        "RightToeBase": r_toe_base,
        "RightToe_End": r_toe_end,
    }

    # Finger bones (hand bones include wrist, so drop duplicate)
    for side in ("left", "right"):
        wrist = lw if side == "left" else rw
        hand = hand_bones(side, wrist)
        # hand already includes "{Left|Right}Hand" at wrist, skip it
        del hand[("Left" if side == "left" else "Right") + "Hand"]
        positions.update(hand)

    return positions


def mhr_keypoints_to_numpy(kpts_data) -> np.ndarray:
    """
    Convert keypoints from JSON (list of lists) or tensor to (70, 3) numpy array.
    Handles SAM 3D Body's (N, 3) output where N >= 70.
    """
    import numpy as np
    arr = np.array(kpts_data, dtype=np.float32)
    if arr.ndim == 1:
        arr = arr.reshape(-1, 3)
    return arr[:70]
