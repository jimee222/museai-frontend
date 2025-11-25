export interface TranslationRequest {
  artworkId: string;
  originalText: string;
  sourceLanguage: 'auto' | 'es' | 'en' | 'fr';
  targetLanguage: 'es' | 'en' | 'fr';
}

export interface TranslationResponse {
  artworkId: string;
  targetLanguage: TranslationRequest['targetLanguage'];
  translatedText: string;
}

export interface RawTranslationResponse {
  artworkId: string;
  targetLanguage: TranslationRequest['targetLanguage'];
  translatedText?: string;
  translation?: string;
  data?: RawTranslationResponse;
}
