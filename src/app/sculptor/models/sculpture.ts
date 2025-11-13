// Core sculpture metadata persisted in localStorage.
export interface Sculpture {
  id: string;
  name: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  sceneJson: string; // Result of THREE.Scene.toJSON()
  materialPreset?: MaterialPreset;
  brushPreset?: SculptBrush;
  symmetry?: SculptSymmetry;
  workspace?: SculptWorkspaceSettings;
}

// Scene display options that can be bound to toolbar toggles.
export interface SculptorDisplayToggles {
  grid: boolean;
  axes: boolean;
  lights: boolean;
  snapToGround?: boolean;
}

// Brush presets supported by the sandbox.
export type SculptBrush =
  | 'none'
  | 'grab'
  | 'inflate'
  | 'smooth'
  | 'pinch'
  | 'flatten'
  | 'crease';

// Symmetry axes mirror strokes while sculpting.
export type SculptSymmetry = 'none' | 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz';

export type MaterialPreset = 'clay' | 'metal' | 'glass' | 'matte' | 'wireframe';

// Workspace settings persisted per sculpture.
export interface SculptWorkspaceSettings {
  activeBrush: SculptBrush;
  brushRadius: number;
  brushStrength: number;
  symmetry: SculptSymmetry;
  material: MaterialPreset;
  snapToGround: boolean;
}
