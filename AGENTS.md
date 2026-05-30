The following provides some info about the game we want to make. Use it as context when working on the project.

## Stack
frontend: client: Vite w/ React (typescript)
CV: MediaPipe pose (JavaScript) 
backend: Node.js w/ hono (ts)
Socket.io for websockets, also use hono websockets as well and integrate as best as possible
Use the hono client package for the frontend. DO NOT make a custom wrapper on the frontend, you must use the hono client package for types api routes.

p2.js physics, if needed
p5.js graphics library and main game logic
Mediapipe, for the body/pose tracking 
Alternatively: use ml5.js (cons: more jank/laggy, pros: less lines of code/easier setup)
Node.js using node for the server
PNPM monorepo
.gitignore
use a local sqlite database for data storage


Players
2 players:
Player 1 has 3 lives, and has to fit in the holes for an entire track (~2 minutes) to survive
Player 2 draws the holes in real time - "draws" means move a dummy outline's joints around on a laptop or iPad. There should also be an option to randomize the posing if the Saboteur doesn’t want to decide.
Points are calculated based on % fit
Overall Design
Survival run
Player 1 (athlete) starts with 3 lives and tries to survive a music track (~30 walls)
Player 2 (saboteur) "draws" the walls in real time
Role swap
Once the athlete loses all lives OR completes the track, the players swap devices
Victory
Highest score accumulates while playing as athlete wins
Game Loop
Based on an 8-count at ~120bpm
Beats 1-4:
Athlete rests Saboteur manipulates dummy joints OR selects a Sabotage card (I'll explain in a sec)
Beats 5-7:
Projector wall scales up, and the athlete scrambles to match the pose Saboteur watches and begins creating the next pose to give them more time
Beat 8
Projector takes a snapshot and calculates score Saboteur unlocks a Sabotage card

System Tracking
To eliminate tedious player calibration and ensure absolute mechanical fairness, the game bypasses tracking raw pixel distances or individual limb lengths.
The Logic: MediaPipe captures the user's raw skeletal coordinates. The game instantly calculates the rotational angles of those joint vectors (e.g., the angle formed by Shoulder ➔ Elbow ➔ Wrist).
The Puppet: These angles are passed to a displayHuman() function that applies them directly to a single, fixed-size on-screen dummy avatar.
The Result: Every player, regardless of their real-life height, weight, or proportions, controls and is displayed as the exact same character box. No calibration phase required.

Scoring
Based on how we are mapping users to a dummy, we will be measuring the % difference between the actual dummy position and the hole.
Feedback Thresholds
90% – 100% (PERFECT!):
70% – 89% (CLEAN!)
< 70% (CRASH!): Lose 1 Life

Users get points after each “wall” that they complete based on the matching difference. We give them points out of 100, with closer matches getting exponentially more points.

const match = Math.max(0, Math.min(100, matchPercent));

const t = Math.max(0, Math.min(1, (match - 70) / 30));
const k = 2; // higher = more aggressive reward near 100%

const points = Math.round(
  100 * ((Math.exp(k * t) - 1) / (Math.exp(k) - 1))
);
Power-ups
Athlete:
For the Athlete, the power ups will spawn at random corners of the screen on random rounds. In order for the player to acquire the powerup, they must make a hand grabbing motion over it. Then, their powerup will be immediately activated.
Time warp: Clock icon floats on the far edge of the projection, slows down the song and screen if they extend their hand to touch it
Shield, grants a pass on a missed hole
Saboteur:
For the saboteur, their powerups will be generated when the player gets a winning streak of, say, 3 PERFECT scores in a row. The powerups will be available in a sidebar/menu, where they can select them from there. 2 max.
Blindness: Screen goes black except for a small spotlight radius around the athlete's center, like in Luigi's mansion in Mario
Mirror mode: Mirrors the screen or idk









Flow
When we first start we can get a skeleton going – calibrate stuff for one person
When we can make silhouettes for all body types for poses, we can all start making poses and start making pose files
From there we can have one of us try to go on, or three of us at different times and see if it scales to our body types for those poses
“Move into the green zone” to ensure people are fully visible - valid position

Must Implement (MVP)
ONE player endless mode
Predefined set of poses 
BOXY-bounds for redzones
Main game logic
Timer countdowns/”rounds”
Points, lives
Website ui
Detecting % of how much of body is inside the desired hole
How do we generate the shape of the body for the hole though?
I think it would be good if we generate holes by like “carving out a certain radius” from each joint (and its connecting lines)” 
If the difficulty is harder, then less radius, easier = more radius
Joints = prioritize more important ones
Wrists = noisy, torso = more important for pose
Leaderboard
Decisions we need to make
How do we generate the shape of the body for the hole?
Can Gemini do it?
How do we scale for different body shapes?
Calibration phase?
Calculate accuracy based on the angles of the joints (because distance would vary between person to person, but angles = good)


Nice to Have
Leaderboard
Probably pretty easy implementation, since we will only store their survival time and name
A shit load of particle effects
For instance, if you do the dragon ball duo pose, then a bunch of light comes from the part where your hands connect
For instance, if a particular limb is REALLY off, then there’s a bunch of “X”s coming out of it showing you what was off
If it’s correct, you get a big fat green ✓
Customizable pose gen (like users can add their own poses, and it becomes a part of the list of poses?)


Please only implement the front-end for now; eventually we will connect the front-end to the rest of the project. Make sure to include buttons that will let you run the pose detection as a test in lieu of another person. 
We currently need: 
Pose detection with MediaPipe
Webcam initialization
Real-time skeleton tracking and rendering
Normalizing body calculations to a “universal human”
Display the universal human on screen AKA the poser
The main opening page
A video background (placeholder for now, with just a picture) (we will later 
Settings: volume adjustment
An stump/empty leaderboard pageThe actual game page
Have two debugging buttons: saboteur option and the poser option
POSER SCREEN: DISPLAY THE PLAYER (that will be posing)
SABOTEUR SCREEN: make it so the pose adjusts
If the player drags the ragdoll, then the limbs flops around randomly / wriggles
Each of the joints are adjustable, but limit angles between certain limbs, for instance, you can’t make it do a split 190 deg split.
Any pose that is sent to the POSER will be on the floor (you can’t do a split mid-air)
At least one foot touches the ground
ending score page (show accuracy, survival time, play again/swap roles)



