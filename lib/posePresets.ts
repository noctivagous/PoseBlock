import { POSES, type Pose } from '../lib/poses'

export function getAllPosePresets(posePresets: Record<string, Pose>): Record<string, Pose> {
  return { ...POSES, ...posePresets }
}
