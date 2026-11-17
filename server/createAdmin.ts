import 'dotenv/config';
import { text } from 'node:stream/consumers';
import { AuthStore } from './authStore.ts';
import { NeuroDatabase } from './db.ts';

const [password, setupCode] = (await text(process.stdin)).split(/\r?\n/);
if (!password || !setupCode || !/^[0-9a-f]{64}$/.test(setupCode)) {
  throw new Error('Provide the temporary password and a 32-byte hex setup code on separate lines of stdin.');
}
const { db } = new NeuroDatabase();
try {
  const auth = new AuthStore(db);
  if (auth.getAdmin()) throw new Error('An admin account already exists.');
  await auth.createAdmin(password, setupCode);
  console.log('Admin account created.');
} finally {
  db.close();
}
