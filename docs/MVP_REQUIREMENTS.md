# College Carpool — MVP Requirements

## 1. Product Overview

Build a mobile-first college carpooling application that allows **verified students of a college** to share rides with each other.

A student can act as either a driver or passenger. There are no separate driver and passenger accounts.

The application allows students to:

* Register and verify their college identity.
* Add a bike or car.
* Post rides.
* Search and discover available rides.
* Request to join rides.
* Accept or reject ride requests.
* Chat with confirmed ride participants.
* Start and complete rides.
* Share a live ride with a parent/friend.
* Track a shared ride through a secure temporary link.
* Configure and trigger an SOS workflow.
* Earn points for completed rides.
* Rate other ride participants.
* Report users or incidents.
* View ride history and notifications.

The application is restricted to verified college students.

---

# 2. MVP Goals

The primary goal is to implement the complete core carpool workflow:

```text
Register
    ↓
Verify student
    ↓
Login
    ↓
Add vehicle
    ↓
Post ride
    ↓
Another student searches
    ↓
Views ride
    ↓
Requests to join
    ↓
Driver accepts
    ↓
Booking confirmed
    ↓
Chat
    ↓
Ride starts
    ↓
Live ride sharing
    ↓
Ride completes
    ↓
Points awarded
    ↓
Rating
    ↓
Ride history
```

Safety and live tracking are part of the MVP.

---

# 3. Technology Stack

## Mobile

Use:

* React Native
* Expo
* TypeScript

Use Expo unless a specific required native capability makes a bare React Native setup necessary.

The application must be designed for mobile devices first.

---

## Backend

Use:

* Python
* Django
* Django REST Framework
* Django Channels
* PostgreSQL
* PostGIS
* Redis

Authentication:

* JWT
* Access token
* Refresh token

Recommended JWT package:

```text
djangorestframework-simplejwt
```

---

# 4. Architecture

```text
                    React Native
                         │
              ┌──────────┴──────────┐
              │                     │
           REST API              WebSocket
              │                     │
              ▼                     ▼
       Django REST Framework   Django Channels
              │                     │
              └──────────┬──────────┘
                         │
                       Redis
                         │
                         ▼
                  PostgreSQL + PostGIS
```

## REST API

Use REST APIs for:

* Authentication
* Student profiles
* Vehicles
* Rides
* Ride requests
* Bookings
* Ratings
* Points
* Notifications
* Emergency contacts
* SOS configuration
* Reports

## WebSockets

Use WebSockets for:

* Real-time chat
* Live ride tracking
* Real-time events where appropriate

---

# 5. Project Structure

Use a domain-oriented backend structure.

```text
college-carpool/
│
├── mobile/
│
├── backend/
│   ├── config/
│   ├── accounts/
│   ├── vehicles/
│   ├── rides/
│   ├── chat/
│   ├── tracking/
│   ├── safety/
│   ├── rewards/
│   ├── notifications/
│   └── common/
│
├── docs/
│   └── MVP_REQUIREMENTS.md
│
├── docker-compose.yml
├── .gitignore
└── README.md
```

Do not put all backend functionality into a single Django app.

---

# 6. User Roles

## Student

Every verified student can:

* Create rides.
* Drive.
* Request rides.
* Ride as a passenger.
* Manage vehicles.
* Chat with confirmed participants.
* Share live rides.
* Configure emergency contacts.
* Trigger SOS.
* Earn points.
* Rate participants.
* Report users.
* View ride history.

There are no separate driver and passenger accounts.

---

## Admin

For MVP, use Django Admin rather than building a separate admin mobile application.

Admin can:

* Manage students.
* Manage college student records.
* Suspend users.
* View rides.
* Review reports.
* Review SOS events.
* Manage application data.

---

# 7. College Student Verification

College-only access is a core requirement.

Create a college student registry.

Suggested model:

```text
CollegeStudent

id
admission_number
name
college_email
department
year
is_active
created_at
updated_at
```

The registry represents students who are actually enrolled in the college.

---

## Registration

Student provides:

```text
Name
Admission Number
College Email
Phone Number
Password
```

The backend must verify that the admission number exists in the college student registry.

Registration must fail when:

* Admission number does not exist.
* Student is inactive.
* Admission number has already been registered.

Department, year, name, and college email should be derived from the verified college record rather than trusted from arbitrary client input.

---

## Email Verification

Send a verification OTP/code to the student's college email.

The account becomes active only after successful verification.

