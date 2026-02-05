import {
  JSONParseError,
  JSONValue,
  TypeValidationError,
} from '@ai-sdk/provider';
import { decode } from '@toon-format/toon';
import { safeValidateTypes, validateTypes } from './validate-types';
import { FlexibleSchema } from './schema';
import { ParseResult } from './parse-json';

/**
 * Parses a TOON string into an unknown object.
 *
 * @param text - The TOON string to parse.
 * @returns {JSONValue} - The parsed JSON object.
 */
export async function parseToon(options: {
  text: string;
  schema?: undefined;
}): Promise<JSONValue>;
/**
 * Parses a TOON string into a strongly-typed object using the provided schema.
 *
 * @template T - The type of the object to parse the TOON into.
 * @param {string} text - The TOON string to parse.
 * @param {Validator<T>} schema - The schema to use for parsing the TOON.
 * @returns {Promise<T>} - The parsed object.
 */
export async function parseToon<T>(options: {
  text: string;
  schema: FlexibleSchema<T>;
}): Promise<T>;
export async function parseToon<T>({
  text,
  schema,
}: {
  text: string;
  schema?: FlexibleSchema<T>;
}): Promise<T> {
  try {
    const value = secureToonParse(text);

    if (schema == null) {
      return value as T;
    }

    return validateTypes<T>({ value, schema });
  } catch (error) {
    if (
      JSONParseError.isInstance(error) ||
      TypeValidationError.isInstance(error)
    ) {
      throw error;
    }

    throw new JSONParseError({ text, cause: error });
  }
}

/**
 * Safely parses a TOON string and returns the result as an object of type `unknown`.
 *
 * @param text - The TOON string to parse.
 * @returns {Promise<object>} Either an object with `success: true` and the parsed data, or an object with `success: false` and the error that occurred.
 */
export async function safeParseToon(options: {
  text: string;
  schema?: undefined;
}): Promise<ParseResult<JSONValue>>;
/**
 * Safely parses a TOON string into a strongly-typed object, using a provided schema to validate the object.
 *
 * @template T - The type of the object to parse the TOON into.
 * @param {string} text - The TOON string to parse.
 * @param {Validator<T>} schema - The schema to use for parsing the TOON.
 * @returns An object with either a `success` flag and the parsed and typed data, or a `success` flag and an error object.
 */
export async function safeParseToon<T>(options: {
  text: string;
  schema: FlexibleSchema<T>;
}): Promise<ParseResult<T>>;
export async function safeParseToon<T>({
  text,
  schema,
}: {
  text: string;
  schema?: FlexibleSchema<T>;
}): Promise<ParseResult<T>> {
  try {
    const value = secureToonParse(text);

    if (schema == null) {
      return { success: true, value: value as T, rawValue: value };
    }

    return await safeValidateTypes<T>({ value, schema });
  } catch (error) {
    return {
      success: false,
      error: JSONParseError.isInstance(error)
        ? error
        : new JSONParseError({ text, cause: error }),
      rawValue: undefined,
    };
  }
}

export function isParsableToon(input: string): boolean {
  try {
    secureToonParse(input);
    return true;
  } catch {
    return false;
  }
}

const suspectProtoRx = /"__proto__"\s*:/;
const suspectConstructorRx = /"constructor"\s*:/;

function filter(obj: unknown): unknown {
  let next = [obj];

  while (next.length) {
    const nodes = next;
    next = [];

    for (const node of nodes) {
      if (node === null || typeof node !== 'object') {
        continue;
      }

      if (Object.prototype.hasOwnProperty.call(node, '__proto__')) {
        throw new SyntaxError('Object contains forbidden prototype property');
      }

      if (
        Object.prototype.hasOwnProperty.call(node, 'constructor') &&
        Object.prototype.hasOwnProperty.call(
          (node as Record<string, unknown>).constructor,
          'prototype',
        )
      ) {
        throw new SyntaxError('Object contains forbidden prototype property');
      }

      for (const key in node as Record<string, unknown>) {
        const value = (node as Record<string, unknown>)[key];
        if (value && typeof value === 'object') {
          next.push(value);
        }
      }
    }
  }
  return obj;
}

/**
 * Securely parse TOON string, preventing prototype pollution attacks.
 */
function secureToonParse(text: string): JSONValue {
  const obj = decode(text) as JSONValue;

  // Ignore null and non-objects
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Check for prototype pollution attempts in the original text
  // TOON encodes values that could contain these patterns
  if (
    suspectProtoRx.test(text) === false &&
    suspectConstructorRx.test(text) === false
  ) {
    return obj;
  }

  // Scan result for proto keys
  return filter(obj) as JSONValue;
}
