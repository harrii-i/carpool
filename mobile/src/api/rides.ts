import { api } from './client';
import {
  Booking,
  Paginated,
  RideDetail,
  RideHistory,
  RideListItem,
  RideRequest,
} from './types';

export type SearchParams = {
  origin_lat?: number;
  origin_lng?: number;
  destination_lat?: number;
  destination_lng?: number;
  radius_m?: number;
  date?: string;
  vehicle_type?: string;
  min_seats?: number;
};

export type CreateRidePayload = {
  vehicle_id: string;
  origin: string;
  destination: string;
  origin_latitude: number;
  origin_longitude: number;
  destination_latitude: number;
  destination_longitude: number;
  departure_time: string; // ISO
  available_seats: number;
  contribution_amount?: number | null;
  notes?: string;
};

export const ridesApi = {
  async search(params: SearchParams): Promise<RideListItem[]> {
    const { data } = await api.get<Paginated<RideListItem>>('/rides/search/', { params });
    return data.results;
  },

  async detail(id: string): Promise<RideDetail> {
    const { data } = await api.get<RideDetail>(`/rides/${id}/`);
    return data;
  },

  async create(payload: CreateRidePayload): Promise<RideDetail> {
    const { data } = await api.post<RideDetail>('/rides/', payload);
    return data;
  },

  async history(): Promise<RideHistory> {
    const { data } = await api.get<RideHistory>('/rides/history/');
    return data;
  },

  async start(id: string): Promise<RideDetail> {
    const { data } = await api.post<RideDetail>(`/rides/${id}/start/`);
    return data;
  },

  async complete(id: string): Promise<RideDetail> {
    const { data } = await api.post<RideDetail>(`/rides/${id}/complete/`);
    return data;
  },

  async cancel(id: string): Promise<RideDetail> {
    const { data } = await api.post<RideDetail>(`/rides/${id}/cancel/`);
    return data;
  },
};

export const requestsApi = {
  async create(rideId: string): Promise<RideRequest> {
    const { data } = await api.post<RideRequest>('/ride-requests/', { ride_id: rideId });
    return data;
  },

  async listForRide(rideId: string): Promise<RideRequest[]> {
    const { data } = await api.get<Paginated<RideRequest>>('/ride-requests/', {
      params: { role: 'incoming', ride: rideId },
    });
    return data.results;
  },

  /** All pending join-requests across every ride I'm driving (no ride filter). */
  async listIncoming(): Promise<RideRequest[]> {
    const { data } = await api.get<Paginated<RideRequest>>('/ride-requests/', {
      params: { role: 'incoming' },
    });
    return data.results;
  },

  async accept(id: string): Promise<Booking> {
    const { data } = await api.post<Booking>(`/ride-requests/${id}/accept/`);
    return data;
  },

  async reject(id: string): Promise<RideRequest> {
    const { data } = await api.post<RideRequest>(`/ride-requests/${id}/reject/`);
    return data;
  },

  async cancel(id: string): Promise<RideRequest> {
    const { data } = await api.post<RideRequest>(`/ride-requests/${id}/cancel/`);
    return data;
  },
};

export const bookingsApi = {
  async list(): Promise<Booking[]> {
    const { data } = await api.get<Paginated<Booking>>('/bookings/');
    return data.results;
  },

  async cancel(id: string): Promise<Booking> {
    const { data } = await api.post<Booking>(`/bookings/${id}/cancel/`);
    return data;
  },
};
