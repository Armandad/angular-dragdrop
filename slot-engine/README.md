# Slot Engine

Production-grade EGT-style slot game engine. Supports classic line games (Shining Crown, 20 Super Hot, Burning Hot) with data-driven game definitions — zero code changes to add new games.

## Architecture

```
slot-engine/
├── packages/
│   ├── math-engine/      Pure TS, zero deps — RNG, reels, evaluator, features, simulation
│   ├── shared-types/     TypeScript DTOs and interfaces
│   ├── crypto-utils/     HMAC-SHA256 provably fair seed chain
│   └── game-defs/        JSON game definitions (config, paytable, paylines, reel strips)
├── apps/
│   ├── game-server/      HTTP API server (spin, gamble, collect, aggregator, audit)
│   ├── game-client/      PixiJS 8 WebGL frontend
│   └── rtp-simulator/    Monte Carlo CLI tool for math verification
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Math Engine | Pure TypeScript (zero deps, auditable for GLI/BMM) |
| Backend | Node.js HTTP server (NestJS-ready) |
| Frontend | PixiJS 8 + Vite (WebGL rendering) |
| Audio | Web Audio API (Howler.js in production) |
| Monorepo | Turborepo + npm workspaces |
| RNG | `crypto.randomInt()` (CSPRNG, certification-ready) |
| Database | PostgreSQL (audit) + Redis (sessions) |

## Quick Start

```bash
cd slot-engine
npm install
npm run build
npm run dev:server    # Start game server on port 3000
npm run dev:client    # Start client dev server on port 5173
```

## Docker

```bash
docker-compose up -d
# Server: http://localhost:3000
# Client: http://localhost:5173
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/games` | GET | List available games |
| `/api/session` | POST | Create player session |
| `/api/spin` | POST | Execute a spin |
| `/api/gamble` | POST | Double-up gamble round |
| `/api/collect` | POST | Collect winnings |
| `/api/session/:id` | GET | Get session state |
| `/api/audit/stats` | GET | RTP statistics |
| `/aggregator/*` | POST | Aggregator wallet callbacks |

## RTP Simulator

```bash
npm run simulate -- --game shining-crown --rtp 96 --spins 10000000

# Options:
#   --game <id>       Game to simulate (default: shining-crown)
#   --rtp <number>    RTP profile (default: 96)
#   --spins <number>  Total spins (default: 1,000,000)
#   --workers <n>     Parallel worker threads
#   --seed <number>   Reproducible seed
```

## Adding a New Game

1. Create JSON files in `packages/game-defs/games/your-game/`:
   - `config.json` — game configuration
   - `paytable.json` — symbol definitions and payouts
   - `paylines.json` — payline definitions
   - `reels/base-96.json` — reel strips per RTP target
2. Add sprite assets to `apps/game-client/public/assets/your-game/`
3. Run RTP simulator to verify math: `npm run simulate -- --game your-game`
4. Deploy — server auto-discovers new game definitions

## Game State Machine

```
IDLE → SPINNING → EVALUATING → AWAITING_COLLECT
                                 ├→ GAMBLE (up to 5x double-up)
                                 ├→ FREE_SPINS (loops back)
                                 └→ COLLECTED → IDLE
```

## Aggregator Adapters

Built-in adapters for casino platform integration:

- **Mock** — Local development
- **SoftSwiss** — SoftSwiss Game Aggregation API
- **GCI** — Gaming Content Interface

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space/Enter | Spin |
| R | Gamble Red |
| B | Gamble Black |
| C | Collect |
| A | Auto-play |
| I | Paytable Info |
| H | History |
| M | Mute |
| F | Fullscreen |

## Testing

```bash
npm run test
```

## License

Proprietary
