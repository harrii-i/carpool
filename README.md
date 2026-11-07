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

## API — communication (Phase 3)

**Chat** — `/api/chat/` (confirmed participants only, §20/§38). A conversation is
created automatically when the first booking on a ride is confirmed; access is
revoked when a passenger cancels.
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/chat/conversations/` | My conversations (last message + unread count) |
| GET | `/api/chat/conversations/{id}/messages/` | Message history (paginated) |
| POST | `/api/chat/conversations/{id}/messages/` | `{message}` → send (REST fallback) |
| POST | `/api/chat/conversations/{id}/read/` | Mark conversation read |

**Notifications** — `/api/notifications/` (§33)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/notifications/` | My notifications, newest first |
| GET | `/api/notifications/unread_count/` | Unread count |
| POST | `/api/notifications/{id}/read/` · `/read_all/` | Mark read |

### WebSockets

Authenticate with the REST access token as a query param: `?token=<access>`.

| Endpoint | Purpose |
|---|---|
| `/ws/chat/{conversation_id}/` | Real-time chat. Send `{"action":"message","message":"..."}` or `{"action":"read"}`; receive `{"type":"message",...}`. Refused (4403) for non-participants, (4401) unauthenticated. |
| `/ws/notifications/` | Live notification stream for the authenticated user. |

Lifecycle events (request received/accepted/rejected, ride cancelled/starting/
completed, new message) generate in-app notifications and are pushed live over
the notification socket. Expo push is a wired no-op seam for now.

## API — safety & tracking (Phase 4)

**Tracking** — `/api/tracking/`
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/tracking/sessions/` | `{ride_id}` → create a share session (participants only), returns `share_token` + `share_url` |
| GET | `/api/tracking/sessions/` | My share sessions |
| POST | `/api/tracking/sessions/{id}/revoke/` | Revoke a session |
| POST | `/api/tracking/sessions/{id}/location/` | Driver-only REST fallback to push a location |
| GET | `/api/tracking/public/{token}/` | **Public** (no auth) tracking payload — driver first name, vehicle, origin/destination, ride status, current location. No private data. |

**Safety / SOS** — `/api/sos/`
| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/sos/contacts/` + `/{id}/` | Emergency contact CRUD (owner-only) |
| POST | `/api/sos/contacts/{id}/set_primary/` | Set the single primary contact |
| GET/PUT/PATCH | `/api/sos/config/` | SOS configuration (what a trigger does) |
| POST | `/api/sos/trigger/` | Trigger SOS → creates an immutable event, optionally starts sharing, returns `{event, actions}` |
| GET | `/api/sos/events/` + `/{id}/` | Own SOS event history (immutable) |

`trigger` returns an **actions** payload (`call`, `message`, `recipients`,
`tracking_link`) for the client to execute natively — the backend never places
calls or sends SMS (§29). Live tracking stops and share sessions end when a ride
completes or is cancelled (§19).

### WebSocket (tracking)

| Endpoint | Purpose |
|---|---|
| `/ws/tracking/{share_token}/` | Anyone with a valid token connects and **views**; only the ride's authenticated driver (`?token=<access>`) may push `{latitude, longitude, speed?, heading?}`. Latest position sent on connect; refused (4404) for invalid/expired/revoked tokens. |

Current location lives in Redis with a short TTL (goes "stale" automatically);
only coarse, throttled snapshots are persisted so PostgreSQL never becomes a GPS
event store (§24).

## API — reputation (Phase 5)

**Points** — `/api/rewards/` (read-only; awarded only by backend logic on
completion, §31)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/rewards/points/` | My points ledger |
| GET | `/api/rewards/points/summary/` | `{total_points, completed_rides, average_rating}` |

**Ratings** — `/api/ratings/` (§32)
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/ratings/` | `{ride_id, reviewee_id, rating, comment}` — participants only, after completion, one per pair/ride, no self-rating |
| GET | `/api/ratings/?role=given\|received&ride=<id>` | List ratings |
| GET | `/api/ratings/rateable/?ride=<id>` | Who I can still rate for a completed ride |

