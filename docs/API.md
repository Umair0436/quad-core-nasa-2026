# LUNA-01 API

## Current app scope

The active flow is astronaut selection → briefing → Moon outpost. The outpost starts a mission and sends choices to these Rails endpoints. The first two pages do not need the API.

The frontend uses Vite's `/api` proxy in development. Rails listens on port 3100; Vite listens on 5174. There is no cross-origin browser request in this setup.

## Start

`POST /api/missions` with `{}` returns `state`, `decision`, `feedback`, `reason`, `rules`, and `token`. The `rules` object contains `daily_costs`, `radiation_limit`, and `mission_days`; the frontend uses these values to explain upkeep and safety limits.

## Choose

`POST /api/missions/decision` with `{ "token": "<returned token>", "action_id": "recycle" }` returns the same response shape for the next turn. Send the newly returned token on the next request. Rails validates the signed state and accepts only actions offered on the current day. Tokens expire in two hours. Missing fields return 400; invalid/expired tokens or unavailable actions return 422.

The game is deliberately stateless: replaying an older signed token is possible. There are no accounts, persistent sessions, or competitive scores. Add durable server-side sessions before introducing a leaderboard or multiplayer.

## Browser progress

The outpost saves the returned mission and choice log per astronaut in session storage. Refresh resumes the next available day, or the report for a finished mission. A saved mission older than 90 minutes is ignored; server-signed tokens expire after two hours. The learning step is local UI state, so refreshing during feedback resumes at the next day. Play again starts a new mission and clears that astronaut’s choice log. No account or cross-device saving is provided.

## Game rules

Mission content lives in `backend/config/missions.json`. Each action applies its stated effects, followed by daily upkeep: 14 oxygen, 10 power, 12 food. Resources are clamped to 0–100. Zero oxygen, power, or food loses; radiation of 80 or more loses. Failure is checked before final-day success. Restart creates a new initial state.

All numbers are invented game points. The event is simulated, not an archived NASA record or live alert. The crop is already grown at mission start. The Python teammate can propose JSON rules and analyze all eight paths without a separate Python service.

## Next science milestone

Have the researcher check every explanation and select an actual archived NASA solar-particle event. Keep its date, original fields, source URL, and a clear explanation of how it informs the scenario. Do not claim a direct radiation-dose conversion from a DONKI event or present static data as live.

## Deployment

This starter runs locally. A production deployment needs a Rails host, a stable `SECRET_KEY_BASE`, HTTPS, and a reverse proxy for `/api` (or an explicitly configured API origin and CORS). `vite preview` alone cannot proxy requests to Rails with this development-only configuration.
