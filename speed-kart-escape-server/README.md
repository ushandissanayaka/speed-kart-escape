# Speed Kart Escape — Server

Authoritative multiplayer server for **Speed Kart Escape**, built on Node.js, Express and Colyseus 0.15.

## Run

```bash
cp .env.example .env
npm install
npm run dev        # listens on :2567
```

## What it does

- **Room `starting_place`** (`src/rooms/StartingPlaceRoom.js`)
  - Syncs each player's kart position, kart, trail and avatar to everyone in the room.
  - Turns movement reports into **Speed**. Distance is capped by the kart's top velocity, and teleports award nothing.
  - Runs treadmill training every second and checks each treadmill's lock (wins or pass).
  - Applies player actions through the shared reducers: rebirth, chest, playtime, quests, karts, trails, potions, custom speed.
  - Broadcasts the top 9 for Speed, Wins and Rebirths every 15 seconds.
- **Profiles** (`src/game/profiles.js`)
  - Logged-in Bloxity players are saved to `data/profiles.json` (debounced, atomic write).
  - Guest progress lasts only for the session.
- **Login** (`src/auth/legionAuth.js`): `POST /api/legion-auth` receives `{ token, user }` from `Legion.SDK.auth.authenticateWithServer`.
  1. The JWT `exp` is checked.
  2. The token is verified by calling the Bloxity API with it as a Bearer token (`LEGION_API_URL` + `LEGION_VERIFY_PATH`).
  3. The subject is matched against the reported user.
  4. The server returns its own HMAC session token, which the client passes when joining the room.
- **Gems webhook** (`src/webhooks/legionWebhook.js`): `POST /api/webhook/legion`
  - Checks `x-legion-webhook-secret`.
  - De-duplicates by `transactionId`, grants the SKU, and saves immediately.
  - Pushes the new profile to the player if they are online.
  - Returns 2xx on success and 4xx for unknown SKUs or users, which makes Bloxity refund.
- **Stats reporting** (`src/game/statsReporter.js`)
  - Every 60 seconds, and once more on shutdown, POSTs Speed, Wins, Rebirths and Level for online logged-in players to `https://api.bloxity.io/v1/games/{BLOXITY_GAME_ID}/stats`.
  - Disabled unless `BLOXITY_GAME_ID` and `BLOXITY_REPORT_TOKEN` are set.

## HTTP endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness check |
| POST | `/api/legion-auth` | Bloxity login handshake |
| POST | `/api/webhook/legion` | Gems purchase fulfillment |
| GET | `/api/leaderboards` | Current top 9 per stat |

## Stages

The six stages run north behind the Stage 1 gate (`STAGES` in `src/shared/gameData.js`). The room tracks each player's run:

- **Entering stages:** a stage counts as reached only when the kart drives into it from the previous one.
- **Teleports:** the only legal teleports are to the spawn and to the start of a stage already reached. Any other jump cancels the run.
- **Wins pad:** pays the wins for that stage only if the stage was reached and the minimum drive time has passed. It then sends the player back to the spawn.
- **Coins and coin safes:** checked against the player's position, with a cooldown per player.

## Gem SKUs

`speed_100k`, `speed_1m`, `speed_10m`, `pass_x2_wins`, `pass_x2_speed`, `mythical_treadmill`, `coins_500`. Also `skip_stage` (29), `revive` (9), `super_treadmill`, the coin and win packs, `boost_*` and `trail_*`. Create these in your Bloxity IAP catalog and point the game's webhook URL at `/api/webhook/legion`.

## Environment

See `.env.example`: `PORT`, `CORS_ORIGINS`, `SESSION_SECRET`, `LEGION_API_URL`, `LEGION_VERIFY_PATH`, `LEGION_WEBHOOK_SECRET`, `BLOXITY_GAME_ID`, `BLOXITY_REPORT_TOKEN`, `DATA_DIR`.

`src/shared/gameData.js` must be identical to the client's copy.