Do not implement custom password hashing. Use Django's built-in password hashing.

---

# 8. Authentication

Required endpoints:

```text
POST /api/auth/register/
POST /api/auth/verify/
POST /api/auth/login/
POST /api/auth/refresh/
POST /api/auth/logout/
GET  /api/auth/me/
```

Use:

```text
Access Token
Refresh Token
```

Access tokens should have a shorter lifetime.

Refresh tokens should have a longer lifetime.

The mobile application should automatically refresh the access token when required.

Store tokens securely on the mobile device.

---

# 9. Student Profile

Suggested profile fields:

```text
StudentProfile

id
user
name
admission_number
college_email
phone_number
department
year
profile_image
total_points
completed_rides
average_rating
created_at
updated_at
```

Students can edit:

* Profile image.
* Phone number.
* Emergency contacts.
* Relevant user preferences.

Verified identity information must not be arbitrarily editable.

---

# 10. Vehicle Management

Students can register one or more vehicles.

Suggested model:

```text
Vehicle

id
owner
vehicle_type
brand
model
registration_number
color
seat_capacity
is_active
created_at
updated_at
```

Vehicle types:

```text
BIKE
CAR
```

Students can:

* Add vehicle.
* Edit vehicle.
* Deactivate vehicle.
* Select a vehicle while creating a ride.

Registration numbers must be unique.

---

# 11. Ride

Suggested model:

```text
Ride

id
driver
vehicle

origin
destination

origin_latitude
origin_longitude
destination_latitude
destination_longitude

departure_time

total_seats
available_seats

contribution_amount
notes

status

created_at
updated_at
started_at
completed_at
cancelled_at
```

Use PostGIS for geographic data where appropriate.

---

## Ride Status

Allowed states:

```text
OPEN
FULL
STARTED
COMPLETED
CANCELLED
```

Status changes must be controlled by backend business logic.

Do not allow clients to arbitrarily set ride status.

---

# 12. Creating a Ride

The driver provides:

```text
Origin
Destination
Date
Departure time
Vehicle
Available seats
Optional contribution
Optional notes
```

Backend validation:

* Driver must be verified.
* Vehicle must belong to the driver.
* Vehicle must be active.
* Available seats cannot exceed vehicle capacity.
* Departure time cannot be in the past.
* Driver cannot create an invalid/empty ride.

---

# 13. Ride Search

Students can search rides using:

```text
Origin
Destination
Date
Time
Vehicle type
Available seats
```

Initial MVP search can use location and destination matching.

PostGIS should be used where appropriate for geographic proximity.

Example:

```text
GET /api/rides/search/
```

Search results should contain:

```text
Ride
Driver summary
Vehicle summary
Departure time
Available seats
Distance where available
Driver rating
```

Do not expose unnecessary private information.

---

# 14. Ride Details

The ride details screen should display:

## Driver

* Profile image.
* Name.
* Department.
* Year.
* Rating.
* Completed rides.

## Vehicle

* Type.
* Brand/model.
* Color.
* Registration number.

## Ride

* Origin.
* Destination.
* Departure time.
* Available seats.
* Contribution.
* Notes.

Sensitive information should only be exposed when appropriate.

---

# 15. Ride Requests

A rider can select:

```text
Request to Join
```

Create:

```text
RideRequest

id
ride
rider
status
created_at
updated_at
```

Status:

```text
PENDING
ACCEPTED
REJECTED
CANCELLED
```

---

# 16. Ride Request Rules

The backend must prevent:

* Requesting your own ride.
* Duplicate active requests.
* Requesting a cancelled ride.
* Requesting a completed ride.
* Requesting when there are no seats.
* Requesting when already booked on the same ride.

Driver can:

```text
Accept
Reject
```

When accepted:

```text
RideRequest → ACCEPTED
Booking → CREATED
available_seats → decremented
```

If no seats remain:

```text
Ride → FULL
```

All seat changes must be atomic to prevent race conditions when multiple students request the last available seat simultaneously.

---

# 17. Booking

Keep bookings separate from ride requests.

Suggested model:

```text
Booking

id
ride
passenger
ride_request
status
created_at
cancelled_at
completed_at
```

Status:

```text
CONFIRMED
CANCELLED
COMPLETED
```

This allows proper ride history and cancellation handling.

---

# 18. Ride Cancellation

Drivers can cancel their rides according to the ride state.

Passengers can cancel their bookings.

Cancellation should:

