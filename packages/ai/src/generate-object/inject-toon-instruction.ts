import { encode } from '@toon-format/toon';
import { JSONSchema7 } from 'json-schema';
import {
  LanguageModelV3Message,
  LanguageModelV3Prompt,
} from '@ai-sdk/provider';

const DEFAULT_TOON_INSTRUCTIONS = `Data format: TOON (Token-Oriented Object Notation)
- Uses 2-space indentation instead of braces/brackets
- Arrays use header syntax: fieldName[count]{properties}:
- Strings, numbers, booleans are on their own lines
- No commas, no quotes around keys`;

const DEFAULT_TOON_SUFFIX =
  'Respond with valid TOON matching the structure above. No code blocks or markdown.';

/**
 * Generates an example value from a JSON schema for TOON demonstration.
 */
function generateExampleFromSchema(schema: JSONSchema7): unknown {
  if (schema === true) {
    return {};
  }
  if (schema === false) {
    return undefined;
  }

  // Handle references - we'll just return a placeholder
  if (schema.$ref) {
    return {};
  }

  // Handle anyOf/oneOf - use the first option
  if (schema.anyOf && schema.anyOf.length > 0) {
    return generateExampleFromSchema(schema.anyOf[0] as JSONSchema7);
  }
  if (schema.oneOf && schema.oneOf.length > 0) {
    return generateExampleFromSchema(schema.oneOf[0] as JSONSchema7);
  }

  // Handle allOf - merge all schemas
  if (schema.allOf && schema.allOf.length > 0) {
    const result: Record<string, unknown> = {};
    for (const subSchema of schema.allOf) {
      const subExample = generateExampleFromSchema(subSchema as JSONSchema7);
      if (typeof subExample === 'object' && subExample !== null) {
        Object.assign(result, subExample);
      }
    }
    return result;
  }

  // Handle const
  if (schema.const !== undefined) {
    return schema.const;
  }

  // Handle enum
  if (schema.enum && schema.enum.length > 0) {
    return schema.enum[0];
  }

  // Handle type
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;

  switch (type) {
    case 'object': {
      const result: Record<string, unknown> = {};
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          result[key] = generateExampleFromSchema(propSchema as JSONSchema7);
        }
      }
      return result;
    }

    case 'array': {
      const itemSchema = schema.items as JSONSchema7 | undefined;
      if (itemSchema) {
        // Generate 2 example items to show the array pattern
        return [
          generateExampleFromSchema(itemSchema),
          generateExampleFromSchema(itemSchema),
        ];
      }
      return [];
    }

    case 'string':
      return 'example';

    case 'number':
    case 'integer':
      return 1;

    case 'boolean':
      return true;

    case 'null':
      return null;

    default:
      // No type specified, try to infer from properties
      if (schema.properties) {
        const result: Record<string, unknown> = {};
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          result[key] = generateExampleFromSchema(propSchema as JSONSchema7);
        }
        return result;
      }
      return {};
  }
}

/**
 * Injects TOON format instructions into a prompt string.
 */
export function injectToonInstruction({
  prompt,
  schema,
}: {
  prompt?: string;
  schema?: JSONSchema7;
}): string {
  const exampleToon = schema
    ? encode(generateExampleFromSchema(schema))
    : undefined;

  return [
    prompt != null && prompt.length > 0 ? prompt : undefined,
    prompt != null && prompt.length > 0 ? '' : undefined, // add a newline if prompt is not null
    DEFAULT_TOON_INSTRUCTIONS,
    '',
    'Expected structure:',
    exampleToon,
    '',
    DEFAULT_TOON_SUFFIX,
  ]
    .filter(line => line != null)
    .join('\n');
}

/**
 * Injects TOON format instructions into the system message of a prompt.
 */
export function injectToonInstructionIntoMessages({
  messages,
  schema,
}: {
  messages: LanguageModelV3Prompt;
  schema?: JSONSchema7;
}): LanguageModelV3Prompt {
  const systemMessage: LanguageModelV3Message =
    messages[0]?.role === 'system'
      ? { ...messages[0] }
      : { role: 'system', content: '' };

  systemMessage.content = injectToonInstruction({
    prompt: systemMessage.content,
    schema,
  });

  return [
    systemMessage,
    ...(messages[0]?.role === 'system' ? messages.slice(1) : messages),
  ];
}
