import { create } from 'zustand';

import { getItem, setItem } from '@/lib/secureStore';

/**
 * The user's current app "mode" — Rider or Driver.
 *
 * This is UI state only. It is never sent to the backend and never used for
 * authorization: the backend continues to authorize ride creation purely via
 * vehicle ownership + verification (see rides/services.py::create_ride), and
 * a request/booking's per-ride role (`ride.role`, `ride.is_driver`) is a
 * separate, backend-computed concept describing the user's relationship to
 * one specific ride — it must never be confused with this global preference.
 */
export type AppMode = 'rider' | 'driver';

const MODE_KEY = 'carpool.appMode';

type AppModeState = {
  mode: AppMode;
  hydrated: boolean;
  /** Load the persisted mode on launch. New users default to 'rider'. */
  hydrate: () => Promise<void>;
  setMode: (mode: AppMode) => void;
};

export const useAppModeStore = create<AppModeState>((set) => ({
  mode: 'rider',
  hydrated: false,

  hydrate: async () => {
    const saved = await getItem(MODE_KEY);
    set({ mode: saved === 'driver' ? 'driver' : 'rider', hydrated: true });
  },

  setMode: (mode) => {
    set({ mode });
    void setItem(MODE_KEY, mode);
  },
}));
