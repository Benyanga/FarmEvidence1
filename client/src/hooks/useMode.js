import { isResearchSetup } from '../utils/constants';

/** Derives 'farmer' | 'research' mode from a setup's setupType. See ARCHITECTURE.md §4.2. */
export default function useMode(setup) {
  if (!setup) return null;
  return isResearchSetup(setup.setupType) ? 'research' : 'farmer';
}
