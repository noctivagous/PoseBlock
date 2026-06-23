
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

FEATURES THAT ARE NOT YET IN
POSEBLOCK BUT HAVE TO BE FOR IT
TO BE USED IN VIDEOGEN

[ ] - Multiple mannequins 
    [ ] - add mannequin
    [ ] - select mannequins
    one at a time or shift+click
    for selecting more than
    one.
[ ] - Positioning the scale
and translation of the model
with the convention provided by
VideoGen where it is determined
by predetermined percentage values
that relate to the height of
the aspect ratio and the top left
corner of the frame.

FUTURE FEATURES

1 -- User should be able to upload
an image with a pose and PoseBlock poses the selected humanoid model 
with Mixamo parameters and
saves the pose to the database.
-- lightweight preferred.
-- might make use of ControlNet
and then require conversion from
OpenPose to Mixamo.


2 -- [ ] - Make SAM 3D Body script for
converting images to rigged
3D models, converting the .FBX to .GLB (included), converting the MHR
rigging to Mixamo for our project.

3  -- [ ] - automatic vanishing point 
and plane detection, lightweight,
using techniques such as J-Linkage,
1D Hough (ICIS), Row-Space Clustering.


