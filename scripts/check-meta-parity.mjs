#!/usr/bin/env node
/**
 * Test de paridad del cliente Meta (F2.5).
 *
 * El cliente Meta vive en DOS copias espejo (Node y Deno) que NO se comparten por
 * import (runtimes distintos). Este script garantiza que no driften: compara el
 * contenido de ambas copias y falla (exit 1) si difieren en lo que importa.
 *
 * - constants.ts: debe ser byte-idéntico (es puro, sin runtime).
 * - client.ts: idéntico salvo la extensión del import ('./constants' en Node vs
 *   './constants.ts' en Deno), que es la única diferencia legítima.
 *
 * Corre en CI (npm run check:meta-parity). Sin dependencias.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const NODE = join(root, 'src/lib/meta');
const DENO = join(root, 'supabase/functions/_shared/meta');

let failed = false;
const fail = (msg) => { console.error(`✗ ${msg}`); failed = true; };

// 1. constants.ts debe ser idéntico
const nodeConst = readFileSync(join(NODE, 'constants.ts'), 'utf8');
const denoConst = readFileSync(join(DENO, 'constants.ts'), 'utf8');
if (nodeConst === denoConst) {
  console.log('✓ constants.ts idénticos (Node ↔ Deno)');
} else {
  fail('constants.ts DIFIEREN entre src/lib/meta y supabase/functions/_shared/meta. Deben ser byte-idénticos.');
}

// 2. client.ts idéntico salvo la extensión del import de constants
const nodeClient = readFileSync(join(NODE, 'client.ts'), 'utf8');
const denoClient = readFileSync(join(DENO, 'client.ts'), 'utf8');
const normalize = (s) => s.replace(/from '\.\/constants(\.ts)?'/g, "from './constants'");
if (normalize(nodeClient) === normalize(denoClient)) {
  console.log('✓ client.ts idénticos salvo extensión de import (Node ↔ Deno)');
} else {
  fail('client.ts DIFIEREN (más allá de la extensión del import). Mantené ambas copias en sync.');
}

if (failed) {
  console.error('\nParidad del cliente Meta ROTA. Sincronizá las 2 copias antes de mergear.');
  process.exit(1);
}
console.log('\n✓ Paridad del cliente Meta OK.');
