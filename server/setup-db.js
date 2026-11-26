import 'dotenv/config';
import pg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const {Pool}=pg;
if(!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL first.');
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const here=path.dirname(fileURLToPath(import.meta.url));
try {
  const schema=await fs.readFile(path.join(here,'schema.sql'),'utf8');
  await pool.query(schema);
  console.log('iCoFyz database schema is ready.');
} finally { await pool.end(); }
