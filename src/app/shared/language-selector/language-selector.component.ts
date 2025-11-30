import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  LanguagePreferenceService,
  SupportedLanguage,
} from '../../services/language-preference.service';

@Component({
  selector: 'app-language-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './language-selector.component.html',
  styleUrl: './language-selector.component.css',
})
export class LanguageSelectorComponent implements OnInit {
  isModalOpen = false;
  selectedLanguage!: SupportedLanguage;
  readonly languages: SupportedLanguage[] = [];

  constructor(private readonly languagePreference: LanguagePreferenceService) {}

  ngOnInit(): void {
    this.selectedLanguage = this.languagePreference.language();
    this.languages.push(...this.languagePreference.supportedLanguages());

    if (!this.languagePreference.hasUserSelection()) {
      this.isModalOpen = true;
    }
  }

  openModal(): void {
    this.isModalOpen = true;
  }

  selectLanguage(lang: SupportedLanguage): void {
    this.languagePreference.setLanguage(lang);
    this.selectedLanguage = lang;
    this.isModalOpen = false;
  }
}
