import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CmaService {
  private baseUrl = 'http://localhost:8080/api/cma';

  constructor(private http: HttpClient) {}

  // Buscar
  //search(query: string) {
   // return this.http.get<any>(`${this.baseUrl}/search?q=${query}`);
 // }

  // Detalle por ID (ej: 1964.351)
  getById(id: string) {
    return this.http.get<any>(`${this.baseUrl}/artwork/${id}`);
  }

  // cma.service.ts
search(term: string, limit = 2) {
  // CMA público: /search?has_image=1&q=...
  // Tu backend probablemente expone un proxy tipo /api/cma/search
  return this.http.get<any>(
    `http://localhost:8080/api/cma/search`,
    { params: { q: term, has_image: 1 as any, limit: limit as any } }
  );
}
}
