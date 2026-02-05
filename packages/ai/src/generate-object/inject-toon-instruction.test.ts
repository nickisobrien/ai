import { JSONSchema7 } from '@ai-sdk/provider';
import { injectToonInstruction } from './inject-toon-instruction';
import { describe, it, expect } from 'vitest';

const basicSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number' },
  },
  required: ['name', 'age'],
};

describe('injectToonInstruction', () => {
  it('should handle basic case with prompt and schema', () => {
    const result = injectToonInstruction({
      prompt: 'Generate a person',
      schema: basicSchema,
    });
    expect(result).toContain('Generate a person');
    expect(result).toContain('Data format: TOON');
    expect(result).toContain('Uses 2-space indentation');
    expect(result).toContain('Expected structure:');
    expect(result).toContain('name');
    expect(result).toContain('age');
    expect(result).toContain(
      'Respond with valid TOON matching the structure above',
    );
  });

  it('should handle only prompt, no schema', () => {
    const result = injectToonInstruction({
      prompt: 'Generate a person',
    });
    expect(result).toContain('Generate a person');
    expect(result).toContain('Data format: TOON');
  });

  it('should handle only schema, no prompt', () => {
    const result = injectToonInstruction({
      schema: basicSchema,
    });
    expect(result).toContain('Data format: TOON');
    expect(result).toContain('Expected structure:');
    expect(result).toContain('name');
    expect(result).toContain('age');
  });

  it('should handle no prompt, no schema', () => {
    const result = injectToonInstruction({});
    expect(result).toContain('Data format: TOON');
  });

  it('should handle empty string prompt', () => {
    const result = injectToonInstruction({
      prompt: '',
      schema: basicSchema,
    });
    expect(result).toContain('Data format: TOON');
    expect(result).toContain('name');
    expect(result).not.toMatch(/^\s*\n\n/); // Should not start with double newlines
  });

  it('should handle array schema', () => {
    const arraySchema: JSONSchema7 = {
      type: 'object',
      properties: {
        users: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              name: { type: 'string' },
            },
          },
        },
      },
    };
    const result = injectToonInstruction({
      prompt: 'Generate users',
      schema: arraySchema,
    });
    expect(result).toContain('Generate users');
    expect(result).toContain('users');
    expect(result).toContain('id');
    expect(result).toContain('name');
  });

  it('should handle nested object schema', () => {
    const nestedSchema: JSONSchema7 = {
      type: 'object',
      properties: {
        person: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            address: {
              type: 'object',
              properties: {
                street: { type: 'string' },
                city: { type: 'string' },
              },
            },
          },
        },
      },
    };
    const result = injectToonInstruction({
      schema: nestedSchema,
    });
    expect(result).toContain('person');
    expect(result).toContain('name');
    expect(result).toContain('address');
    expect(result).toContain('street');
    expect(result).toContain('city');
  });

  it('should handle enum schema', () => {
    const enumSchema: JSONSchema7 = {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'inactive', 'pending'],
        },
      },
    };
    const result = injectToonInstruction({
      schema: enumSchema,
    });
    expect(result).toContain('status');
    // The example should use the first enum value
    expect(result).toContain('active');
  });

  it('should handle const schema', () => {
    const constSchema: JSONSchema7 = {
      type: 'object',
      properties: {
        type: { const: 'user' },
        name: { type: 'string' },
      },
    };
    const result = injectToonInstruction({
      schema: constSchema,
    });
    expect(result).toContain('type');
    expect(result).toContain('user');
  });

  it('should handle boolean type', () => {
    const boolSchema: JSONSchema7 = {
      type: 'object',
      properties: {
        active: { type: 'boolean' },
      },
    };
    const result = injectToonInstruction({
      schema: boolSchema,
    });
    expect(result).toContain('active');
    expect(result).toContain('true');
  });

  it('should handle null type', () => {
    const nullSchema: JSONSchema7 = {
      type: 'object',
      properties: {
        data: { type: 'null' },
      },
    };
    const result = injectToonInstruction({
      schema: nullSchema,
    });
    expect(result).toContain('data');
    expect(result).toContain('null');
  });

  it('should handle anyOf schema', () => {
    const anyOfSchema: JSONSchema7 = {
      type: 'object',
      properties: {
        value: {
          anyOf: [{ type: 'string' }, { type: 'number' }],
        },
      },
    };
    const result = injectToonInstruction({
      schema: anyOfSchema,
    });
    expect(result).toContain('value');
    // Should use the first option (string)
    expect(result).toContain('example');
  });

  it('should handle oneOf schema', () => {
    const oneOfSchema: JSONSchema7 = {
      type: 'object',
      properties: {
        data: {
          oneOf: [
            { type: 'object', properties: { id: { type: 'number' } } },
            { type: 'string' },
          ],
        },
      },
    };
    const result = injectToonInstruction({
      schema: oneOfSchema,
    });
    expect(result).toContain('data');
  });
});
