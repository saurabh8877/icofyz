import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import sharp from 'sharp';
import {fileTypeFromBuffer} from 'file-type';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const app=express(), port=Number(process.env.PORT||4000), production=process.env.NODE_ENV==='production';
const required=['DB_HOST','DB_PORT','DB_NAME','DB_USER','DB_PASSWORD','SESSION_SECRET'];
const missing=required.filter(k=>!process.env[k]);
if(missing.length || process.env.SESSION_SECRET?.length<32) {
  throw new Error(`Missing required environment variables or short SESSION_SECRET: ${missing.join(', ') || 'SESSION_SECRET must be 32+ chars'}.`);
}
const pool=mysql.createPool({
 host:process.env.DB_HOST, port:Number(process.env.DB_PORT), user:process.env.DB_USER,
 password:process.env.DB_PASSWORD, database:process.env.DB_NAME,
 waitForConnections:true, connectionLimit:10, queueLimit:0,
 charset:'utf8mb4'
});
const uploadDir=path.resolve(process.env.UPLOAD_DIR || path.join(__dirname,'uploads'));
const distDir=path.resolve(__dirname,'../dist');
await fs.mkdir(uploadDir,{recursive:true});
app.set('trust proxy', production ? 1 : false);
app.disable('x-powered-by');
app.use(helmet({crossOriginResourcePolicy:{policy:'same-site'},contentSecurityPolicy:{
 directives:{
  defaultSrc:["'self'"],baseUri:["'self'"],objectSrc:["'none'"],frameAncestors:["'none'"],
  imgSrc:["'self'","data:"],scriptSrc:["'self'","'unsafe-inline'"],styleSrc:["'self'","'unsafe-inline'","https://fonts.googleapis.com"],
  fontSrc:["'self'","https://fonts.gstatic.com","data:"],connectSrc:["'self'"]
 }
}}));
app.use(express.json({limit:'1mb'}));
app.use('/uploads',express.static(uploadDir,{fallthrough:false,immutable:true,maxAge:'7d'}));

