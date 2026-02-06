---
"@ai-sdk/provider": patch
"@ai-sdk/provider-utils": patch
"ai": patch
---

Add TOON (Token-Oriented Object Notation) format support for object generation.

TOON is a more token-efficient alternative to JSON that can reduce output tokens by up to 40%, particularly for arrays of uniform objects.

Usage:
```typescript
import { generateObject, streamObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const result = await generateObject({
  model: openai('gpt-4o'),
  schema: z.object({
    users: z.array(z.object({
      id: z.number(),
      name: z.string(),
    })),
  }),
  format: 'toon', // New! Default: 'json'
  prompt: 'Generate a list of users',
});
```

Changes:
- Add 'toon' response format type to `@ai-sdk/provider`
- Add TOON parsing utilities (parseToon, safeParseToon, encodeToon, decodeToon) to `@ai-sdk/provider-utils`
- Add `format?: 'json' | 'toon'` option to `generateObject` and `streamObject` in `ai`
