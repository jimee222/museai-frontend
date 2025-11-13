import type { SculptBrush } from './sculpture';

// Shared type unions for sculpting tool interactions.
export { SculptBrush };
export type BooleanMode = 'none' | 'union' | 'subtract';
export type ModifierAction = 'subdivide' | 'bevel';
