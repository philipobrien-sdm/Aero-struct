import { DocumentChunk } from "../types";

/**
 * Intelligent chunker for aviation regulatory text.
 * It tries to identify hierarchical structures like:
 * 1.1, 1.1.1, Note 1, Chapter 2
 */
export function chunkAviationText(rawText: string): DocumentChunk[] {
  // Normalize line endings and remove excess whitespace
  const normalized = rawText.replace(/\r\n/g, "\n").trim();
  
  // Pattern to find start of new sections or notes
  // Matches:
  // - "1. Historical background"
  // - "1.1 The Procedures..."
  // - "Note 1. — ..."
  // - "Chapter 1" (at start of line)
  const lines = normalized.split('\n');
  const chunks: string[] = [];
  let currentChunk: string[] = [];

  const isNewSection = (line: string) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return false;

    // Matches numbers at start like 1.1, 2.3.4, or single digit like 7.
    const sectionPattern =/^(\d+(\.\d+)*)\s/;
    // Matches Chapter/Note/Foreword/Table/Appendix at start
    const wordPattern = /^(Chapter\s\d+|Note\s\d+|Note\.|Foreword|Table\s[A-Z]|Appendix\s\d+)/i;

    return sectionPattern.test(trimmedLine) || wordPattern.test(trimmedLine);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (isNewSection(line) && currentChunk.length > 0) {
      // Save previous chunk
      chunks.push(currentChunk.join('\n').trim());
      currentChunk = [];
    }
    
    currentChunk.push(line);
  }

  // Push final chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n').trim());
  }

  // Filter out very small or invalid chunks
  return chunks
    .filter(c => c.length > 10)
    .map((text, index) => ({
      id: `chunk-${index}-${Date.now()}`,
      rawText: text,
      status: 'pending'
    }));
}
