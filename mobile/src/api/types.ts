/** Shared API response types (mirrors the backend serializers). */

export type StudentProfile = {
  id: string;
  name: string;
  admission_number: string;
  college_email: string;
  department: string;
  year: number;
  year_display: string;
  phone_number: string;
  profile_image: string | null;
  total_points: number;
  completed_rides: number;
  average_rating: string;
  created_at: string;
};

export type CurrentUser = {
  id: string;
  email: string;
  is_verified: boolean;
  date_joined: string;
  profile: StudentProfile | null;
};

export type TokenPair = {
  access: string;
  refresh: string;
};

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type VehicleType = 'BIKE' | 'CAR';

export type Vehicle = {
  id: string;
  vehicle_type: VehicleType;
  vehicle_type_display: string;
  brand: string;
  model: string;
  registration_number: string;
  color: string;
  seat_capacity: number;
  is_active: boolean;
  created_at: string;
};

export type VehicleSummary = {
  id: string;
  vehicle_type: VehicleType;
  vehicle_type_display: string;
  brand: string;
  model: string;
  color: string;
  registration_number: string;
};

export type DriverSummary = {
  id: string;
  name: string;
  department: string;
  year: number;
  profile_image: string | null;
  average_rating: string;
  completed_rides: number;
};

export type RideStatus = 'OPEN' | 'FULL' | 'STARTED' | 'COMPLETED' | 'CANCELLED';
export type RideRequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
export type BookingStatus = 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export type RideListItem = {
  id: string;
  driver: DriverSummary;
  vehicle: VehicleSummary;
  origin: string;
  destination: string;
  departure_time: string;
  available_seats: number;
  total_seats: number;
  contribution_amount: string | null;
  status: RideStatus;
  distance_m: number | null;
  role: 'driver' | 'passenger' | null;
};

export type RideDetail = RideListItem & {
  origin_latitude: number;
  origin_longitude: number;
  destination_latitude: number;
  destination_longitude: number;
  notes: string;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  is_driver: boolean;
  my_request_status: RideRequestStatus | null;
  my_booking_status: BookingStatus | null;
};

export type RideRequest = {
  id: string;
  ride: string;
  rider: DriverSummary;
  status: RideRequestStatus;
  created_at: string;
  updated_at: string;
};

export type Booking = {
  id: string;
  ride: RideListItem;
  status: BookingStatus;
  created_at: string;
  cancelled_at: string | null;
  completed_at: string | null;
};

export type RideHistory = {
  upcoming: RideListItem[];
  active: RideListItem[];
  completed: RideListItem[];
  cancelled: RideListItem[];
};

export type ChatMessage = {
  id: string;
  conversation: string;
  sender_id: string;
  message: string;
  is_mine: boolean;
  created_at: string;
  read_at: string | null;
};

export type ConversationParticipant = {
  id: string;
  name: string;
  profile_image: string | null;
};

export type Conversation = {
  id: string;
  ride_id: string;
  origin: string;
  destination: string;
  ride_status: RideStatus;
  last_message: ChatMessage | null;
  unread_count: number;
  /** Everyone else in this conversation — never includes the caller. A ride
   * with multiple confirmed passengers shares one conversation, so this can
   * have more than one entry. */
  other_participants: ConversationParticipant[];
  created_at: string;
};

export type NotificationType =
  | 'RIDE_REQUEST_RECEIVED'
  | 'RIDE_REQUEST_ACCEPTED'
  | 'RIDE_REQUEST_REJECTED'
  | 'RIDE_CANCELLED'
  | 'NEW_MESSAGE'
  | 'RIDE_STARTING'
  | 'RIDE_COMPLETED'
  | 'POINTS_AWARDED'
  | 'RATING_AVAILABLE';

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
};

export type EmergencyContact = {
  id: string;
  name: string;
  phone_number: string;
  relationship: string;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
};

export type SOSConfig = {
  call_primary_contact: boolean;
  send_emergency_message: boolean;
  share_live_location: boolean;
  notify_selected_contacts: boolean;
  notify_college_security: boolean;
  custom_message: string;
};

export type SOSActions = {
  call: { name: string; phone_number: string } | null;
  message: string | null;
  recipients: Pick<EmergencyContact, 'id' | 'name' | 'phone_number' | 'is_primary' | 'relationship'>[];
  tracking_link: string;
  notify_college_security: boolean;
};

export type SOSEvent = {
  id: string;
  ride_id: string | null;
  latitude: number | null;
  longitude: number | null;
  triggered_at: string;
  status: 'TRIGGERED' | 'RESOLVED' | 'CANCELLED';
  context: Record<string, unknown>;
  created_at: string;
};

export type ShareSession = {
  id: string;
  ride_id: string;
  share_token: string;
  share_url: string;
  expires_at: string;
  is_active: boolean;
  created_at: string;
  ended_at: string | null;
};

export type PointsTransactionType = 'DRIVER_COMPLETION' | 'PASSENGER_COMPLETION' | 'ADJUSTMENT';

export type PointsTransaction = {
  id: string;
  ride_id: string | null;
  points: number;
  transaction_type: PointsTransactionType;
  description: string;
  created_at: string;
};

export type PointsSummary = {
  total_points: number;
  completed_rides: number;
  average_rating: string;
};

export type Rating = {
  id: string;
  ride_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment: string;
  created_at: string;
};

export type RateableParticipant = {
  user_id: string;
  name: string;
  role: 'driver' | 'passenger';
  already_rated: boolean;
};

export type ReportReason =
  | 'UNSAFE_BEHAVIOR'
  | 'HARASSMENT'
  | 'FAKE_PROFILE'
  | 'VEHICLE_MISMATCH'
  | 'INAPPROPRIATE_BEHAVIOR'
  | 'OTHER';

export type ReportStatus = 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED';

export type Report = {
  id: string;
  reported_user: string | null;
  ride: string | null;
  reason: ReportReason;
  description: string;
  status: ReportStatus;
  created_at: string;
};
