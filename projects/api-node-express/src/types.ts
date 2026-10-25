export interface ProcessRequest {
  mode: 'glyph' | 'pixel' | 'glitch' | 'palette' | 'histogram';
  config?: Record<string, number | string | boolean>;
}

export interface ProcessResponse {
  success: boolean;
  format: string;
  processingTimeMs: number;
  data: Buffer; // image bytes
}

export interface StatsResponse {
  conversions: number;
  formats: Record<string, number>;
  avgProcessingMs: number;
}