await pool.execute(`CREATE TABLE IF NOT EXISTS user_sessions (
 session_id VARCHAR(128) NOT NULL PRIMARY KEY,
 expires BIGINT UNSIGNED NOT NULL,
 data MEDIUMTEXT NOT NULL,
 INDEX user_sessions_expires_idx (expires)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
class MySQLSessionStore extends session.Store {
 async get(sid,cb){try{const [rows]=await pool.execute('SELECT data,expires FROM user_sessions WHERE session_id=? AND expires>?',[sid,Date.now()]);if(!rows.length)return cb(null,null);cb(null,JSON.parse(rows[0].data));}catch(e){cb(e);}}
 async set(sid,sess,cb=()=>{}){try{const expires=sess.cookie?.expires?new Date(sess.cookie.expires).getTime():Date.now()+86400000;await pool.execute('INSERT INTO user_sessions(session_id,expires,data) VALUES(?,?,?) ON DUPLICATE KEY UPDATE expires=VALUES(expires),data=VALUES(data)',[sid,expires,JSON.stringify(sess)]);cb();}catch(e){cb(e);}}
 async destroy(sid,cb=()=>{}){try{await pool.execute('DELETE FROM user_sessions WHERE session_id=?',[sid]);cb();}catch(e){cb(e);}}
 async touch(sid,sess,cb=()=>{}){try{const expires=sess.cookie?.expires?new Date(sess.cookie.expires).getTime():Date.now()+86400000;await pool.execute('UPDATE user_sessions SET expires=? WHERE session_id=?',[expires,sid]);cb();}catch(e){cb(e);}}
}
app.use(session({
 store:new MySQLSessionStore(),name:'icofyz.sid',secret:process.env.SESSION_SECRET,
 resave:false,saveUninitialized:false,
 cookie:{httpOnly:true,secure:production,sameSite:'strict',maxAge:30*60*1000}
}));
const loginLimiter=rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:true,legacyHeaders:false,message:{error:'Too many login attempts. Try again later.'}});
const types=new Set(['products','categories','brands','banners']);
const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const requireAuth=(req,res,next)=>req.session?.adminId?next():res.status(401).json({error:'Please sign in.'});
const requireCsrf=(req,res,next)=>{
 const token=req.get('x-csrf-token');
 if(!req.session?.csrfToken || !token || token.length!==req.session.csrfToken.length || !crypto.timingSafeEqual(Buffer.from(token),Buffer.from(req.session.csrfToken))) return res.status(403).json({error:'Security token expired. Refresh and sign in again.'});
 next();
};
const parseJson=value=>typeof value==='string'?JSON.parse(value):value;
app.get('/api/health',asyncRoute(async(_q,s)=>{await pool.query('SELECT 1');s.json({ok:true,database:'connected'});}));
app.get('/api/auth/csrf',(q,s)=>{q.session.csrfToken ||= crypto.randomBytes(32).toString('hex');s.json({csrfToken:q.session.csrfToken});});
app.post('/api/auth/login',loginLimiter,requireCsrf,asyncRoute(async(q,s)=>{
 const email=String(q.body.email||'').toLowerCase().trim(),password=String(q.body.password||'');
 const [rows]=await pool.execute('SELECT id,email,password_hash FROM admins WHERE email=? LIMIT 1',[email]);
 const admin=rows[0];
 if(!admin || !(await bcrypt.compare(password,admin.password_hash))) return s.status(401).json({error:'Email or password is incorrect.'});
 await new Promise((resolve,reject)=>q.session.regenerate(err=>err?reject(err):resolve()));
 q.session.adminId=admin.id;q.session.email=admin.email;q.session.csrfToken=crypto.randomBytes(32).toString('hex');
 s.json({ok:true,email:admin.email,csrfToken:q.session.csrfToken});
}));
app.post('/api/auth/logout',requireAuth,requireCsrf,(q,s)=>q.session.destroy(()=>{s.clearCookie('icofyz.sid',{httpOnly:true,sameSite:'strict',secure:production});s.json({ok:true});}));
app.get('/api/auth/me',(q,s)=>s.json({authenticated:!!q.session?.adminId,email:q.session?.email||null}));
app.get('/api/content',asyncRoute(async(_q,s)=>{
 const [[items],[settings]]=await Promise.all([
  pool.execute('SELECT collection,id,data FROM content_items ORDER BY created_at'),
  pool.execute('SELECT data FROM site_settings WHERE id=1')
 ]);
 const result={products:[],categories:[],brands:[],banners:[],settings:settings[0]?parseJson(settings[0].data):{}};
 for(const row of items) result[row.collection].push({...parseJson(row.data),id:row.id});
 s.json(result);
}));
app.get('/api/settings',asyncRoute(async(_q,s)=>{const [r]=await pool.execute('SELECT data FROM site_settings WHERE id=1');s.json(r[0]?parseJson(r[0].data):{});}));
app.put('/api/settings',requireAuth,requireCsrf,asyncRoute(async(q,s)=>{
 const data=q.body||{},allowed=['heroTitle','heroSubtitle','heroImage','logoImage','announcement','navigation','promoBanners','footerText','footerLinks'];
 const safe=Object.fromEntries(allowed.filter(k=>Object.hasOwn(data,k)).map(k=>[k,data[k]]));
 const [rows]=await pool.execute('SELECT data FROM site_settings WHERE id=1');
 const merged={...(rows[0]?parseJson(rows[0].data):{}),...safe};
 await pool.execute('UPDATE site_settings SET data=?,updated_at=CURRENT_TIMESTAMP WHERE id=1',[JSON.stringify(merged)]);
 s.json(merged);
}));
app.post('/api/upload',requireAuth,requireCsrf,multer({storage:multer.memoryStorage(),limits:{fileSize:6*1024*1024},fileFilter:(_q,f,cb)=>{
 if(!['image/jpeg','image/png','image/webp'].includes(f.mimetype)) return cb(new Error('Only JPEG, PNG and WEBP images are accepted.'));
 cb(null,true);
}}).single('image'),asyncRoute(async(q,s)=>{
 if(!q.file)return s.status(400).json({error:'Choose an image.'});
 const detected=await fileTypeFromBuffer(q.file.buffer);
 if(!detected || !['image/jpeg','image/png','image/webp'].includes(detected.mime))return s.status(400).json({error:'The uploaded file is not a valid supported image.'});
 const filename=crypto.randomUUID()+'.webp';
 await sharp(q.file.buffer,{limitInputPixels:40000000}).rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:84}).toFile(path.join(uploadDir,filename));
 s.status(201).json({url:'/uploads/'+filename});
}));
app.get('/api/:type',asyncRoute(async(q,s)=>{
 if(!types.has(q.params.type))return s.sendStatus(404);
 const [r]=await pool.execute('SELECT id,data FROM content_items WHERE collection=? ORDER BY created_at',[q.params.type]);
 s.json(r.map(x=>({...parseJson(x.data),id:x.id})));
}));
app.post('/api/:type',requireAuth,requireCsrf,asyncRoute(async(q,s)=>{
 if(!types.has(q.params.type))return s.sendStatus(404);
 const id=crypto.randomUUID(),data={...q.body,updatedAt:new Date().toISOString()};
 await pool.execute('INSERT INTO content_items(id,collection,data) VALUES(?,?,?)',[id,q.params.type,JSON.stringify(data)]);
 s.status(201).json({...data,id});
}));
app.put('/api/:type/:id',requireAuth,requireCsrf,asyncRoute(async(q,s)=>{
 if(!types.has(q.params.type))return s.sendStatus(404);
 const [rows]=await pool.execute('SELECT id,data FROM content_items WHERE id=? AND collection=?',[q.params.id,q.params.type]);
 if(!rows.length)return s.sendStatus(404);
 const data={...parseJson(rows[0].data),...q.body,updatedAt:new Date().toISOString()};
 await pool.execute('UPDATE content_items SET data=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND collection=?',[JSON.stringify(data),q.params.id,q.params.type]);
 s.json({...data,id:rows[0].id});
}));
app.delete('/api/:type/:id',requireAuth,requireCsrf,asyncRoute(async(q,s)=>{
 if(!types.has(q.params.type))return s.sendStatus(404);
 const [r]=await pool.execute('DELETE FROM content_items WHERE id=? AND collection=?',[q.params.id,q.params.type]);
 if(!r.affectedRows)return s.sendStatus(404);s.json({ok:true});
}));
app.use('/api',(q,s)=>s.status(404).json({error:'API endpoint not found.'}));
app.use(express.static(distDir,{index:false,fallthrough:true,maxAge:production?'1h':0}));
app.get('*',(q,s,next)=>{
 if(q.path.startsWith('/api/') || q.path==='/api' || q.path.startsWith('/uploads/')) return next();
 s.sendFile(path.join(distDir,'index.html'),err=>{if(err)next(err);});
});
app.use((err,_q,s,_next)=>{console.error(err.message);s.status(400).json({error:production?'Request could not be completed.':err.message});});

const schema=await fs.readFile(path.join(__dirname,'schema.sql'),'utf8');
for(const statement of schema.split(';').map(x=>x.trim()).filter(Boolean)) await pool.query(statement);
if(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD){
 const email=String(process.env.ADMIN_EMAIL).trim().toLowerCase(),password=String(process.env.ADMIN_PASSWORD);
 if(password.length<14) throw new Error('ADMIN_PASSWORD must contain at least 14 characters.');
 const [existing]=await pool.execute('SELECT id FROM admins WHERE email=? LIMIT 1',[email]);
 if(!existing.length){const hash=await bcrypt.hash(password,12);await pool.execute('INSERT INTO admins(email,password_hash) VALUES(?,?)',[email,hash]);console.log(`Initial administrator created for ${email}.`);}
}
const server=app.listen(port,'0.0.0.0',()=>console.log(`iCoFyz server listening on 0.0.0.0:${port}`));
const shutdown=async()=>{server.close();await pool.end();process.exit(0);};
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
