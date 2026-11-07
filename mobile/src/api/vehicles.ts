import { api } from './client';
import { Paginated, Vehicle, VehicleType } from './types';

export type VehiclePayload = {
  vehicle_type: VehicleType;
  brand: string;
  model: string;
  registration_number: string;
  color: string;
  seat_capacity: number;
};

export const vehiclesApi = {
  async list(): Promise<Vehicle[]> {
    const { data } = await api.get<Paginated<Vehicle>>('/vehicles/');
    return data.results;
  },

  async create(payload: VehiclePayload): Promise<Vehicle> {
    const { data } = await api.post<Vehicle>('/vehicles/', payload);
    return data;
  },

  async deactivate(id: string): Promise<Vehicle> {
    const { data } = await api.post<Vehicle>(`/vehicles/${id}/deactivate/`);
    return data;
  },

  async activate(id: string): Promise<Vehicle> {
    const { data } = await api.post<Vehicle>(`/vehicles/${id}/activate/`);
    return data;
  },
};
