import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { Scene } from 'three';
import {
  Sculpture,
  SculptureMetadataPayload,
  SculptWorkspaceSettings,
} from '../models/sculpture';

interface SculptureResponseDto {
  id: string;
  name: string;
  slug?: string | null;
  tags: string[] | null;
  metadata: string | null;
  sceneJson: string;
  createdAt: string;
  updatedAt: string;
}

interface SculptureRequestDto {
  name: string;
  sceneJson: string;
  metadata: string;
  tags: string[];
  slug?: string | null;
}

// Provides CRUD operations against the backend Sculpture API.
@Injectable({ providedIn: 'root' })
export class SculptureStoreService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'api/sculptures';
  private readonly sculpturesSubject = new BehaviorSubject<Sculpture[]>([]);

  readonly sculptures$ = this.sculpturesSubject.asObservable();

  constructor() {
    void this.refresh();
  }

  async refresh(tag?: string): Promise<void> {
    try {
      const params = tag ? { tag } : undefined;
      const response = await firstValueFrom(
        this.http.get<SculptureResponseDto[]>(this.baseUrl, { params }),
      );
      this.sculpturesSubject.next(response.map((dto) => this.fromDto(dto)));
    } catch (error) {
      console.error('Failed to load sculptures', error);
    }
  }

  async saveFromScene(
    scene: Scene,
    name: string,
    tags: string[] = [],
    workspace?: SculptWorkspaceSettings,
  ): Promise<Sculpture> {
    const payload = this.buildRequestPayload(name, tags, scene, workspace);
    try {
      const dto = await firstValueFrom(this.http.post<SculptureResponseDto>(this.baseUrl, payload));
      const sculpture = this.fromDto(dto);
      this.sculpturesSubject.next([...this.sculpturesSubject.value, sculpture]);
      return sculpture;
    } catch (error) {
      console.error('Failed to save sculpture', error);
      throw error;
    }
  }

  async updateScene(
    id: string,
    scene: Scene,
    name: string,
    tags: string[] = [],
    workspace?: SculptWorkspaceSettings,
  ): Promise<Sculpture> {
    const payload = this.buildRequestPayload(name, tags, scene, workspace);
    try {
      const dto = await firstValueFrom(
        this.http.put<SculptureResponseDto>(`${this.baseUrl}/${id}`, payload),
      );
      const sculpture = this.fromDto(dto);
      this.sculpturesSubject.next(
        this.sculpturesSubject.value.map((item) => (item.id === id ? sculpture : item)),
      );
      return sculpture;
    } catch (error) {
      console.error(`Failed to update sculpture ${id}`, error);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await firstValueFrom(this.http.delete<void>(`${this.baseUrl}/${id}`));
      this.sculpturesSubject.next(this.sculpturesSubject.value.filter((item) => item.id !== id));
    } catch (error) {
      console.error(`Failed to delete sculpture ${id}`, error);
      throw error;
    }
  }

  loadSceneJson(id: string): string | null {
    return this.sculpturesSubject.value.find((item) => item.id === id)?.sceneJson ?? null;
  }

  private buildRequestPayload(
    name: string,
    tags: string[],
    scene: Scene,
    workspace?: SculptWorkspaceSettings,
  ): SculptureRequestDto {
    const metadata: SculptureMetadataPayload = {
      version: 1,
      workspace,
    };
    return {
      name: name.trim() || 'Untitled Sculpture',
      tags: tags.map((tag) => tag.trim()).filter(Boolean),
      sceneJson: JSON.stringify(scene.toJSON()),
      metadata: JSON.stringify(metadata),
    };
  }

  private fromDto(dto: SculptureResponseDto): Sculpture {
    const metadata = this.parseMetadata(dto.metadata);
    return {
      id: dto.id,
      name: dto.name,
      slug: dto.slug,
      tags: dto.tags ?? [],
      createdAt: dto.createdAt,
      updatedAt: dto.updatedAt,
      sceneJson: dto.sceneJson,
      workspace: metadata.workspace,
    };
  }

  private parseMetadata(raw: string | null): SculptureMetadataPayload {
    if (!raw) {
      return { version: 1 };
    }
    try {
      const parsed = JSON.parse(raw) as SculptureMetadataPayload;
      return parsed ?? { version: 1 };
    } catch {
      return { version: 1 };
    }
  }
}
