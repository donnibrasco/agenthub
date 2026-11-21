// Loads every server module the way production does (`node server.ts`, Node's type stripping).
// Run during the Docker build so a module Node cannot load fails the build instead of the live site.
import fs from 'node:fs';
import path from 'node:path';

// createAdmin.ts is a command-line script (it reads a password when run), not a module.
const files = fs.readdirSync('server').filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'createAdmin.ts');
for (const file of files) await import(path.resolve('server', file));
console.log(`Server modules load in Node ${process.versions.node}: ${files.length} checked.`);