**Reports** — `/api/reports/` (§36)
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/reports/` | `{reported_user?, ride?, reason, description}` — reasons per §36 |
| GET | `/api/reports/` | My filed reports (status is admin-controlled) |

Completing a ride awards points (driver +15 / passenger +10, configurable),
recomputes averages when ratings are left, and notifies participants that rating
is available. Admins review reports and SOS events in Django Admin.

## Running tests

```bash
docker compose exec backend python manage.py test
```

## Running the mobile app

Expo + TypeScript app (expo-router, TanStack Query, Zustand). Design system
derived from the reference screenshot lives in `mobile/src/theme` and
`mobile/src/components`.

```bash
cd mobile
cp .env.example .env          # set EXPO_PUBLIC_API_URL to your backend
npm install                   # .npmrc pins legacy-peer-deps (RN/Expo peer quirks)
npx expo start                # press i / a, or scan the QR with Expo Go
```

On a physical device, set `EXPO_PUBLIC_API_URL` to your machine's LAN IP (not
`localhost`) so the phone can reach the dev server, e.g.
`EXPO_PUBLIC_API_URL=http://192.168.1.20:8000`.

Structure:
```
mobile/
├── app/            expo-router routes: (auth) login/register/verify, (app) tabs
├── src/theme/      design tokens (colors, type, spacing, radius, shadow)
├── src/components/ primitives (Button, Card, TextField, TabBar, …)
├── src/api/        axios client w/ JWT auto-refresh, auth endpoints, types
└── src/store/      Zustand auth store + secure token storage
```

Type-check and bundle checks:
```bash
npx tsc --noEmit
npx expo export -p ios --output-dir /tmp/carpool-check   # optional bundle smoke test
```

**Mobile status:** Phases 1–2 done.
- **Phase 1** — design system, navigation shell (expanding-pill tab bar), JWT
  auth client, register → verify → login.
- **Phase 2** — vehicles (list/add/deactivate), post a ride, browse/search rides,
  ride details with request-to-join, driver accept/reject + start/complete/cancel,
  booking cancel, and ride history (upcoming/active/completed/cancelled).
- **Phase 3** — real-time chat over WebSocket (conversation list + live message
  thread with unread counts) and the in-app notifications feed.
- **Phase 4** — emergency contacts, SOS configuration, a one-tap SOS trigger
  (native call + SMS composer, confirm-before-fire), and live ride tracking:
  a map-based pickup/destination picker on Create Ride, "Share live ride" /
  "Track live location" from ride details, and a live map screen
  (`react-native-maps` + `expo-location`) that broadcasts the driver's GPS over
  WebSocket and renders it for any viewer.

- **Phase 5** — points history (ledger + summary), rating participants after a
  completed ride (star picker, one row per unrated participant), and reporting
  a ride's driver (reason chips + description) from ride details.

- **Phase 6** — UI-state polish pass (§42): every `ErrorState` now surfaces the
  real backend/network error message (was silently falling back to a generic
  one); chat messages show **Sending / Sent / Failed** with tap-to-retry on
  failure; a declined ride request is now explained instead of silently
  reverting; a global **offline banner** appears whenever connectivity drops,
  and React Query automatically refetches when it returns (wired to
  `@react-native-community/netinfo` via `onlineManager`). Also fixed a real bug:
  SOS settings got stuck on a loading spinner forever if the config request
  failed.

All 6 mobile phases are now complete.

### Rider/Driver mode (2026-10)

A single account can act as both driver and rider without logging out. This is
a **mobile-only UI preference**, never sent to the backend and never used for
authorization — the backend already authorized purely by vehicle ownership +
verification (no role field ever existed on `User`), so no backend or database
change was needed for this feature; see `backend/rides/tests/test_rides.py
::DualRoleAccountTests` for the regression tests that pin this down.

- `mobile/src/store/appModeStore.ts` — Zustand store for `mode: 'rider'|'driver'`,
  persisted via the existing `secureStore` helpers (no new dependency).
- `ModeSwitcher` (Home header "Rider ▾" pill → bottom sheet) switches instantly,
  no logout/re-auth/account selection.
- Home reorders itself by mode (Rider: search card primary, driver action
  secondary; Driver: "Offer a ride" card primary, search secondary) but **both
  capabilities stay reachable in either mode** — mode changes emphasis only.
- The Rides tab's existing Driver/Rider history sub-tab is seeded from the
  current mode when deep-linked from Home, but remains manually switchable.
- The existing vehicle-less gate on Create Ride is reframed as "Become a
  driver" — triggered only when attempting to post a ride, never on mode switch.
