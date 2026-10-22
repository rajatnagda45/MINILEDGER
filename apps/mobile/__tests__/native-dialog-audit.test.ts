import fs from 'node:fs';
import path from 'node:path';

const sourceRoots = ['app', 'components', 'hooks', 'lib', 'providers'];

function sourceFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.[jt]sx?$/.test(entry.name) ? [target] : [];
  });
}

it('contains no application-owned browser or platform alert APIs', () => {
  const mobileRoot = path.resolve(__dirname, '..');
  const offenders = sourceRoots.flatMap((directory) => sourceFiles(path.join(mobileRoot, directory))).filter((file) => {
    const source = fs.readFileSync(file, 'utf8');
    return /\bAlert\.alert\s*\(|\bwindow\.(?:alert|confirm|prompt)\s*\(|globalThis[^\n]*(?:alert|confirm|prompt)/.test(source);
  });
  expect(offenders).toEqual([]);
});
