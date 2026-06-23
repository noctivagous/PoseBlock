
DUAL CONDITION
- PoseBlock will be a git submodule
of a project called Videogen.

- Plane for refactoring the PoseBlock code base 
to be a module of VideoGen
that is automatically loaded by VideoGen
but is also an app that is self-contained
when it is worked on in this repo.
-- Everything that Videogen does to frame
with the static PNG mannequins will have
to be migrated to PoseBlock.
-- PoseBlock isn't finished and will
be worked on in the future, but now
is the time to migrate it into Videogen
so that it can be worked on separately
for Videogen
-- PoseBlock will also standalone in
its own git repo so that it can be
used separately.


FUTURE FEATURES

1 -- User should be able to upload
an image with a pose and PoseBlock poses the selected humanoid model and
saves it to the database.

2 -- automatic vanishing point 
detection. 

3 -- Make SAM 3D Body script for
converting images to rigged
3D models, converting the .FBX to .GLB (included), converting the MHR
rigging to Mixamo for our project.