* Update status.
* Restore seats where applicable.
* Notify affected users.
* Preserve the historical record.

Do not physically delete completed/cancelled rides.

Use status-based lifecycle management.

---

# 19. Ride Start and Completion

Driver can start a ride:

```text
OPEN/FULL
    ↓
STARTED
```

After the trip:

```text
STARTED
    ↓
COMPLETED
```

Only the driver can start/complete the ride.

The backend must validate all state transitions.

When a ride is completed:

* Passenger bookings become completed.
* Points are awarded.
* Rating becomes available.
* Live tracking is stopped.
* Active share sessions expire.
* Ride becomes immutable except for permitted post-ride actions such as ratings.

---

# 20. Chat

Use:

```text
Django Channels
Redis
WebSocket
```

Chat is available only to confirmed participants of a ride.

Suggested models:

```text
Conversation

id
ride
created_at
```

```text
ConversationParticipant

conversation
user
```

```text
Message

id
conversation
sender
message
created_at
read_at
```

WebSocket:

```text
/ws/chat/{conversation_id}/
```

Required features:

* Send messages.
* Receive messages in real time.
* Message history.
* Timestamp.
* Read/unread state.

Do not implement video or voice calling in the MVP.

---

# 21. Live Ride Sharing

A participant can select:

```text
Share Live Ride
```

Create a temporary share session.

Suggested model:

```text
RideShareSession

id
ride
created_by
share_token
expires_at
is_active
created_at
ended_at
```

Generate a cryptographically secure random token.

Do not use:

```text
ride_id
student_id
```

as the public authorization mechanism.

---

# 22. Shareable Tracking Link

Generate a link similar to:

```text
https://app-domain/track/<secure-token>
```

The recipient can open the link and see the shared ride without necessarily having an application account.

The tracking page should show:

```text
Driver
Vehicle
Origin
Destination
Current location
Ride status
Last updated
```

The share link must:

* Be random.
* Expire.
* Be revocable.
* Stop working after the ride ends.
* Not expose private student data.

---

# 23. Live Location WebSocket

Use:

```text
/ws/tracking/{share_token}/
```

The driver's mobile device sends location updates while the ride is active.

Example payload:

```json
{
  "latitude": 8.5241,
  "longitude": 76.9366,
  "speed": 31.2,
  "heading": 145,
  "timestamp": "2026-09-26T12:30:00Z"
}
```

The backend broadcasts the latest location to connected viewers.

Do not send GPS coordinates every second.

Use approximately:

```text
3–5 seconds
```

or movement-based updates.

Make the update interval configurable.

---

# 24. Location Data Architecture

Do not permanently store every GPS update.

Recommended flow:

```text
Mobile GPS
    ↓
WebSocket
    ↓
Redis / current state
    ↓
Connected viewers
```

Optionally persist periodic location snapshots in PostgreSQL/PostGIS.

The implementation should avoid turning PostgreSQL into a high-frequency GPS event store.

---

# 25. SOS

SOS is a core safety feature.

Students can configure emergency contacts.

Suggested model:

```text
EmergencyContact

id
user
name
phone_number
relationship
is_primary
is_active
created_at
updated_at
```

Students can:

* Add contact.
* Edit contact.
* Remove/deactivate contact.
* Set primary contact.

---

# 26. SOS Configuration

Students can choose what happens when SOS is triggered.

Example:

```text
Call primary contact
Send emergency message
Share live location
Notify selected contacts
```

The configuration should be persisted.

Example:

```text
☑ Call primary contact
☑ Send emergency message
☑ Share live location
☐ Notify college security
```

The architecture should allow additional actions to be added later.

---

# 27. SOS Event

Create an immutable SOS event.

Suggested model:

```text
SOSEvent

id
user
ride
latitude
longitude
triggered_at
status
created_at
```

Capture:

* User.
* Active ride.
* Driver.
* Vehicle.
* Current location.
* Timestamp.
* Active participants.

The location captured at the time of the SOS must be stored with the event.

---

# 28. SOS Flow

```text
User taps SOS
      ↓
Create SOS event
      ↓
Capture current location
      ↓
Start live location sharing if configured
      ↓
Execute configured actions
```

The implementation should avoid accidental triggers where practical, but emergency actions must remain easily accessible.

---

# 29. Phone Call

For immediate calling, use the device's native dialing mechanism.

The mobile application can initiate:

```text
tel:+91XXXXXXXXXX
```

