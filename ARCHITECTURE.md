# Architecture

College Carpool is a ride-sharing MVP for a single college campus: a Django/DRF
+ Channels backend, and an Expo/React Native mobile client. This document
describes how the pieces fit together — see `docs/MVP_REQUIREMENTS.md` for the
product spec and `README.md` for setup/run instructions.

## System overview

```
┌─────────────────────────┐          HTTPS/REST (JWT)          ┌──────────────────────────┐
│   Mobile app (Expo)      │ ───────────────────────────────── ▶│  Django + DRF (ASGI)      │
│   React Native + expo-   │                                    │  served by daphne          │
│   router, Zustand,       │ ◀───────────────────────────────── │                            │
│   TanStack Query         │          WebSocket (JWT in URL)     │  ┌──────────────────────┐ │
│                          │ ───────────────────────────────── ▶│  │ Channels consumers   │ │
└─────────────────────────┘                                    │  │ chat / tracking /     │ │
                                                                 │  │ notifications         │ │
                                                                 │  └──────────┬───────────┘ │
                                                                 │             │             │
                                                                 │   ┌─────────▼─────────┐   │
                                                                 │   │ PostgreSQL+PostGIS │   │
                                                                 │   └────────────────────┘   │
                                                                 │   ┌────────────────────┐   │
                                                                 │   │ Redis (cache,      │   │
                                                                 │   │ channel layer,     │   │
                                                                 │   │ live-location TTL) │   │
                                                                 │   └────────────────────┘   │
                                                                 └──────────────────────────┘
```

The entire backend runs as a single ASGI process (`daphne`) so that plain
HTTP views and WebSocket consumers share one deployable unit. There is no
separate WSGI deployment in normal use — `wsgi.py` exists for tooling that
expects it, but `asgi.py` is the real entry point.

## Backend (`backend/`)

### Stack

- Django 5 + Django REST Framework, GeoDjango (`django.contrib.gis`) on
  PostgreSQL + PostGIS for geospatial queries (nearby-ride search).
- Django Channels (+ `channels_redis`) for WebSockets; Redis also backs the
  cache and short-TTL live-location state.
- Auth via `djangorestframework-simplejwt` — short-lived access tokens,
  rotating refresh tokens. WebSocket connections authenticate with the same
  access token passed as `?token=` (`accounts/ws_auth.py`), not cookies/sessions.
- Served by `daphne` in both dev and prod (`config/asgi.py`).

### App boundaries

Each Django app owns one bounded area of the product. Business logic lives in
a `services.py` module per app (not in views/serializers); views stay thin and
call services, which raise typed domain errors on business-rule violations.

| App | Responsibility | Key models |
|---|---|---|
| `common` | Shared primitives: base model mixins, pagination, permissions, exception envelope. No views of its own. | — |
| `accounts` | Registration, college-email OTP verification, login/refresh, profile. | `User`, `StudentProfile`, `CollegeStudent`, `EmailVerification` |
| `vehicles` | Driver-owned vehicles (bike/car), active/inactive toggling. | `Vehicle` |
| `rides` | Ride lifecycle (post, search, start/complete/cancel), join requests, seat bookings. Atomic seat accounting via `select_for_update()` + `F()` expressions. | `Ride`, `RideRequest`, `Booking` |
| `chat` | Per-ride conversations and messages, delivered over REST (history) and WebSocket (live). | `Conversation`, `ConversationParticipant`, `Message` |
| `notifications` | In-app notification feed, pushed live over WebSocket. | `Notification` |
| `tracking` | Live location sharing during an active ride, keyed by a shareable token; no-account tracking page support. | `RideShareSession`, `LocationSnapshot` |
| `safety` | Emergency contacts, SOS configuration, SOS events (panic button). | `EmergencyContact`, `SOSConfig`, `SOSEvent` |
| `rewards` | Points ledger (earned on ride completion) and post-ride ratings. | `PointsTransaction`, `Rating` |
| `reports` | User-submitted reports against riders/drivers. | `Report` |

`vehicles` and `reports` are simple enough that their views call the model
layer directly — there's no `services.py` because there's no multi-step
business rule to encapsulate.

### Cross-cutting conventions

- **Permissions**: `common.permissions.IsVerifiedStudent` is the single
  authorization gate used across the app — a verified, authenticated college
  account. There is no role-based access control; a `Ride`'s `role` field is
  a *per-ride*, backend-computed label ("driver" vs "passenger") describing
  one account's relationship to one ride, not a global user role.
- **Error envelope**: domain/service code raises a `DomainError` subclass
  (`ValidationError`, `ConflictError`, `PermissionDeniedError`, `NotFoundError`
  — `common/exceptions.py`). A custom DRF exception handler renders every
  error as `{"error": {"code", "message", "detail?"}}` so the mobile client
  can branch on a stable `code` instead of parsing prose.
- **Geospatial data**: `Ride` stores both plain lat/lng floats and a PostGIS
  `PointField` (kept in sync in `save()`), so nearby-ride search can use
  GeoDjango's distance lookups while simple reads stay plain floats.
- **Config**: `config/settings/{base,dev,local,prod,test}.py`, all values
  read from the environment via `django-environ` (`.env` at the repo root).
  `GEOS_LIBRARY_PATH`/`GDAL_LIBRARY_PATH` are only needed for local dev on
  hosts where GeoDjango can't auto-discover those native libs (e.g. Homebrew
  on macOS); unset in Docker/prod.

### WebSocket routing

