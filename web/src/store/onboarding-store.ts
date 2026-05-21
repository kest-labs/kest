import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createSelectors } from './utils/selectors';

interface OnboardingState {
  hasCreatedFirstWorkspace: boolean;
  hasCompletedTour: boolean;
  hasDismissedHelpHint: boolean;
  hasSeenCommandPaletteHint: boolean;

  markFirstWorkspaceCreated: () => void;
  markTourCompleted: () => void;
  dismissHelpHint: () => void;
  markCommandPaletteHintSeen: () => void;
  reset: () => void;
}

const defaultState = {
  hasCreatedFirstWorkspace: false,
  hasCompletedTour: false,
  hasDismissedHelpHint: false,
  hasSeenCommandPaletteHint: false,
};

const useOnboardingStoreBase = create<OnboardingState>()(
  persist(
    (set) => ({
      ...defaultState,
      markFirstWorkspaceCreated: () => set({ hasCreatedFirstWorkspace: true }),
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