- Per-ride role (`ride.role`, `ride.is_driver` — the user's relationship to one
  specific ride) is a separate, pre-existing backend-computed concept and was
  left untouched; it must never be confused with the global mode preference.

### Messages/Chat redesign (2026-10)

The Chat tab was redesigned from a reference screenshot, adapted honestly
rather than cloned: elements with no backing capability in this app (live
"online" presence, a "message anyone" compose button, chat requests from
strangers) were replaced with real equivalents instead of faked.

- **"Requests" tab is real** — pending join-requests across every ride you're
  driving, via the existing `/api/ride-requests/?role=incoming` endpoint
  (no backend change; just a new mobile screen for data that already existed).
- **Row redesign**: circular avatars, bold name + route + last-message
  hierarchy, solid unread badge. The small corner dot shows **ride status**
  (not fake presence — this app has no online/presence tracking).
- **No FAB** — there's no "start a conversation with anyone" capability
  (chat only exists between confirmed ride participants, §20), so no dead
  button was added for it.
- **One small, justified backend change**: `ConversationSerializer` gained a
  read-only `other_participants` field (`backend/chat/serializers.py`) — the
  conversation list previously exposed no identity of who you're chatting
  with at all, only the ride's route. No model change, no migration; a
  conversation can have more than one other participant (a ride with several
  confirmed passengers shares one conversation), so it's a list, not a single
  peer.

### Chat thread redesign (2026-10)

The individual conversation screen was redesigned from a second reference
screenshot, with the same "adapt honestly" approach:

