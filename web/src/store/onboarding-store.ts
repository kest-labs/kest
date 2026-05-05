import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createSelectors } from './utils/selectors';

interface OnboardingState {
  hasCreatedFirstProject: boolean;
  hasCompletedTour: boolean;
  hasDismissedHelpHint: boolean;
  hasSeenCommandPaletteHint: boolean;

  markFirstProjectCreated: () => void;
  markTourCompleted: () => void;
  dismissHelpHint: () => void;
  markCommandPaletteHintSeen: () => void;
  reset: () => void;
}

const defaultState = {
  hasCreatedFirstProject: false,
  hasCompletedTour: false,
  hasDismissedHelpHint: false,
  hasSeenCommandPaletteHint: false,
};

const useOnboardingStoreBase = create<OnboardingState>()(
  persist(
    (set) => ({
      ...defaultState,
      markFirstProjectCreated: () => set({ hasCreatedFirstProject: true }),
      markTourCompleted: () => set({ hasCompletedTour: true }),
      dismissHelpHint: () => set({ hasDismissedHelpHint: true }),
      markCommandPaletteHintSeen: () => set({ hasSeenCommandPaletteHint: true }),
      reset: () => set(defaultState),
    }),
    {
      name: 'onboarding-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export const useOnboardingStore = createSelectors(useOnboardingStoreBase);
