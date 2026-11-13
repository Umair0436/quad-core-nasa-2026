# LUNA-01 · Quad Core

A space adventure prototype for kids ages 7–12, created for the NASA Space Apps Challenge.

## Current game

1. Choose one of four child astronauts, each with a different suit color.
2. Read a personalized mission briefing and learn what your crew needs.
3. Walk through a 3D Moon outpost as your selected astronaut, make three daily decisions, and see their consequences.

Gameplay fills the browser window, with a Fullscreen button for the whole display. Move with WASD, the arrow keys, or the on-screen controls; press E near a building to interact. Clicking a building guides your astronaut there. The camera follows from behind. Each character keeps their own suit color, skin tone, and hairstyle in the 3D scene. The mission panel opens over the world when needed. An illustrated outpost is available if WebGL is unavailable. The Rails API calculates oxygen, power, food, and radiation game points. Each choice shows a learning step before the next day. The game includes success and failure reports, replay, and a choice log. Progress is saved in browser session storage for the selected astronaut and can be resumed on refresh. A saved mission older than 90 minutes starts fresh; Rails tokens expire after two hours.

## Run the full game

Requires Ruby 3.4.x, Bundler, and Node.js 20.19+ or 22.12+ with npm.

```bash
cd backend
bundle install
cd ../frontend
npm ci
cd ..
./bin/dev
```

Open http://localhost:5174. Rails listens on port 3100; Vite proxies `/api` requests. Ctrl+C stops both services. No database or NASA API key is required.

To start the services separately:

```bash
cd backend
bin/rails server -b 127.0.0.1 -p 3100
```

```bash
cd frontend
npm run dev
```

The selection and briefing pages work without Rails; gameplay needs the API. Start mission opens the outpost in the same app at the direct `/outpost/nova` page URL. Existing `/#briefing/nova` and `/#outpost/nova` links also work (also `leo`, `maya`, and `kai`). Use the mission report's Play again button to reset the current astronaut's mission.

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
- `frontend/src/MoonOutpost.tsx`: active gameplay page, learning steps, progress, and report.
- `frontend/src/components/ThirdPersonOutpost.tsx`: walking controls, camera follow, and interaction.
- `frontend/src/components/Astronaut3D.tsx`: animated child astronaut meshes and character appearances.
- `frontend/src/components/MoonEnvironment3D.tsx`: buildings, lunar terrain, stars, and Earth.
- `frontend/src/components/moonWorld.ts`: collisions and guided walking paths.
- `frontend/src/launch.css`, `briefing.css`, `outpost.css`, and `fullscreen-game.css`: page and game overlay styles.
- `frontend/public/images/`: generated character, background, and illustrated map assets.
- `frontend/src/MissionGame.tsx`: retained earlier screen, not connected to the active flow.
- `backend/`: Rails API and simplified simulation.
- `docs/API.md`: API contract, simulation assumptions, and deployment notes.
- `docs/ARTWORK.md`: artwork generation prompts.

## Science status

No NASA dataset is integrated yet. All simulation values are invented game points; the solar alert is simulated. These are not physical measurements or predictions of radiation dose. Real dataset integration and a scientific review remain planned. The in-game science panel states these limits.