`config/routing.py` aggregates per-app routing tables:

```
/ws/chat/{conversation_id}/   → chat/consumers.py
/ws/notifications/            → notifications/consumers.py
/ws/tracking/{share_token}/   → tracking/consumers.py
```

`AllowedHostsOriginValidator` + a custom `JWTAuthMiddleware` wrap the router
in `asgi.py` so every socket connection is authenticated the same way REST
requests are, before it reaches a consumer.

### REST surface

Mounted in `config/urls.py`:

```
/api/auth/            accounts.urls          (register, verify, login, refresh)
/api/profile/         accounts.profile_urls
/api/vehicles/        vehicles.urls
/api/                 rides.urls             (rides/, ride-requests/, bookings/)
/api/chat/            chat.urls
/api/notifications/   notifications.urls
/api/tracking/        tracking.urls
/api/sos/             safety.urls
/api/rewards/         rewards.urls           (points ledger)
/api/ratings/         rewards.urls           (ratings — same app, second mount)
/api/reports/         reports.urls
/healthz/             liveness probe
```

## Mobile (`mobile/`)

### Stack

- Expo (SDK 57) + React Native + TypeScript, file-based routing via
  `expo-router` (`app/(auth)/…` for the unauthenticated stack,
  `app/(app)/…` for the authenticated stack, with a `(tabs)` group for the
  four main tabs: Home, Search/Rides, Messages, Profile).
- Zustand for client state (`authStore` — session/tokens; `appModeStore` — a
  mobile-only "rider vs driver" UI preference, never sent to the backend and
  never used for authorization — it only decides which primary action the
  Home screen leads with).
- TanStack Query for server state (fetching/caching rides, bookings, chat
  history, etc.).
- `src/theme/tokens.ts` is the single design-token source (colors, spacing,
  radii, typography, shadows) — screens consume tokens rather than
  hard-coding values.

### Directory layout

```
mobile/
  app/                  expo-router screens (file-based routing)
    (auth)/              login, register, OTP verify
    (app)/
      (tabs)/             Home, Rides, Messages, Profile
      ride/, chat/, vehicles/, safety/, tracking/, profile/, …
  src/
    api/                 one module per backend app (rides.ts, chat.ts, …)
                         + client.ts (axios instance, error normalization)
    store/               Zustand stores (auth, app mode)
    lib/                 cross-cutting helpers: WebSocket hooks
                         (useChatSocket, useTrackingSocket), formatting,
                         geo constants, SOS trigger hook, secure storage
    components/          shared UI building blocks (Button, Card, TextField,
                         TabBar, ModeSwitcher, ride/chat cards, …)
    theme/               design tokens
```

### Key patterns

- **API client** (`src/api/client.ts`): a configured axios instance; every
  thrown error is normalized via `toApiError()` into `{code, message}`,
  distinguishing network/timeout failures from the backend's structured
  `{error: {...}}` envelope, so screens never branch on raw axios shapes.
- **Real-time**: `useChatSocket` and `useTrackingSocket` (`src/lib/`) own the
  WebSocket connection lifecycle (connect with the stored JWT, reconnect,
  local optimistic message state with retry-on-failure) and expose a plain
  hook API to screens.
- **Auth/token storage**: tokens live in `expo-secure-store`, wrapped by
  `src/lib/secureStore.ts`; `appModeStore` persists through the same helper
  under its own key so it survives app restarts without touching the backend.
- **Design discipline**: every native module is checked for Expo Go
  compatibility before use (presence of `expo-module.config.json` publishing
  under `host.exp.exponent`) — a lesson learned after `react-native-maps`
  turned out to need a custom dev client. Location is `expo-location` only;
  there is currently no map-picker UI, so ride origin/destination coordinates
  default to a campus constant (`src/lib/geo.ts`) unless a screen explicitly
  captures a real device fix (e.g. "use current location" on the create-ride
  form).

## Data flow examples

**Posting a ride**: mobile `ride/create.tsx` → `POST /api/rides/` → `rides`
app's service layer validates vehicle ownership/active status and seat count
→ `Ride` row created (lat/lng + PostGIS point) → response feeds TanStack
Query's cache, screen navigates to the ride detail.

**Joining a ride / chat**: a `RideRequest` is created and, once accepted, a
`Booking` plus a `Conversation` are available; the mobile chat screen opens a
WebSocket to `/ws/chat/{conversation_id}/`, sends/receives `Message`s live,
and falls back to the REST history endpoint for anything sent while
disconnected.

**Live tracking**: when a ride starts, a `RideShareSession` is created with a
share token; the driver's device streams location over
`/ws/tracking/{token}/`, Redis holds the latest point (short TTL) for fast
reads while `LocationSnapshot` rows persist a lower-frequency trail; the
share token is also meant to back a no-account public tracking page (not yet
built — see Known gaps).

**SOS**: `useSosTrigger` (mobile) hits `/api/sos/`, which records an
`SOSEvent` against the rider's configured `EmergencyContact`s; notifying
college security is currently a stub, not a real integration (see below).

## Known gaps / deferred work

- No public (no-login) `/track/<token>` web page yet — the backend models
  support it, the page itself hasn't been built.
- Push notifications are in-app/WebSocket only; real Expo push delivery
  isn't wired up.
- SOS "notify college security" is not a real integration yet.
- No automated mobile test suite (Jest + React Native Testing Library) is
  set up; backend has Django's test runner with ~110 passing tests across
  the apps above.
