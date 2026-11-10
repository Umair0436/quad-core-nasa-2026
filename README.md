# LUNA-01 · Quad Core

A space adventure prototype for kids ages 7–12, created for the NASA Space Apps Challenge.

## Current version

The app currently contains the astronaut-selection opening page only:

- Four child astronauts: two girls and two boys in purple, blue, orange, and teal suits.
- A star-filled space background, Earth, and a lunar landscape.
- Mouse and keyboard player selection, with optional selection sounds.
- A disabled Start game button and a coming-soon message.

The earlier mission screen is disconnected from the app. Rails simulation code and the previous scene remain as scaffolding for later development. The opening page makes no API calls and does not need Rails to run.

## Run the opening page

Requires Node.js 20.19+ or 22.12+ and npm.

```bash
cd frontend
npm ci
npm run dev
```

Open http://localhost:5174.

## Build

```bash
cd frontend
npm run build
```

The static production files are written to `frontend/dist/`.

## Optional Rails scaffold

Requires Ruby 3.4.x and Bundler. To run both services from the project root:

```bash
cd backend
bundle install
cd ..
./bin/dev
```

Rails uses port 3100; Vite uses 5174. Ctrl+C stops both services. Backend tests can be run with `cd backend && bin/rails test`.

## Source layout

- `frontend/src/App.tsx`: active astronaut-selection page.
- `frontend/src/launch.css`: opening-page styles.
- `frontend/public/images/`: generated character and background artwork.
- `frontend/src/MissionGame.tsx`: disconnected earlier mission screen.
- `backend/`: Rails API and simplified simulation scaffold.
- `docs/API.md`: retained backend contract and simulation assumptions.
- `docs/ARTWORK.md`: artwork generation prompts.

No NASA dataset is integrated yet. All existing simulation values are simplified game points; the solar event in the inactive mission scaffold is simulated. It is not a live alert or a physical radiation-dose model.