Do not attempt to secretly place phone calls from the backend.

The final user action depends on the operating system's phone behavior.

---

# 30. Emergency Message

Allow the student to customize their emergency message.

Default example:

```text
I may need help. I am currently on a college carpool ride. My current location is available here: {tracking_link}
```

Support variables:

```text
{name}
{ride}
{driver}
{vehicle}
{location_link}
```

The backend should generate the correct contextual message when required.

---

# 31. Points

Use a transaction-based points system.

Suggested model:

```text
PointsTransaction

id
user
ride
points
transaction_type
description
created_at
```

Initial MVP values:

```text
Driver completes ride: +15
Passenger completes ride: +10
```

Make the values configurable rather than hard-coded throughout the codebase.

Do not allow the mobile client to directly award points.

Points must be awarded by trusted backend logic after ride completion.

---

# 32. Ratings

After a completed ride, participants can rate each other.

Suggested model:

```text
Rating

id
ride
reviewer
reviewee
rating
comment
created_at
```

Rating:

```text
1–5
```

Rules:

* Only participants can rate.
* Rating is available only after completion.
* One rating per reviewer/reviewee/ride.
* Users cannot rate themselves.

Calculate average ratings on the backend.

---

# 33. Notifications

Create:

```text
Notification

id
user
type
title
message
data
is_read
created_at
```

Notification events:

```text
Ride request received
Ride request accepted
Ride request rejected
Ride cancelled
New chat message
Ride starting
Ride completed
Points awarded
Rating available
```

Implement in-app notifications for MVP.

Push notifications can use Expo notifications where practical.

---

# 34. Ride History

Users should have:

```text
Upcoming
Active
Completed
Cancelled
```

Each ride should indicate:

```text
Driver
Passenger
```

depending on the user's role for that ride.

---

# 35. Profile

Profile should show:

```text
Profile photo
Name
Department
Year
Rating
Completed rides
Points
Vehicles
Emergency contacts
```

Settings:

```text
Edit profile
Manage vehicles
Emergency contacts
SOS settings
Notification settings
Logout
```

---

# 36. Reporting

Students can report users or rides.

Suggested model:

```text
Report

id
reporter
reported_user
ride
reason
description
status
created_at
updated_at
```

Reasons:

```text
Unsafe behavior
Harassment
Fake profile
Vehicle mismatch
Inappropriate behavior
Other
```

Admin reviews reports through Django Admin.

---

# 37. API Organization

Suggested API structure:

```text
/api/auth/*
/api/profile/*
/api/vehicles/*
/api/rides/*
/api/ride-requests/*
/api/bookings/*
/api/chat/*
/api/tracking/*
/api/sos/*
/api/rewards/*
/api/ratings/*
/api/notifications/*
/api/reports/*
```

Use REST conventions.

Business logic should not all live inside views or serializers.

Use service/domain functions where business logic becomes complex.

---

# 38. Permissions

Backend authorization is mandatory.

Examples:

```text
Only verified students
    → Create rides

Only ride driver
    → Accept/reject requests

Only confirmed participants
    → Access ride chat

Only ride participants
    → Access relevant ride information

Only ride driver
    → Start/complete ride

Only account owner
    → Modify emergency contacts

Only authorized share token
    → Access live tracking
```

Never rely only on frontend checks.

Every protected operation must be authorized on the backend.

---

# 39. Database Requirements

Use:

```text
PostgreSQL + PostGIS
```

Important indexes:

```text
admission_number
college_email
vehicle.registration_number
ride.departure_time
ride.status
ride geographic fields
ride_request.ride
ride_request.rider
booking.ride
booking.passenger
```

Use database constraints where appropriate.

Use transactions for operations involving:

* Accepting ride requests.
* Updating available seats.
* Creating bookings.
* Completing rides.
* Awarding points.

Prevent race conditions around seat availability.

---

# 40. Mobile Navigation

The exact navigation should follow the supplied UI reference screenshot.

Conceptually, the application should contain:

```text
Auth
 │
 └── Main Application
      │
      ├── Home
      ├── Rides/Search
      ├── Create Ride
      ├── Active Ride
      ├── Chat
      ├── Tracking
      ├── SOS
      ├── Notifications
      └── Profile
```

Do not create unnecessary screens.

Use modal/bottom-sheet interactions where they fit the supplied visual design.

---

# 41. UI Design System

A single reference screenshot will be supplied separately.

The screenshot is the **visual source of truth** for the application.

