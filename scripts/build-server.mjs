import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('dist');
mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: ['src/server/index.ts'],
  outfile: 'dist/server.cjs',
  bundle: true,
  platform: 'node',
  target: ['node20'],
  format: 'cjs',
  sourcemap: true,
  legalComments: 'none',
  logLevel: 'info'
});
