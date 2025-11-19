
export interface Sculpture {
  id: string;
  name: string;
  description?: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  sceneJson: string; 
  slug?: string | null;
  materialPreset?: MaterialPreset;
  brushPreset?: SculptBrush;
  symmetry?: SculptSymmetry;
  workspace?: SculptWorkspaceSettings;
}


export interface SculptorDisplayToggles {
  grid: boolean;
  axes: boolean;
  lights: boolean;
  snapToGround?: boolean;
}


export type SculptBrush =
  | 'none'
  | 'grab'
  | 'inflate'
  | 'smooth'
  | 'pinch'
  | 'flatten'
  | 'crease';


export type SculptSymmetry = 'none' | 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz';

export type MaterialPreset = 'clay' | 'metal' | 'glass' | 'matte' | 'wireframe';


export interface SculptWorkspaceSettings {
  activeBrush: SculptBrush;
  brushRadius: number;
  brushStrength: number;
  symmetry: SculptSymmetry;
  material: MaterialPreset;
  snapToGround: boolean;
}

export interface SculptureMetadataPayload {
  version: number;
  workspace?: SculptWorkspaceSettings;
}
