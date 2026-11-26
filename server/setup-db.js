import 'dotenv/config';
import mysql from 'mysql2/promise';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const required=['DB_HOST','DB_PORT','DB_NAME','DB_USER','DB_PASSWORD'];
const missing=required.filter(k=>!process.env[k]);
if(missing.length) throw new Error(`Missing GoDaddy database variables: ${missing.join(', ')}`);
const pool=await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,charset:'utf8mb4'});
const here=path.dirname(fileURLToPath(import.meta.url));
try {
 const schema=await fs.readFile(path.join(here,'schema.sql'),'utf8');
 for(const statement of schema.split(';').map(x=>x.trim()).filter(Boolean)) await pool.query(statement);
 console.log('iCoFyz MySQL schema is ready.');
} finally { await pool.end(); }