Use it to derive a consistent design system for the rest of the application.

Infer consistently:

* Color palette.
* Typography hierarchy.
* Font weights.
* Border radius.
* Card styles.
* Button styles.
* Input styles.
* Spacing.
* Icon style.
* Navigation style.
* Bottom sheets/modals.
* Shadows/elevation.
* Background treatment.
* Component density.

Do not create unrelated visual styles for screens that are not shown.

The goal is for the entire application to look like it was designed as one coherent product.

If the screenshot does not specify a particular interaction or component, use the existing design language rather than inventing a new one.

---

# 42. UI States

Every important screen should account for:

```text
Loading
Success
Empty
Error
Offline/network failure
```

Examples:

Search rides:

```text
Loading rides
No rides found
Network error
Rides available
```

Ride request:

```text
Requesting
Pending
Accepted
Rejected
Cancelled
```

Live tracking:

```text
Waiting for location
Live
Location stale
Tracking ended
Share expired
```

Chat:

```text
Loading
Empty conversation
Sending
Sent
Failed
```

---

# 43. Security Requirements

The application handles sensitive information including:

* Student identity.
* Phone numbers.
* Emergency contacts.
* Live location.
* Ride information.

Implement:

* HTTPS in production.
* JWT authentication.
* Secure mobile token storage.
* Backend authorization.
* Authentication rate limiting.
* Input validation.
* Secure random tracking tokens.
* Tracking token expiry.
* Revocable tracking sessions.
* No sensitive data in tracking URLs.
* No password logging.
* No JWT logging.
* Minimal location persistence.

Do not expose emergency contacts through public tracking links.

---

# 44. Environment Configuration

Create:

```text
.env.example
```

Suggested variables:

```env
DJANGO_SECRET_KEY=
DEBUG=True

DATABASE_URL=
REDIS_URL=

JWT_ACCESS_TOKEN_LIFETIME=
JWT_REFRESH_TOKEN_LIFETIME=

CORS_ALLOWED_ORIGINS=

COLLEGE_DOMAIN=

EMAIL_HOST=
EMAIL_PORT=
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=

MAPS_API_KEY=

EXPO_ACCESS_TOKEN=

SENTRY_DSN=
```

Never commit real credentials.

---

# 45. Local Development

Use Docker Compose for infrastructure.

At minimum:

```text
PostgreSQL + PostGIS
Redis
```

The backend should be easy to run locally.

Seed development data:

```text
College
Departments
Students
Vehicles
Rides
```

Provide at least:

```text
Student A → Driver
Student B → Passenger
```

so the complete workflow can be tested.

---

# 46. Testing

Implement backend tests for:

## Authentication

* Valid registration.
* Invalid admission number.
* Duplicate admission number.
* Invalid OTP.
* Valid OTP.
* Login.
* Token refresh.
* Unauthorized requests.

## Rides

* Create ride.
* Invalid vehicle.
* Past departure time.
* Search rides.
* Cancel ride.
* Start ride.
* Complete ride.

## Requests

* Create request.
* Duplicate request.
* Request own ride.
* Accept request.
* Reject request.
* No available seats.

## Authorization

Verify users cannot:

* Modify another user's ride.
* Accept another user's ride requests.
* Access another ride's chat.
* Modify another user's emergency contacts.
* Access another user's private information.

## Tracking

Test:

* Valid tracking token.
* Expired tracking token.
* Revoked tracking token.
* Completed ride.
* WebSocket connection.
* Location updates.

## SOS

Test:

* SOS event creation.
* Location capture.
* Emergency contact selection.
* Configured actions.
* Live tracking activation.

---

# 47. MVP Development Phases

Build in this order.

## Phase 1 — Foundation

```text
Project setup
PostgreSQL
PostGIS
Redis
Django
Django REST Framework
JWT
Student verification
Authentication
```

## Phase 2 — Core Carpool

```text
Profile
Vehicles
Create ride
Search rides
Ride details
Ride requests
Bookings
Ride lifecycle
Ride history
```

## Phase 3 — Communication

```text
Django Channels
Redis
WebSocket chat
Notifications
```

## Phase 4 — Safety

```text
Emergency contacts
SOS configuration
SOS events
Live location
Shareable tracking
Tracking WebSocket
```

## Phase 5 — Reputation

```text
Points
Ratings
Reports
```

## Phase 6 — UI Refinement

Use the supplied reference screenshot to refine:

