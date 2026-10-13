# Speed Kart Escape — Client

Browser client for **Speed Kart Escape** on the Bloxity platform: a three.js 3D world with a React HUD, built with Vite.
This version recreates the game's **starting place** from the reference video.

## What's in the starting place

| Area | Contents |
| --- | --- |
| Centre | Spawn tile with the navy burst emblem |
| North | Corridor to the **Stage 1** gate, with the travelling-merchant timer ("Arrives in / Here for") on top |
| North-west | "Purchase Wins And Coins!" sign, **Merchant** stall ("Buy Potions") with a glowing pad, yellow pad, and video screen |
| North-east | "Be the best kart pilot !" sign and the **World 2** arch (requires 5 rebirths) |
| East | **SPEED / WINS / REBIRTHS** global leaderboards on a raised platform |
| South | Treadmill row (x10, x5, x1, x1, x25, x100) under "TREADMILLS", "AFK Farm!" and "With treadmills you can gain more and more speed." |
| South-west | **REWARDS** chest ("Collect Free Rewards") |
| All around | Studded grass, blocky trees, pink pads, stepped blue walls, sky with clouds |

The HUD matches the reference: trophy and coin counters, the Rebirth / Quests / Trails / Worlds / Karts / Boosts buttons, the Playtime reward, Custom Speed, x2 Wins / x2 Speed, `Speed:` with the level bar, the +100K / +1M / +10M buttons, and the bottom-left bonus icons.
Fonts are **Fredoka One** and **Montserrat**.

The player is the **Bloxity base character** (`player.glb` from the Bloxity CDN) with their equipped skin and accessories, seated in a kart.

## Stages

Six stages behind the Stage 1 gate, rebuilt from the reference recordings:

| Stage | Look | Obstacles | Wins at the end |
|---|---|---|---|
| 1 | Navy road between grass | Swinging logs | +1 |
| 2 | Winding road | More, faster logs | +2 |
| 3 | Grass islands | Logs plus sliding logs | +8 |
| 4 | Brick desert | Red spike fields with one gap | +20 |
| 5 | Lava | Only the raised brick paths are safe | +50 |
| 6 | Blue corridor | Sliding red walls and cyan orbs | +100 |

Each stage ends at a gate with three things in front of it:

- **Skip Stage pad** (purple): skips the next stage for Gems.
- **+Wins / Return pad** (yellow): takes the reward and goes back to the spawn.
- **Coin safe:** 250 coins every 10 minutes.

Crashing into an obstacle opens **Teleport Back?**, a 5-second countdown with two options. Either way you get a short shield afterwards.

- **Buy for 9 Gems:** carry on from where you crashed.
- **Respawn Now:** go back to the start of the stage right away.

Global **2x COINS** and **2x SPEED** events run on a 20-minute cycle and show a timer at the top of the screen. Kart speed and the Custom Speed maximum grow with your level (Level 10 = 30).

## Run locally

```bash
cp .env.example .env
npm install
npm run dev          # http://localhost:5173
```

Start the server too (`../speed-kart-escape-server`, `npm run dev`).
If the server isn't reachable, the client switches to **offline mode**: the same rules run locally and progress is saved in `localStorage`.

## Controls

Controls are **camera-relative** (like Roblox): the kart drives toward the direction you push, measured from where the camera is looking.

- **WASD / arrow keys**: W drives away from the camera, A/D head left or right on screen, S turns around toward the camera.
- **Mouse or laptop touchpad**: drag anywhere to turn the camera. Scroll, two-finger scroll, or pinch to zoom.
- **Phone / tablet**: put your left thumb anywhere on the left side and a thumbstick appears under it. Drag on the right side to turn the camera, and pinch with two fingers to zoom.
- To train AFK, park on a treadmill belt and let go.

## Bloxity integration

The SDK is loaded in `index.html` (`https://sdk.bloxity.io/v1/legion-sdk.min.js`). All calls go through `src/bloxity/legion.js`, and every call is guarded so the game still runs without the SDK.

| Feature | SDK calls |
| --- | --- |
| Init | `Legion.SDK.init({ gameSlug })` |
| Login | `auth.onUserChanged`, `getUser` / `getGuest`, `authenticateWithServer('<server>/api/legion-auth')` |
| Loading screen | `game.loadingStep(...)`, `game.loadingEnd()`, `gameplayStart` / `gameplayEnd` |
| Avatar | `avatar.getEquipped`, `getProportions`, `getSkinTextureUrl`, `onAvatarChanged`, plus CDN meshes (`player.glb`, hats and accessories) |
| Multiplayer | `net.resolveEndpoint(slug)` when `VITE_BLOXITY_HOSTED=true`, and `game.updateRoom(roomId)` |
| Gems | `gems.requestPurchase(sku)` for +100K / +1M / +10M Speed, x2 Wins, x2 Speed, and the Mythical Treadmill |
| Portal events | `player.onEvent` (`respawn_request`, `pointer_lock_changed`) |

> The Gem prices shown in the HUD (`displayPrice` in `src/shared/gameData.js`) are labels only. The real prices come from your Bloxity IAP catalog, so keep the two in sync.

## Environment

| Variable | Purpose |
| --- | --- |
| `VITE_GAME_SLUG` | Bloxity game slug (default `speed-kart-escape`) |
| `VITE_SERVER_HTTP` | Game server HTTP base, used for the login handshake |
| `VITE_SERVER_WS` | Game server WebSocket, used when not hosted on Bloxity |
| `VITE_BLOXITY_HOSTED` | `true` to resolve the socket through `net.resolveEndpoint` |

## Structure

```
src/
  bloxity/        SDK wrapper + avatar CDN helpers
  game/
    Game.js       renderer, loop, zones, remote players
    scenes/       StartingPlace.js — places every landmark
    entities/     Arena, Sky, Scenery, Billboard, Treadmill, Leaderboard, RewardChest,
                  MerchantStall, WorldGate, StageGate, VideoScreen, Kart, BloxityAvatar, Racer, Trail
    systems/      KartController, CameraRig, Collision, Input
    util/         stud textures, canvas text
    audio/        procedural sound effects
  net/            Session.js — online (Colyseus) and offline sessions
  shared/         gameData.js — rules shared with the server (keep in sync)
  ui/             Hud.jsx, icons, panels
```

`src/shared/gameData.js` must be identical to `../speed-kart-escape-server/src/shared/gameData.js`.
