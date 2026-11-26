import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';
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
if(!process.env.DATABASE_URL || !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length<32) {
  throw new Error('DATABASE_URL and a SESSION_SECRET (32+ chars) are required. Copy .env.example to .env.');
}
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:true}:undefined});
const PgStore=connectPgSimple(session);
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
app.use(session({
 store:new PgStore({pool,tableName:'user_sessions',createTableIfMissing:true}),
 name:'icofyz.sid',secret:process.env.SESSION_SECRET,
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
app.get('/api/health',(_q,s)=>s.json({ok:true}));
app.get('/api/auth/csrf',(q,s)=>{q.session.csrfToken ||= crypto.randomBytes(32).toString('hex');s.json({csrfToken:q.session.csrfToken});});
app.post('/api/auth/login',loginLimiter,requireCsrf,asyncRoute(async(q,s)=>{
 const email=String(q.body.email||'').toLowerCase().trim(),password=String(q.body.password||'');
 const result=await pool.query('SELECT id,email,password_hash FROM admins WHERE email=$1',[email]);
 const admin=result.rows[0];
 if(!admin || !(await bcrypt.compare(password,admin.password_hash))) return s.status(401).json({error:'Email or password is incorrect.'});
 await new Promise((resolve,reject)=>q.session.regenerate(err=>err?reject(err):resolve()));
 q.session.adminId=admin.id;q.session.email=admin.email;q.session.csrfToken=crypto.randomBytes(32).toString('hex');
 s.json({ok:true,email:admin.email,csrfToken:q.session.csrfToken});
}));
app.post('/api/auth/logout',requireAuth,requireCsrf,(q,s)=>q.session.destroy(()=>{s.clearCookie('icofyz.sid',{httpOnly:true,sameSite:'strict',secure:production});s.json({ok:true});}));
app.get('/api/auth/me',(q,s)=>s.json({authenticated:!!q.session?.adminId,email:q.session?.email||null}));
app.get('/api/content',asyncRoute(async(_q,s)=>{
 const [items,settings]=await Promise.all([
  pool.query('SELECT collection,id,data FROM content_items ORDER BY created_at'),
  pool.query('SELECT data FROM site_settings WHERE id=TRUE')
 ]);
 const result={products:[],categories:[],brands:[],banners:[],settings:settings.rows[0]?.data||{}};
 for(const row of items.rows) result[row.collection].push({...row.data,id:row.id});
 s.json(result);
}));
app.get('/api/settings',asyncRoute(async(_q,s)=>{const r=await pool.query('SELECT data FROM site_settings WHERE id=TRUE');s.json(r.rows[0]?.data||{});}));
app.put('/api/settings',requireAuth,requireCsrf,asyncRoute(async(q,s)=>{
 const data=q.body;
 const allowed=['heroTitle','heroSubtitle','heroImage','logoImage','announcement','navigation','promoBanners','footerText','footerLinks'];
 const safe=Object.fromEntries(allowed.filter(k=>Object.hasOwn(data,k)).map(k=>[k,data[k]]));
 const r=await pool.query('UPDATE site_settings SET data=data || $1::jsonb,updated_at=NOW() WHERE id=TRUE RETURNING data',[JSON.stringify(safe)]);
 s.json(r.rows[0].data);
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
 const r=await pool.query('SELECT id,data FROM content_items WHERE collection=$1 ORDER BY created_at',[q.params.type]);
 s.json(r.rows.map(x=>({...x.data,id:x.id})));
}));
app.post('/api/:type',requireAuth,requireCsrf,asyncRoute(async(q,s)=>{
 if(!types.has(q.params.type))return s.sendStatus(404);
 const id=crypto.randomUUID(),data={...q.body,updatedAt:new Date().toISOString()};
 await pool.query('INSERT INTO content_items(id,collection,data) VALUES($1,$2,$3)',[id,q.params.type,JSON.stringify(data)]);
 s.status(201).json({...data,id});
}));
app.put('/api/:type/:id',requireAuth,requireCsrf,asyncRoute(async(q,s)=>{
 if(!types.has(q.params.type))return s.sendStatus(404);
 const r=await pool.query('UPDATE content_items SET data=data || $1::jsonb,updated_at=NOW() WHERE id=$2 AND collection=$3 RETURNING id,data',[JSON.stringify({...q.body,updatedAt:new Date().toISOString()}),q.params.id,q.params.type]);
 if(!r.rowCount)return s.sendStatus(404);s.json({...r.rows[0].data,id:r.rows[0].id});
}));
app.delete('/api/:type/:id',requireAuth,requireCsrf,asyncRoute(async(q,s)=>{
 if(!types.has(q.params.type))return s.sendStatus(404);
 const r=await pool.query('DELETE FROM content_items WHERE id=$1 AND collection=$2 RETURNING id',[q.params.id,q.params.type]);
 if(!r.rowCount)return s.sendStatus(404);s.json({ok:true});
}));
// API 404s must remain JSON; do not fall through to the React app.
app.use('/api',(q,s)=>s.status(404).json({error:'API endpoint not found.'}));

// Serve the compiled React/Vite application from the same origin as the API.
app.use(express.static(distDir,{index:false,fallthrough:true,maxAge:production?'1h':0}));
app.get('*',(q,s,next)=>{
 if(q.path.startsWith('/api/') || q.path==='/api' || q.path.startsWith('/uploads/')) return next();
 s.sendFile(path.join(distDir,'index.html'),err=>{if(err)next(err);});
});

app.use((err,_q,s,_next)=>{console.error(err.message);s.status(400).json({error:production?'Request could not be completed.':err.message});});

// Apply the idempotent schema on startup so a fresh Render database is ready.
const schema=await fs.readFile(path.join(__dirname,'schema.sql'),'utf8');
await pool.query(schema);

// Bootstrap the first administrator once. Existing passwords are never changed at startup.
if(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD){
 const email=String(process.env.ADMIN_EMAIL).trim().toLowerCase();
 const password=String(process.env.ADMIN_PASSWORD);
 if(password.length<14) throw new Error('ADMIN_PASSWORD must contain at least 14 characters.');
 const existing=await pool.query('SELECT id FROM admins WHERE email=$1',[email]);
 if(!existing.rowCount){
  const hash=await bcrypt.hash(password,12);
  await pool.query('INSERT INTO admins(email,password_hash) VALUES($1,$2)',[email,hash]);
  console.log(`Initial administrator created for ${email}.`);
 }
}

app.listen(port,'0.0.0.0',()=>console.log(`iCoFyz production server listening on 0.0.0.0:${port}`));
