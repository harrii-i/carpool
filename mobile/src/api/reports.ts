import { api } from './client';
import { Paginated, Report, ReportReason } from './types';

export type CreateReportPayload = {
  reported_user?: string;
  ride?: string;
  reason: ReportReason;
  description?: string;
};

export const reportsApi = {
  async create(payload: CreateReportPayload): Promise<Report> {
    const { data } = await api.post<Report>('/reports/', payload);
    return data;
  },

  async list(): Promise<Report[]> {
    const { data } = await api.get<Paginated<Report>>('/reports/');
    return data.results;
  },
};
