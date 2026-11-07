import { api } from './client';
import {
  Paginated,
  PointsSummary,
  PointsTransaction,
  RateableParticipant,
  Rating,
} from './types';

export const pointsApi = {
  async list(): Promise<PointsTransaction[]> {
    const { data } = await api.get<Paginated<PointsTransaction>>('/rewards/points/');
    return data.results;
  },

  async summary(): Promise<PointsSummary> {
    const { data } = await api.get<PointsSummary>('/rewards/points/summary/');
    return data;
  },
};

export type CreateRatingPayload = {
  ride_id: string;
  reviewee_id: string;
  rating: number;
  comment?: string;
};

export const ratingsApi = {
  async create(payload: CreateRatingPayload): Promise<Rating> {
    const { data } = await api.post<Rating>('/ratings/', payload);
    return data;
  },

  async rateable(rideId: string): Promise<RateableParticipant[]> {
    const { data } = await api.get<{ participants: RateableParticipant[] }>(
      '/ratings/rateable/',
      { params: { ride: rideId } },
    );
    return data.participants;
  },
};
