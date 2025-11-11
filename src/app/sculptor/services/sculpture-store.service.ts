import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Scene } from 'three';
import { Sculpture } from '../models/sculpture';

const STORAGE_KEY = 'sculptor.gallery.v1';

// Provides CRUD operations against localStorage for persisted sculptures.
@Injectable({ providedIn: 'root' })
export class SculptureStoreService {
  private readonly sculpturesSubject = new BehaviorSubject<Sculpture[]>(this.readFromStorage());
  readonly sculptures$ = this.sculpturesSubject.asObservable();

  saveFromScene(scene: Scene, name: string, tags: string[] = []): Sculpture {
    const now = new Date().toISOString();
    const sculpture: Sculpture = {
      id: crypto.randomUUID?.() ?? `${Date.now()}`,
      name: name.trim() || 'Untitled Sculpture',
      tags,
      createdAt: now,
      updatedAt: now,
      sceneJson: JSON.stringify(scene.toJSON()),
    };
    const next = [...this.sculpturesSubject.value, sculpture];
    this.persist(next);
    return sculpture;
  }

  updateScene(id: string, scene: Scene): Sculpture | null {
    const existing = this.sculpturesSubject.value.find((item) => item.id === id);
    if (!existing) {
      return null;
    }
    const updated: Sculpture = {
      ...existing,
      updatedAt: new Date().toISOString(),
      sceneJson: JSON.stringify(scene.toJSON()),
    };
    const next = this.sculpturesSubject.value.map((item) => (item.id === id ? updated : item));
    this.persist(next);
    return updated;
  }

  remove(id: string): void {
    const next = this.sculpturesSubject.value.filter((item) => item.id !== id);
    this.persist(next);
  }

  loadSceneJson(id: string): string | null {
    return this.sculpturesSubject.value.find((item) => item.id === id)?.sceneJson ?? null;
  }

  private persist(items: Sculpture[]): void {
    this.sculpturesSubject.next(items);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  private readFromStorage(): Sculpture[] {
    try {
      const payload = localStorage.getItem(STORAGE_KEY);
      if (!payload) {
        return [];
      }
      const parsed: Sculpture[] = JSON.parse(payload);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
