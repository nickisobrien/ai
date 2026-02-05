import { JSONValue } from '@ai-sdk/provider';
import { safeParseToon } from '@ai-sdk/provider-utils';

/**
 * Attempts to parse partial TOON text, which may be incomplete during streaming.
 *
 * TOON is a line-based format, so we can attempt to parse complete lines
 * and fall back by removing incomplete trailing content.
 */
export async function parsePartialToon(
  toonText: string | undefined,
): Promise<{
  value: JSONValue | undefined;
  state:
    | 'undefined-input'
    | 'successful-parse'
    | 'repaired-parse'
    | 'failed-parse';
}> {
  if (toonText === undefined) {
    return { value: undefined, state: 'undefined-input' };
  }

  // Try parsing the full text first
  let result = await safeParseToon({ text: toonText });

  if (result.success) {
    return { value: result.value, state: 'successful-parse' };
  }

  // Try removing incomplete trailing content
  // TOON is line-based, so we can try removing the last incomplete line
  const repairedText = repairPartialToon(toonText);
  if (repairedText !== null && repairedText !== toonText) {
    result = await safeParseToon({ text: repairedText });

    if (result.success) {
      return { value: result.value, state: 'repaired-parse' };
    }
  }

  return { value: undefined, state: 'failed-parse' };
}

/**
 * Attempts to repair partial TOON by removing incomplete trailing content.
 */
function repairPartialToon(text: string): string | null {
  if (!text || text.trim().length === 0) {
    return null;
  }

  // TOON is whitespace-sensitive and line-based
  // Try to find a valid stopping point by removing incomplete lines

  const lines = text.split('\n');

  // Start from the end and try removing lines until we get valid TOON
  for (let i = lines.length; i >= 0; i--) {
    const partialLines = lines.slice(0, i);
    const candidate = partialLines.join('\n').trimEnd();

    if (candidate.length === 0) {
      continue;
    }

    // Check if the last line looks complete
    // In TOON, a complete value line ends with a value (string, number, boolean)
    // or a complete structure indicator
    const lastLine = partialLines[partialLines.length - 1];

    // Skip if the line appears incomplete (ends mid-string, etc.)
    if (lastLine !== undefined && looksComplete(lastLine)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Checks if a TOON line looks complete.
 */
function looksComplete(line: string): boolean {
  const trimmed = line.trimEnd();

  // Empty lines are complete
  if (trimmed.length === 0) {
    return true;
  }

  // Lines ending with array headers are complete (e.g., "items[3]{id, name}:")
  if (trimmed.endsWith(':')) {
    return true;
  }

  // Lines that are just values (indented content) should end with complete values
  // This is a heuristic - if it doesn't end with an unclosed quote, it's probably complete
  const quoteCount = (trimmed.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    return false; // Unclosed string
  }

  return true;
}
