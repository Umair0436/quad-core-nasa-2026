# LUNA-01 · Quad Core

LUNA-01 is a browser game where children ages 7–12 run a Moon outpost. Players explore in 3D, respond to emergencies, and see how their choices affect crew oxygen, battery power, food, and radiation exposure. Team Quad Core built it for the [2026 NASA Space Apps Junior Astronaut Mission Trainer challenge](https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/).

[Play LUNA-01](https://frontend-alpha-ashen-33.vercel.app/)

## How to play

1. Pick Nova, Leo, Maya, or Kai and select **Start mission**.
2. Read the short briefing at the top of the outpost. It tells you which station to find and what to do there.
3. Walk to the highlighted station and choose **Open**, or click the building to walk there. The mission opens at the station.
4. Complete the task and collect your badge. Select **Next mission** to continue.

Use WASD, the arrow keys, or the touch controls to walk. Press **E** to interact with a nearby station. Drag or use **Q** and **R** to rotate the camera, and press **C** to recenter it. If WebGL is unavailable, select station names on the illustrated map.

## Missions and rewards

- **Solar Array — Oxygen Hero.** Clean the panels and restore crew oxygen to 37%. Choose 6 kW for the oxygen generator, or choose 2 kW to keep the grow lights on while the crew uses more oxygen than it can replace. The oxygen bar updates after each turn.
- **Greenhouse — Moon Gardener.** Water the seedling, turn on the grow lights, pick the crop, and put it in the food box. One button guides the player through each step.
- **Storm Shelter — Storm Guardian.** Choose where to send power before a solar storm hits. Power the shelter to protect the crew, then radio Earth and wait for the reply.

Each mission ends with a celebration. Earned badges appear in **Menu → My badges**. Finish all three missions to unlock Horizon Base and free practice through **Base systems**. Solar panel cleaning takes place at the Solar Array. Planting, watering, harvesting, and storing crops take place at the Greenhouse.

The briefing shows base oxygen and battery readings from the simulator. They update while you walk and after each mission action.

## How it works

React, TypeScript, and Three.js power the interface and 3D outpost. Player actions are sent to `POST /api/base-simulation`. A Python adapter calls Azan Nadeem’s lunar model in `ml/functions.py` and sends the updated readings back to the game. Vercel hosts the game and the API.

The browser stores progress and the choices made by each astronaut in session storage. Refreshing in the same tab restores that session. The game requires no account, database, or NASA API key.

## Run locally

Install Ruby 3.4.x, Bundler, Python 3.10+, and Node.js 20.19+ or 22.12+ with npm. From the repository root:

```bash
cd backend
bundle install
cd ../frontend
npm ci
cd ..
./bin/dev
```

Open [http://localhost:5174](http://localhost:5174). Vite runs on port 5174, the Python simulator on 3101, and the Rails service for the earlier decision API on 3100. Press **Ctrl+C** to stop all three.

To deploy with Vercel, set the project root to `frontend` and enable **Include source files outside of the Root Directory in the Build Step**. The install command stages `ml/functions.py` for the Python function.

## Verify

```bash
cd frontend
npm run build
npm run test:navigation
npm run test:movement
```

The production frontend is written to `frontend/dist/`. Run `bin/rails test` from `backend/` to check the earlier Ruby decision API.

## Source layout

- [MoonOutpost.tsx](frontend/src/MoonOutpost.tsx) shows the active briefing, station panels, and badge celebrations.
- [BaseSystems.tsx](frontend/src/BaseSystems.tsx) presents mission choices and simulator feedback.
- [researchMission.ts](frontend/src/researchMission.ts) defines missions, badges, supplies, and saved progress.
- [components](frontend/src/components) contains the 3D scene, astronaut, and movement.
- [base-simulation.py](frontend/api/base-simulation.py) and [base_simulation.py](frontend/lib/base_simulation.py) connect the game to [the lunar model](ml/functions.py).
- [Artwork notes](docs/ARTWORK.md) describe how the game artwork was made.

## Science sources

The Storm Shelter scenario draws on the [28 October 2021 solar particle event observed by NASA’s Lunar Reconnaissance Orbiter](https://www.esa.int/articles/giant-solar-eruption-felt-on-earth-moon-and-mars). The simulated radio reply takes about 2.6 seconds, based on [NASA’s Earth–Moon signal travel time](https://ntrs.nasa.gov/api/citations/20240007214/downloads/NDE%20Needs%20to%20Enable%20Deep%20Space%20Exploration.pdf). Oxygen, battery, crop growth, and radiation thresholds are simplified for learning. The radiation meter uses game points.
