import 'dotenv/config';
import { text } from 'node:stream/consumers';
import { AuthStore } from './authStore.ts';
import { NeuroDatabase } from './db.ts';

const [password] = (await text(process.stdin)).split(/\r?\n/);
if (!password?.trim() || password.length > 128) {
  throw new Error('Provide a password of up to 128 characters on stdin.');
}
const { db } = new NeuroDatabase();
try {
  const auth = new AuthStore(db);
  if (auth.getAdmin()) throw new Error('An admin account already exists.');
  await auth.createAdmin(password);
  console.log('Admin account created.');
} finally {
  db.close();
}
