import { describe, it, expect } from 'vitest';
import { parseToon, safeParseToon, isParsableToon } from './parse-toon';
import { z } from 'zod/v4';
import { JSONParseError, TypeValidationError } from '@ai-sdk/provider';

describe('parseToon', () => {
  it('should parse basic TOON without schema', async () => {
    const toon = 'foo: bar';
    const result = await parseToon({ text: toon });
    expect(result).toEqual({ foo: 'bar' });
  });

  it('should parse TOON with nested objects', async () => {
    const toon = `user:
  name: John
  age: 30`;
    const result = await parseToon({ text: toon });
    expect(result).toEqual({ user: { name: 'John', age: 30 } });
  });

  it('should parse TOON with arrays', async () => {
    const toon = 'items[2]: apple,banana';
    const result = await parseToon({ text: toon });
    expect(result).toEqual({ items: ['apple', 'banana'] });
  });

  it('should parse TOON with schema validation', async () => {
    const schema = z.object({ name: z.string() });
    const toon = 'name: John';
    const result = await parseToon({ text: toon, schema });
    expect(result).toEqual({ name: 'John' });
  });

  it('should throw TypeValidationError for schema validation failures', async () => {
    const schema = z.object({ count: z.number() });
    const toon = 'count: not a number';
    await expect(() => parseToon({ text: toon, schema })).rejects.toThrow(
      TypeValidationError,
    );
  });
});

describe('safeParseToon', () => {
  it('should safely parse basic TOON without schema and include rawValue', async () => {
    const toon = 'foo: bar';
    const result = await safeParseToon({ text: toon });
    expect(result).toEqual({
      success: true,
      value: { foo: 'bar' },
      rawValue: { foo: 'bar' },
    });
  });

  it('should preserve rawValue even after schema transformation', async () => {
    const schema = z.object({
      count: z.coerce.number(),
    });
    const toon = 'count: 42';
    const result = await safeParseToon({
      text: toon,
      schema,
    });

    expect(result).toEqual({
      success: true,
      value: { count: 42 },
      rawValue: { count: 42 },
    });
  });

  it('should handle schema validation failures', async () => {
    const schema = z.object({ age: z.number() });
    const toon = 'age: twenty';
    const result = await safeParseToon({
      text: toon,
      schema,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(TypeValidationError);
    }
  });

  it('should handle arrays of objects', async () => {
    const toon = `users[2]{id,name}:
  1,Alice
  2,Bob`;
    const result = await safeParseToon({ text: toon });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toEqual({
        users: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ],
      });
    }
  });

  it('should handle boolean values', async () => {
    const toon = `active: true
disabled: false`;
    const result = await safeParseToon({ text: toon });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toEqual({ active: true, disabled: false });
    }
  });

  it('should handle null values', async () => {
    const toon = 'data: null';
    const result = await safeParseToon({ text: toon });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toEqual({ data: null });
    }
  });
});

describe('isParsableToon', () => {
  it('should return true for valid TOON', () => {
    expect(isParsableToon('foo: bar')).toBe(true);
    expect(isParsableToon('items[2]: 1,2')).toBe(true);
    expect(isParsableToon('name: hello')).toBe(true);
  });

  it('should return true for simple values (TOON parses almost anything)', () => {
    // TOON is lenient and parses most strings as simple values
    expect(isParsableToon('hello')).toBe(true);
  });
});