```text
Colors
Typography
Spacing
Cards
Buttons
Navigation
Animations
Empty states
Loading states
Error states
```

---

# 48. MVP Non-Goals

Do not implement these in the MVP:

* Payment gateway.
* In-app wallet.
* AI chatbot.
* AI ride recommendations.
* Video calling.
* Voice calling.
* Multiple colleges.
* Corporate users.
* Subscription system.
* Advanced gamification.
* Recurring rides.
* Advanced route optimization.
* Complex pricing algorithms.

Keep the architecture extensible enough that these can be added later.

---

# 49. Definition of Done

The MVP is complete when the following real-device workflow works end-to-end:

```text
Student A
    ↓
Registers
    ↓
Verifies college identity
    ↓
Logs in
    ↓
Adds vehicle
    ↓
Creates ride
    ↓
Student B
    ↓
Registers and verifies
    ↓
Searches for ride
    ↓
Views ride details
    ↓
Requests a seat
    ↓
Student A accepts
    ↓
Booking confirmed
    ↓
A ↔ B chat
    ↓
Student A starts ride
    ↓
B shares live ride
    ↓
Parent/friend opens tracking link
    ↓
Live location updates through WebSocket
    ↓
Student can trigger SOS
    ↓
Configured emergency workflow executes
    ↓
Ride completed
    ↓
Points awarded
    ↓
A and B rate each other
    ↓
Ride appears in history
```

If this complete workflow works reliably on a real mobile device and the backend correctly enforces all permissions and state transitions, the MVP is considered complete.

---

# 50. Implementation Principles

1. **Backend is the source of truth.**
   Never trust client-side validation for authorization, seat counts, points, ride status, or verification.

2. **Do not over-engineer the MVP.**
   Build only the functionality specified here.

3. **Keep business logic modular.**
   Avoid massive views, serializers, or components.

4. **Use database constraints and transactions.**
   Especially for bookings, seats, points, and ride state.

5. **Do not store unnecessary location history.**

6. **Security and privacy are first-class requirements.**
   Especially for live tracking and SOS.

7. **Use TypeScript strictly on mobile.**
   Avoid `any` unless there is a documented reason.

8. **Create reusable UI components.**
   The reference screenshot should become the foundation of the application's design system.

9. **Don't build placeholder architecture that will immediately need to be rewritten.**

10. **Build incrementally and keep the application runnable after every phase.**

---

# 51. First Implementation Task

Before implementing individual features:

### Backend

Set up:

```text
Django
Django REST Framework
PostgreSQL
PostGIS
Redis
Django Channels
JWT
CORS
Environment configuration
```

Create the initial Django apps:

```text
accounts
vehicles
rides
chat
tracking
safety
rewards
notifications
```

### Mobile

Set up:

```text
React Native
Expo
TypeScript
Navigation
Secure token storage
API client
Environment configuration
Base component system
```

Do not implement all screens immediately.

First establish the application architecture and authentication flow.

Then implement the MVP phases sequentially.

---

# 52. UI Reference Instruction

A reference screenshot will be provided separately.

Treat that screenshot as the **primary visual reference** for the application.

The screenshot represents the desired visual language rather than necessarily representing a complete functional screen specification.

Use it to establish:

* Overall aesthetic.
* Color palette.
* Typography.
* Spacing system.
* Component shapes.
* Navigation style.
* Cards.
* Buttons.
* Inputs.
* Icons.
* Visual hierarchy.

For screens not represented in the screenshot, create new layouts that are visually consistent with the reference.

Do not blindly copy the screenshot's content when the content conflicts with the functional requirements above.

The application should feel like one product designed by one designer.

---

# 53. Documentation

Maintain:

```text
README.md
docs/MVP_REQUIREMENTS.md
```

README should contain:

* Project overview.
* Architecture.
* Tech stack.
* Local setup.
* Environment variables.
* Running backend.
* Running mobile app.
* Running tests.

Document important architectural decisions as the project evolves.

Do not generate large amounts of unnecessary documentation.

---

# Final Expected MVP

The final product should feel like a real **college-only carpooling application**, not simply a collection of CRUD screens.

The core differentiators are:

```text
College-only verification
        +
Ride booking
        +
Real-time chat
        +
Live ride sharing
        +
SOS/emergency workflow
        +
Points/reputation
        +
Geospatial foundation
```

The first priority is correctness of the complete ride lifecycle and secure access control. Visual polish comes after the underlying workflow is reliable.
