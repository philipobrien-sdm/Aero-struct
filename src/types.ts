/**
 * Standard output format for aviation regulatory documents
 */
export interface ProcessedProvision {
  document: string;
  chapter: string;
  section: string;
  subsection: string;
  heading: string;
  text: string;
  provision_type: 'requirement' | 'recommendation' | 'permission' | 'definition' | 'guidance' | 'unknown';
  regulatory_strength: 'mandatory' | 'recommended' | 'optional' | 'informational';
  domain: 'CNS' | 'ATM' | 'OPS' | 'AERODROME' | 'GENERAL';
  topics: string[];
  confidence: 'high' | 'medium' | 'low';
}

export type LLMProvider = 'gemini' | 'local';

export interface AppSettings {
  provider: LLMProvider;
  localBaseUrl: string;
  localModelName: string;
}

export interface DocumentChunk {
  id: string;
  rawText: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  result?: ProcessedProvision;
  error?: string;
}
