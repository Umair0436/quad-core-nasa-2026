# LUNA-01 · Quad Core

A space adventure prototype for kids ages 7–12, created for the [2026 Build a Junior Astronaut Mission Trainer challenge](https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/).

## Current game

1. Choose one of four child astronauts, each with a different suit color.
2. Follow Mission Control’s emergency call to its station.
3. Complete the station’s task to unlock the next mission.

   - Solar Array: clear the solar panels, then choose between 6 kW for oxygen or 2 kW while keeping the grow lights on. Compare the crew’s oxygen after each turn.
   - Greenhouse: water the crop, balance grow lights with life support, and harvest food and move it into storage.
   - Storm Shelter: decide what to power before the storm hits, protect the crew, and radio Earth for a reply.

Walking uses suit oxygen, water, food, and power. Refill at Habitat or finish a mission to top up. Completing the three missions unlocks Horizon Base. Progress is saved per astronaut in the browser session.

After the three missions, open **Base systems** for free practice. Walk to the Solar Array to clean panels, or to the Greenhouse to plant, irrigate, harvest and store crops.

Use WASD, arrow keys, touch controls, or the mission buttons to walk. Press **E** near a location to interact. The camera starts behind the astronaut and keeps its angle as you walk. Drag or use **Q** and **R** to rotate it. Press **C** to center the view behind your astronaut. The illustrated outpost is available when WebGL is unavailable.

## Run the full game

Requires Ruby 3.4.x, Bundler, Python 3.10+, and Node.js 20.19+ or 22.12+ with npm.

```bash
cd backend
bundle install
cd ../frontend
npm ci
cd ..
./bin/dev
```

Open http://localhost:5174. Vite proxies the Rails API on port 3100 and the Python simulator on port 3101. Ctrl+C stops all three services. No database or NASA API key is required.

To start the services separately, run each command in its own terminal:

```bash
cd backend
bin/rails server -b 127.0.0.1 -p 3100
```

```bash
python3 frontend/api/base-simulation.py
```

```bash
cd frontend
npm run dev
```

The research missions run in the browser. The Base systems panel calls the Python API. For Vercel projects rooted at `frontend`, enable **Include source files outside of the Root Directory in the Build Step** so the install command can stage the unchanged `ml/functions.py` model. Rails and the Vercel Ruby endpoints serve the earlier decision API. Start mission opens the outpost in the same app at the direct `/outpost/nova` page URL. Existing `/#briefing/nova` and `/#outpost/nova` links also work (also `leo`, `maya`, and `kai`).

## Verify

```bash
cd frontend
npm run build
npm run test:navigation
npm run test:movement
```

```bash
cd backend
bin/rails test
```

The Rails tests cover all eight decision paths, resource bounds, mission completion, invalid actions, signed tokens, and API rules metadata. Frontend production files are written to `frontend/dist/`.

## Source layout

- `frontend/src/App.tsx`: astronaut selection and page navigation.
- `frontend/src/navigation.ts`: direct-path and legacy hash route parsing.
- `frontend/src/MissionBriefing.tsx`: personalized mission briefing.
- `frontend/src/MoonOutpost.tsx`: research mission UI, pickup and lab submission.
- `frontend/src/researchMission.ts`: supplies, research notes, and upgrades.
- `frontend/src/components/ThirdPersonOutpost.tsx`: walking controls, camera follow, and interaction.
- `frontend/src/components/Astronaut3D.tsx`: articulated astronaut models in the 3D outpost.
- `frontend/src/components/MoonEnvironment3D.tsx`: buildings, lunar terrain, stars, and Earth.
- `frontend/src/components/moonWorld.ts`: collisions and guided walking paths.
- `frontend/src/launch.css`, `briefing.css`, `outpost.css`, and `fullscreen-game.css`: page and game overlay styles.
- `frontend/public/images/`: generated character, background, and illustrated map assets.
- `frontend/src/MissionGame.tsx`: retained earlier screen, not connected to the active flow.
- `backend/`: Rails API and simplified simulation.
- `docs/API.md`: API contract, simulation assumptions, and deployment notes.
- `docs/ARTWORK.md`: artwork generation prompts.

## Science status

Supply meters use game points. The in-game science panel links to NASA background on Moon ice, growing plants in space, and solar storm shielding.

The Storm Shelter drill uses the [28 October 2021 solar particle event observed by NASA’s Lunar Reconnaissance Orbiter](https://www.esa.int/articles/giant-solar-eruption-felt-on-earth-moon-and-mars) as its scenario. The event timing and radiation exposure points are training mechanics. The [direct Earth–Moon signal delay](https://ntrs.nasa.gov/api/citations/20240007214/downloads/NDE%20Needs%20to%20Enable%20Deep%20Space%20Exploration.pdf) sets the time to receive a radio reply.
