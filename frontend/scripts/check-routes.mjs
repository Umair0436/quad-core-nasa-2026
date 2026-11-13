import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Exercise the actual TypeScript parser without adding a test framework.
const source = await readFile(new URL('../src/navigation.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { parseRoute } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
let count = 0;
for (const [selected, id] of ['nova', 'leo', 'maya', 'kai'].entries()) {
  const expected = { page: 'outpost', selected };
  for (const [path, hash] of [
    [`/outpost/${id}`, ''],
    [`/outpost/${id}/`, ''],
    ['/', `#outpost/${id}`],
    ['/', `#/outpost/${id}`],
    ['/', `#/outpost/${id}/`],
  ]) {
    assert.deepEqual(parseRoute(path, hash), expected, `Outpost route for ${id}: ${path}${hash}`);
    count++;
  }
  assert.deepEqual(parseRoute(`/outpost/${id}`, `#briefing/${id}`), { page: 'briefing', selected });
  assert.deepEqual(parseRoute(`/outpost/${id}`, '#launch-main'), { page: 'selection', selected: null });
  count += 2;
}
assert.deepEqual(parseRoute('/', '#outpost/unknown'), { page: 'selection', selected: null });
assert.deepEqual(parseRoute('/outpost/unknown', ''), { page: 'selection', selected: null });
console.log(`${count + 2} navigation checks passed.`);