- **Header** shows the other participant + a **real ride-status** line
  (colored dot + "Upcoming ride"/"Ride in progress"/"Ride completed"/"Ride
  cancelled") instead of the reference's fake "Online now" presence indicator
  — this app has no presence tracking.
- **Ride-info pill** (route + departure time, tap → ride details) reuses the
  existing `ridesApi.detail()` ride-detail endpoint — no backend change.
- **Read receipts are real**: a single check vs. a colored double-check per
  sent message, driven by the `read_at` field the backend was already setting
  correctly (Phase 3) — it just had never been surfaced in the UI before.
- **"⋮" menu** opens real actions only: view ride details, report.
- **No attachment/emoji/mic buttons** were added — this app has no file
  attachments or voice messages (§20 explicitly excludes voice calling from
  the MVP), so those would have been dead buttons.
- A light decorative icon backdrop behind the message list is purely
  cosmetic (no data behind it) — included because it's harmless, unlike the
  items above.

### Profile redesign (2026-10)

The Profile tab was redesigned from a third reference screenshot. Unlike the
two chat screens, almost everything here mapped directly to real,
already-built data or endpoints — the one new piece was a genuine "Edit
profile" screen (phone number + photo), since `/api/profile/` already
supported updating both, it just never had a mobile screen.

- **"Edit"** → new `app/(app)/profile/edit.tsx`: phone number (editable) and
  profile photo via `expo-image-picker` (verified Expo-Go-compatible the same
  way as the earlier `expo-linear-gradient` check). Name/admission
  number/department/year stay read-only, correctly, per §9.
- **"Verified student" badge** uses the real `user.is_verified` flag.
- **Menu rows, SOS trigger, and logout** are the same existing destinations/
  actions, just restyled as full card rows with icon tiles + subtitles.
- **Version number** reads the real app version via `expo-constants`
  (`Constants.expoConfig?.version`) rather than a hardcoded string.
- **One real bug found and fixed**: `MeView` and `ProfileView` built their
  serializers without `context={"request": request}`, so `profile_image` was
  always serializing to a bare relative path (e.g. `/media/profiles/x.jpg`)
  instead of an absolute URL — meaning profile photos could never actually
  have loaded on any screen in the app, ever. Fixed in both views; one
  regression test (`accounts/tests/test_profile.py`) asserts the URL is
  absolute. **No migration** — this was a view-level bug, not a model change.
  **Requires a backend restart** to take effect (same caveat as the earlier
  `other_participants` change — `daphne` doesn't hot-reload).

### Home "Upcoming activity" refinement (2026-10)

Refined from a close-up reference of that section. The key distinction this
required: a ride's own status (Open/Full/…) isn't what a passenger cares
about — they care whether *their seat* is confirmed, which is a different,
booking-level status our `RideListItem` doesn't carry. Rather than adding a
backend field, this reuses the existing `bookingsApi.list()` endpoint
(already used elsewhere) to cross-reference booking status by ride id — zero
backend change.

- New `ActivityRideCard` component: driver avatar+name+vehicle, a real status
  badge (ride status for rows you're driving, booking status — "Confirmed"/
  "Completed"/"Cancelled" — for rows you're riding), a compact route
  visualization, and departure time + seats.
- New `OfferRideIllustration`: a small decorative inline-SVG (hills, a tree, a
  simple car) for the "Offer a ride" tile — deliberately simple shapes, not an
  attempt at detailed illustration art (consistent with the Home redesign's
  earlier decision to skip a complex hero illustration).
- **Not implemented**: the reference's stacked/overlapping card effect
  (the next activity card peeking out from behind the tile below it). This is
  a layout/animation flourish with real complexity (negative margins, z-index,
  behavior varying by item count) and no functional gap — left as plain
  vertical flow; flagged rather than silently attempted and left janky.

### Android keyboard-avoidance fix (2026-10)

The chat thread's input bar wasn't reliably appearing above the keyboard on
some Android devices (worked on one test device, not another) — a classic
symptom of Android's inconsistent default soft-keyboard handling across OEM
skins. Root cause: the screen set `behavior={Platform.OS === 'ios' ? 'padding'
: undefined}` on its `KeyboardAvoidingView` — the `undefined` means React
Native does **nothing** to avoid the keyboard on Android, leaving it entirely
up to the OS's own window-resize behavior, which isn't consistent across
devices. Fixed to `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`
("height" being the standard, reliable choice for Android) and removed an
unnecessary `keyboardVerticalOffset` (the custom header sits above, not
overlapping, the `KeyboardAvoidingView`, so no offset was needed). Also added
`android.softwareKeyboardLayoutMode: "resize"` to `app.json` for correctness —
**note this one only takes effect in a custom dev client / standalone build,
not in Expo Go**, since Expo Go's own AndroidManifest is fixed and shared
across all Expo-Go-hosted apps (it already defaults to resize mode, which is
why the JS-level fix above is the one that actually matters for Expo Go
testing).

### Design system v2 (2026-10 re-theme)

The app was re-themed from a second reference screenshot, adopted as the new
global design system (not just a Home-screen restyle): vivid royal-blue accent
(`#3D5AFE`) on a soft blue-lavender→white background, pastel accent tiles for
feature cards/quick-links, and a flat docked bottom tab bar (icon-over-label,
pill highlight behind the active icon) replacing the earlier floating
expanding-pill bar. Updating `mobile/src/theme/tokens.ts` and the shared
components (`Button`, `Card`, `TabBar`, etc.) cascades the new look to every
screen automatically. The Home screen was rebuilt to match the new reference's
content layout: a gradient hero with greeting + notification bell (shows a dot
when there are unread notifications) + headline + a floating "Find a ride"
search card (Going from/Going to with swap and current-location shortcuts),
Post a ride / My rides feature tiles, and a Quick links row (Recent trips and
Settings are wired to real screens; Saved rides / Nearby riders show a
"coming soon" notice since there's no such backend concept yet).

New dependency: `expo-linear-gradient` (a genuine Expo SDK module — verified
Expo-Go-compatible via its `expo-module.config.json`, unlike `react-native-maps`).

### Native modules added in Phase 4
`react-native-maps`, `expo-location`, `expo-sms` — all Expo-Go-compatible, no
custom dev client required. Maps use the platform default provider (Apple Maps
on iOS, Google Maps on Android); set `MAPS_API_KEY` in production and switch to
`PROVIDER_GOOGLE` for a consistent cross-platform look once you have a key —
development works fine without one (Android shows a "for development" map
watermark until a key is set).

## Development phases

1. **Foundation** *(done)* — infra, auth, college verification.
2. **Core carpool** *(done)* — profile, vehicles, rides, requests, bookings, lifecycle, history.
3. **Communication** *(done)* — WebSocket chat, notifications.
4. **Safety** *(done)* — emergency contacts, SOS, live location, shareable tracking.
5. **Reputation** *(done)* — points, ratings, reports.
6. UI refinement — loading/empty/error/offline states, polish.

## Security notes

Backend is the source of truth for authorization, seat counts, points, ride
status, and verification. Auth endpoints are rate-limited; passwords use
Django's hashing; passwords and JWTs are never logged; tracking uses secure,
expiring, revocable tokens with no sensitive data in the URL.
