import { JSONParseError, TypeValidationError } from '@ai-sdk/provider';
import { safeParseJSON, safeParseToon } from '@ai-sdk/provider-utils';
import { NoObjectGeneratedError } from '../error/no-object-generated-error';
import type {
  FinishReason,
  LanguageModelResponseMetadata,
  LanguageModelUsage,
} from '../types';
import type { OutputStrategy } from './output-strategy';
import { RepairTextFunction } from './repair-text';

/**
 * The format of the object to parse.
 */
export type ObjectFormat = 'json' | 'toon';

/**
 * Parses and validates a result string by parsing it as JSON or TOON and validating against the output strategy.
 *
 * @param result - The result string to parse and validate
 * @param outputStrategy - The output strategy containing validation logic
 * @param format - The format of the result string ('json' or 'toon')
 * @param context - Additional context for error reporting
 * @returns The validated result
 * @throws NoObjectGeneratedError if parsing or validation fails
 */
async function parseAndValidateObjectResult<RESULT>(
  result: string,
  outputStrategy: OutputStrategy<any, RESULT, any>,
  format: ObjectFormat,
  context: {
    response: LanguageModelResponseMetadata;
    usage: LanguageModelUsage;
    finishReason: FinishReason;
  },
): Promise<RESULT> {
  const parseResult =
    format === 'toon'
      ? await safeParseToon({ text: result })
      : await safeParseJSON({ text: result });

  if (!parseResult.success) {
    throw new NoObjectGeneratedError({
      message: 'No object generated: could not parse the response.',
      cause: parseResult.error,
      text: result,
      response: context.response,
      usage: context.usage,
      finishReason: context.finishReason,
    });
  }

  const validationResult = await outputStrategy.validateFinalResult(
    parseResult.value,
    {
      text: result,
      response: context.response,
      usage: context.usage,
    },
  );

  if (!validationResult.success) {
    throw new NoObjectGeneratedError({
      message: 'No object generated: response did not match schema.',
      cause: validationResult.error,
      text: result,
      response: context.response,
      usage: context.usage,
      finishReason: context.finishReason,
    });
  }

  return validationResult.value;
}

/**
 * Parses and validates a result string by parsing it as JSON or TOON and validating against the output strategy.
 * If the result cannot be parsed, it attempts to repair the result using the repairText function.
 *
 * @param result - The result string to parse and validate
 * @param outputStrategy - The output strategy containing validation logic
 * @param repairText - A function that attempts to repair the result string
 * @param format - The format of the result string ('json' or 'toon')
 * @param context - Additional context for error reporting
 * @returns The validated result
 * @throws NoObjectGeneratedError if parsing or validation fails
 */
export async function parseAndValidateObjectResultWithRepair<RESULT>(
  result: string,
  outputStrategy: OutputStrategy<any, RESULT, any>,
  repairText: RepairTextFunction | undefined,
  format: ObjectFormat,
  context: {
    response: LanguageModelResponseMetadata;
    usage: LanguageModelUsage;
    finishReason: FinishReason;
  },
): Promise<RESULT> {
  try {
    return await parseAndValidateObjectResult(
      result,
      outputStrategy,
      format,
      context,
    );
  } catch (error) {
    if (
      repairText != null &&
      NoObjectGeneratedError.isInstance(error) &&
      (JSONParseError.isInstance(error.cause) ||
        TypeValidationError.isInstance(error.cause))
    ) {
      const repairedText = await repairText({
        text: result,
        error: error.cause,
      });
      if (repairedText === null) {
        throw error;
      }
      return await parseAndValidateObjectResult(
        repairedText,
        outputStrategy,
        format,
        context,
      );
    }
    throw error;
  }
}
