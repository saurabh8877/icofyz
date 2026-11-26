import 'dotenv/config';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
const required=['DB_HOST','DB_PORT','DB_NAME','DB_USER','DB_PASSWORD'];
const missing=required.filter(k=>!process.env[k]);
if(missing.length) throw new Error(`Missing GoDaddy database variables: ${missing.join(', ')}`);
const email=String(process.env.ADMIN_EMAIL||'').trim().toLowerCase();
const password=String(process.env.ADMIN_PASSWORD||'');
if(!email || password.length<14) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 14 characters).');
const db=await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,charset:'utf8mb4'});
try {
 const hash=await bcrypt.hash(password,12);
 await db.execute('INSERT INTO admins(email,password_hash) VALUES(?,?) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash)',[email,hash]);
 console.log(`Admin account ready for ${email}.`);
} finally { await db.end(); }
