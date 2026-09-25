# College Carpool

A mobile-first carpooling app for **verified students of a single college**. Any
student can act as driver or passenger: post rides, discover and request rides,
chat with confirmed participants, share a live ride with a parent/friend, trigger
an SOS workflow, earn points, and rate each other.

See [docs/MVP_REQUIREMENTS.md](docs/MVP_REQUIREMENTS.md) for the full spec.

## Architecture

```
                    React Native (Expo)
                         │
              ┌──────────┴──────────┐
           REST API              WebSocket
              │                     │
      Django REST Framework   Django Channels
              └──────────┬──────────┘
                       Redis
                         │
                  PostgreSQL + PostGIS
```

- **Backend** — Django + DRF + Channels, domain-oriented apps, business logic in
  service modules. JWT auth (access + refresh). PostGIS for geodata, Redis for the
  channel layer and live-location state.
- **Mobile** — Expo + TypeScript (strict), expo-router, TanStack Query + Zustand,
  react-native-maps. Design system derived from the reference screenshot
  (primary `#5A5CE6`, Plus Jakarta Sans).

## Tech stack

| Layer | Tech |
|---|---|
| Mobile | React Native, Expo, TypeScript, expo-router, TanStack Query, Zustand, react-native-maps |
| API | Django 5, Django REST Framework, SimpleJWT |
| Realtime | Django Channels, channels-redis, Daphne |
| Data | PostgreSQL + PostGIS, Redis |

## Repository layout

```
carpool/
├── backend/        Django project (config + domain apps)
├── mobile/         Expo app (added in Phase 1 mobile slice)
├── docs/           MVP_REQUIREMENTS.md
├── docker-compose.yml
└── .env.example
```

Backend domain apps: `accounts` (auth + college verification), then `vehicles`,
`rides`, `chat`, `tracking`, `safety`, `rewards`, `notifications`, `reports` as
their phases land. `common` holds shared base models, permissions, pagination,
and the API error envelope.

## Local setup

### Prerequisites
- Docker + Docker Compose (Postgres+PostGIS and Redis run as containers)
- (For mobile) Node 20+, and the Expo Go app or a simulator

### 1. Environment
```bash
cp .env.example .env
# edit .env as needed; the defaults work with docker-compose out of the box
```

### 2. Run the backend stack
```bash
docker compose up --build
```
This starts PostGIS, Redis, and the Django/Daphne backend on
http://localhost:8000. The backend container runs migrations on start.

First time (or after adding a domain app), generate migrations:
```bash
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate
```

### 3. Seed demo data
```bash
docker compose exec backend python manage.py seed_dev
```
Creates the college registry plus two ready verified accounts:

| Role | Email | Password |
|---|---|---|
| Student A (driver) | `aisha@college.edu` | `Passw0rd!123` |
| Student B (passenger) | `rahul@college.edu` | `Passw0rd!123` |

### 4. Admin
```bash
docker compose exec backend python manage.py createsuperuser
```
Django Admin (student management, reports, SOS review) at
http://localhost:8000/admin/.

## API — authentication (Phase 1)

Base: `/api/auth/`

| Method | Path | Purpose |
|---|---|---|
| POST | `register/` | Register against the college registry; sends an email OTP |
| POST | `verify/` | Verify the OTP, activate the account, return tokens |
| POST | `resend/` | Re-issue an OTP for an unverified account |
| POST | `login/` | Obtain access + refresh tokens (email + password) |
| POST | `refresh/` | Exchange a refresh token for a new access token |
| POST | `logout/` | Blacklist a refresh token |
| GET | `me/` | Current user + profile (auth required) |

Errors use a uniform envelope: `{"error": {"code", "message", "detail?"}}`.

Without SMTP configured (`EMAIL_HOST` blank), OTP emails print to the backend
console — copy the code from the `docker compose` logs during development.

## API — core carpool (Phase 2)

All endpoints require a verified student (`Authorization: Bearer <access>`).

**Profile** — `/api/profile/`
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/profile/` | Own profile |
| PATCH | `/api/profile/` | Edit `phone_number` / `profile_image` (identity fields are locked) |

**Vehicles** — `/api/vehicles/`
| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/vehicles/` | List / add own vehicles |
| GET/PATCH/DELETE | `/api/vehicles/{id}/` | Retrieve / edit / remove |
| POST | `/api/vehicles/{id}/deactivate/` · `/activate/` | Toggle availability |

**Rides** — `/api/rides/`
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/rides/` | Create a ride (§12 validation) |
| GET | `/api/rides/` | Rides I'm offering (as driver) |
| GET | `/api/rides/search/` | Search: `origin_lat,origin_lng,destination_lat,destination_lng,radius_m,date,vehicle_type,min_seats` — PostGIS proximity, nearest first |
| GET | `/api/rides/{id}/` | Ride details (§14) |
| GET | `/api/rides/history/` | `{upcoming, active, completed, cancelled}` across both roles |
| POST | `/api/rides/{id}/start/` · `/complete/` · `/cancel/` | Driver-only lifecycle transitions |
| POST | `/api/rides/{id}/request_join/` | Request to join (alias) |

**Ride requests** — `/api/ride-requests/`
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/ride-requests/` | `{ride_id}` → create a request (§16 rules) |
| GET | `/api/ride-requests/?role=incoming\|outgoing&ride=<id>` | List requests |
| POST | `/api/ride-requests/{id}/accept/` | Driver accepts → booking + atomic seat decrement |
| POST | `/api/ride-requests/{id}/reject/` · `/cancel/` | Driver rejects / rider withdraws |

**Bookings** — `/api/bookings/`
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/bookings/` | My bookings (as passenger) |
| POST | `/api/bookings/{id}/cancel/` | Cancel → seat restored, FULL ride reopens |

Seat changes (accept / cancel) lock the ride row (`select_for_update`) so the
last seat cannot be oversold under concurrent requests (§16, §39).

## Running tests

```bash
docker compose exec backend python manage.py test
```

## Running the mobile app

Added in the Phase 1 mobile slice. It will be:
```bash
cd mobile
npm install
npx expo start
```

## Development phases

1. **Foundation** *(done)* — infra, auth, college verification.
2. **Core carpool** *(done)* — profile, vehicles, rides, requests, bookings, lifecycle, history.
3. Communication — WebSocket chat, notifications.
4. Safety — emergency contacts, SOS, live location, shareable tracking.
5. Reputation — points, ratings, reports.
6. UI refinement — loading/empty/error/offline states, polish.

## Security notes

Backend is the source of truth for authorization, seat counts, points, ride
status, and verification. Auth endpoints are rate-limited; passwords use
Django's hashing; passwords and JWTs are never logged; tracking uses secure,
expiring, revocable tokens with no sensitive data in the URL.
