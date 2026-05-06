import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import openapiTS, { astToString } from 'openapi-typescript';

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080').replace(
  /\/$/,
  '',
);
const schemaUrl = `${apiBaseUrl}/docs-json`;
const outputPath = path.resolve(process.cwd(), 'src/lib/api-types.ts');

// Generates TypeScript types from the Nest Swagger/OpenAPI schema endpoint.
const ast = await openapiTS(schemaUrl);
const outputContents = [
  '// This file is auto-generated. Run `npm run gen:types` to refresh.',
  astToString(ast),
].join('\n\n');

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, outputContents, 'utf8');

console.log(`Generated API types from ${schemaUrl}`);
