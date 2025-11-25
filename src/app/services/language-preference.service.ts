import { Injectable, computed, effect, signal } from '@angular/core';

export type SupportedLanguage = 'es' | 'en' | 'fr';

@Injectable({ providedIn: 'root' })
export class LanguagePreferenceService {
  private readonly storageKey = 'museai.language';
  private readonly userSetKey = 'museai.language.set';
  private readonly supported: SupportedLanguage[] = ['es', 'en', 'fr'];

  private readonly languageSignal = signal<SupportedLanguage>(this.loadInitialLanguage());

  readonly language = computed(() => this.languageSignal());

  constructor() {
    effect(() => {
      const lang = this.languageSignal();
      localStorage.setItem(this.storageKey, lang);
    });
  }

  setLanguage(lang: string): void {
    if (!this.isSupported(lang)) {
      return;
    }
    localStorage.setItem(this.userSetKey, 'true');
    this.languageSignal.set(lang as SupportedLanguage);
  }

  supportedLanguages(): SupportedLanguage[] {
    return this.supported;
  }

  hasUserSelection(): boolean {
    return localStorage.getItem(this.userSetKey) === 'true';
  }

  private isSupported(lang: string): lang is SupportedLanguage {
    return this.supported.includes(lang as SupportedLanguage);
  }

  private loadInitialLanguage(): SupportedLanguage {
    const stored = localStorage.getItem(this.storageKey);
    if (stored && this.isSupported(stored)) {
      return stored;
    }
    return 'es';
  }
}
