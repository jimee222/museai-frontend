// Core sculpture metadata persisted in localStorage.
export interface Sculpture {
  id: string;
  name: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  sceneJson: string; // Result of THREE.Scene.toJSON()
}

// Scene display options that can be bound to toolbar toggles.
export interface SculptorDisplayToggles {
  grid: boolean;
  axes: boolean;
  lights: boolean;
}
