import React, { useEffect, useRef } from 'react';
import Admin from './Admin.jsx';
import { createRoot } from 'react-dom/client';
import './legacy/styles.css';
import pageMarkup from './legacy/page.html?raw';
import legacyCode from './legacy/legacy.js?raw';

/**
 * React entry point.
 *
 * The original iCoFyz page is mounted into React as a single page component.
 * Its original JavaScript is executed after the markup is present so that
 * existing menus, product rendering, search, filters, modal, cart/wishlist
 * demo interactions and mobile drawer continue to work as before.
 *
 * This keeps the first migration visually/functionally faithful. The next
 * engineering step can split the page into native React components and hooks.
 */

function applyVisualSettings(settings) {
  const setText = (selector, value) => {
    const node = document.querySelector(selector);
    if (node && typeof value === 'string' && value.trim()) node.textContent = value;
  };
  if (settings.heroTitle) {
    const heading = document.querySelector('.hero h1');
    if (heading) heading.textContent = settings.heroTitle;
  }
  setText('.hero .lead', settings.heroSubtitle);
  setText('footer .foot > div:first-child p', settings.footerText);
  if (settings.logoImage) {
    document.querySelectorAll('header .logo img, footer .logobox img, .drawer img').forEach(img => {
      img.src = settings.logoImage;
    });
  }
  if (settings.heroImage) {
    const hero = document.querySelector('.hero .hero-photo');
    if (hero) hero.src = settings.heroImage;
  }
  if (settings.announcement) {
    let bar = document.querySelector('.cms-announcement');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'cms-announcement';
      const header = document.querySelector('header');
      if (header) header.parentNode.insertBefore(bar, header);
    }
    bar.textContent = settings.announcement;
  }
  if (Array.isArray(settings.navigation) && settings.navigation.length) {
    const nav = document.querySelector('.head-links');
    if (nav) {
      const keep = [...nav.querySelectorAll('[data-open], .btn')];
      nav.replaceChildren();
      settings.navigation.forEach(item => {
        if (!item.label || !item.url) return;
        const a = document.createElement('a');
        a.textContent = item.label;
        a.href = item.url;
        nav.appendChild(a);
      });
      keep.forEach(a => nav.appendChild(a));
    }
  }
  if (Array.isArray(settings.promoBanners) && settings.promoBanners.length) {
    let region = document.querySelector('.cms-promo-region');
    if (!region) {
      region = document.createElement('section');
      region.className = 'cms-promo-region';
      const footer = document.querySelector('footer');
      if (footer) footer.parentNode.insertBefore(region, footer);
    }
    region.replaceChildren();
    settings.promoBanners.forEach(item => {
      const card = document.createElement('a');
      card.className = 'cms-promo-card';
      card.href = item.link || '#';
      if (item.image) {
        const img = document.createElement('img');
        img.src = item.image; img.alt = item.title || 'Promotion';
        card.appendChild(img);
      }
      const copy = document.createElement('span');
      const title = document.createElement('strong');
      title.textContent = item.title || '';
      const subtitle = document.createElement('small');
      subtitle.textContent = item.subtitle || '';
      copy.append(title, subtitle); card.appendChild(copy); region.appendChild(card);
    });
  }
  if (Array.isArray(settings.footerLinks) && settings.footerLinks.length) {
    const footer = document.querySelector('footer .foot');
    if (footer) {
      let links = footer.querySelector('.cms-footer-links');
      if (!links) { links = document.createElement('div'); links.className = 'cms-footer-links'; footer.appendChild(links); }
      links.replaceChildren();
      settings.footerLinks.forEach(item => {
        if (!item.label || !item.url) return;
        const a=document.createElement('a'); a.textContent=item.label; a.href=item.url; links.appendChild(a);
      });
    }
  }
}


const storefrontCategories = [
  ['Home decor','home-decor','Decor accents, textiles and thoughtful pieces for every space'],
  ['Food & drink','pantry','Small-batch pantry favourites, tea, coffee and treats'],
  ['Gifts','gift-hampers','Ready-to-gift finds, hampers and little luxuries'],
  ['Sports & outdoors','bags','Everyday active essentials and outdoor accessories'],
  ['Made in India','dinnerware','Distinctive craft, design and maker-led collections'],
  ['Sustainable','kitchenware','Considered everyday goods with a lighter footprint']
];
const storefrontProducts = [
  ['Hand-glazed stoneware vase','Northstar Ceramics','home-decor','Bestseller','Home'],
  ['Soy wax candle, sandalwood','Ember & Oak','candles','New','Home'],
  ['Speckled breakfast mug','Northstar Ceramics','dinnerware','','Kitchen'],
  ['Mini indoor planter','Greenleaf Studio','home-decor','Bestseller','Home'],
  ['Festive gift hamper box','Little Joys','gift-hampers','','Gifts'],
  ['Small-batch mango pickle','Nani’s Kitchen','pantry','Bestseller','Kitchen'],
  ['Cane table lamp','Juniper Lane','lighting','New','Home'],
  ['Embroidered cushion cover','Juniper Lane','textiles','','Home']
];
function ensureStorefrontVisuals() {
  const base='/images/storefront/';
  const cats=document.getElementById('cats');
  if(cats) {
    cats.innerHTML=storefrontCategories.map(([name,image,desc])=>`
      <a href="#catpanel" class="cat visual-cat" data-visual-category="${name}" aria-label="Explore ${name}">
        <div class="img"><img src="${base}${image}.webp" alt="${name}" loading="lazy"></div>
        <span>${name}</span><small>${desc}</small>
      </a>`).join('');
  }
  const products=document.getElementById('products');
  const tabs=document.getElementById('tabs');
  if(products) {
    const render=(filter='All')=>{
      const cms=Array.isArray(window.ICOFYZ_CMS_DATA?.products)?window.ICOFYZ_CMS_DATA.products:[];
      const all=[...storefrontProducts,...cms.map(p=>[p.name||'New product',p.brand||'iCoFyz seller',p.image?'':(p.icon||'gift'),'',p.category||'All',p.image||''])];
      const visible=all.filter(p=>filter==='All'||p[4]===filter);
      products.innerHTML=visible.map(([name,brand,image,tag,category,customImage])=>`
        <article class="prod visual-prod" data-open role="button" tabindex="0" aria-label="Sign up to view ${name}">
          <div class="img"><span class="visual-actions">
              <button type="button" class="visual-heart" data-wishlist-toggle aria-label="Add ${name} to wishlist" aria-pressed="false">♡</button>
              <button type="button" class="visual-cart" data-cart-add aria-label="Add ${name} to cart">＋ Add to cart</button>
            </span>${tag?`<span class="tag ${tag==='New'?'new':'best'}">${tag}</span>`:''}
            <img src="${customImage||base+image+'.webp'}" alt="${name}" loading="lazy">
          </div>
          <h4>${name}</h4><div class="brand">${brand}</div>
          <span class="unlock">Wholesale pricing available after signup</span>
        </article>`).join('');
    };
    if(tabs) {
      tabs.innerHTML=['All','Home','Kitchen','Gifts'].map((t,i)=>`<button class="tab ${i===0?'active':''}" data-visual-tab="${t}">${t}</button>`).join('');
      tabs.addEventListener('click',e=>{
        const b=e.target.closest('[data-visual-tab]'); if(!b)return;
        tabs.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b)); render(b.dataset.visualTab);
      });
    }
    render();
    setupShoppingActions(products);
  }
  if(!document.getElementById('visual-storefront-style')) {
    const style=document.createElement('style'); style.id='visual-storefront-style';
    style.textContent=`
      .cats .visual-cat .img{overflow:hidden;background:#f6f2ed;border-radius:20px;aspect-ratio:1}
      .cats .visual-cat .img img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .35s}
      .cats .visual-cat:hover .img img,.visual-prod:hover .img img{transform:scale(1.055)}
      .cats .visual-cat small{color:var(--muted);font-size:12px;line-height:1.45}
      .visual-prod .img{background:#f6f2ed;overflow:hidden}
      .visual-prod .img img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .35s}
      @media(max-width:900px){.cats{grid-template-columns:repeat(3,1fr)}.products{grid-template-columns:repeat(2,1fr)}}
      @media(max-width:520px){.cats{grid-template-columns:repeat(2,1fr);gap:14px}.products{gap:14px}}
      .visual-prod .img{position:relative}.visual-actions{position:absolute;z-index:3;right:12px;top:12px;display:flex;flex-direction:column;gap:8px;align-items:flex-end}
      .visual-heart,.visual-cart,.shop-tool{border:0;cursor:pointer;box-shadow:0 3px 14px #17172b1c;background:#fff;color:#17172b;border-radius:999px;font-weight:700}
      .visual-heart{width:38px;height:38px;font-size:23px;line-height:1}.visual-heart.is-active{color:#e11d48;background:#fff0f3}.visual-cart{padding:10px 13px;font-size:12px}.visual-cart.added{background:#102052;color:#fff}
      .shop-tools{display:flex;gap:8px;align-items:center;margin-left:10px}.shop-tool{padding:9px 13px;font-size:13px;border:1px solid #e8e7ef}.shop-tool b{display:inline-flex;background:#102052;color:#fff;border-radius:20px;padding:2px 7px;margin-left:4px}
      .shop-panel{position:fixed;z-index:99999;right:18px;top:18px;bottom:18px;width:min(390px,calc(100vw - 36px));background:#fff;border:1px solid #e7e5ef;border-radius:20px;box-shadow:0 18px 70px #17172b35;padding:22px;overflow:auto}
      .shop-panel h3{font-size:22px;margin:0 0 16px}.shop-panel .shop-close{float:right;border:0;background:#f4f3f8;border-radius:50%;width:34px;height:34px;font-size:20px;cursor:pointer}
      .shop-line{display:flex;justify-content:space-between;gap:12px;padding:13px 0;border-bottom:1px solid #eee}.shop-line strong{display:block;font-size:14px}.shop-line small{color:#70748a}.shop-line button{border:0;background:#fff0f3;color:#be123c;border-radius:8px;padding:6px 9px;cursor:pointer}
      .shop-empty{color:#70748a;padding:24px 0}.shop-checkout{width:100%;margin-top:18px;border:0;border-radius:12px;padding:13px;background:#d6093b;color:white;font-weight:700;cursor:pointer}
    `;
    document.head.appendChild(style);
  }
  cats?.addEventListener('click',e=>{
    const a=e.target.closest('[data-visual-category]'); if(!a)return;
    e.preventDefault();
    const label=a.dataset.visualCategory;
    // Reuse the original category/subcategory renderer when available.
    if(typeof window.selectCategory === 'function') {
      window.selectCategory(label, null, false);
    } else {
      const panel=document.getElementById('catpanel'); if(!panel)return;
      panel.innerHTML=`<div class="cp-head"><div><h3>${label}</h3><p>Explore curated ${label.toLowerCase()} collections from independent makers.</p></div></div>`;
    }
    cats.querySelectorAll('[data-visual-category]').forEach(x=>x.classList.toggle('active',x===a));
    document.getElementById('catpanel')?.scrollIntoView({behavior:'smooth',block:'nearest'});
  });
  // Product cards are actionable: tapping a card opens the existing retailer
  // sign-up/login modal. Keyboard activation is supported as well.
  products?.addEventListener('keydown',e=>{
    if((e.key==='Enter'||e.key===' ') && e.target.matches('.visual-prod')) {
      e.preventDefault(); e.target.click();
    }
  });
}

function setupShoppingActions(products) {
  if (products.dataset.shoppingReady) return;
  products.dataset.shoppingReady = '1';
  const read = key => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  let cart = read('icofyz_cart');
  let wishlist = read('icofyz_wishlist');
  const tools = document.createElement('div'); tools.className='shop-tools';
  tools.innerHTML='<button class="shop-tool" type="button" data-open-wishlist>♡ Wishlist <b data-wishlist-count>0</b></button><button class="shop-tool" type="button" data-open-cart>🛒 Cart <b data-cart-count>0</b></button>';
  document.querySelector('header .head')?.appendChild(tools);
  const updateCounts=()=>{
    document.querySelector('[data-cart-count]')?.replaceChildren(String(cart.reduce((n,p)=>n+p.qty,0)));
    document.querySelector('[data-wishlist-count]')?.replaceChildren(String(wishlist.length));
    products.querySelectorAll('.visual-prod').forEach(card=>{
      const name=card.querySelector('h4')?.textContent;
      const heart=card.querySelector('[data-wishlist-toggle]');
      if(heart){const active=wishlist.some(p=>p.name===name);heart.classList.toggle('is-active',active);heart.textContent=active?'♥':'♡';heart.setAttribute('aria-pressed',String(active));}
    });
  };
  const productFrom=card=>({name:card.querySelector('h4')?.textContent||'Product',brand:card.querySelector('.brand')?.textContent||'iCoFyz',image:card.querySelector('img')?.getAttribute('src')||''});
  const openPanel=(kind)=>{
    document.querySelector('.shop-panel')?.remove();
    const isCart=kind==='cart', list=isCart?cart:wishlist;
    const panel=document.createElement('aside');panel.className='shop-panel';panel.setAttribute('aria-label',isCart?'Shopping cart':'Wishlist');
    panel.innerHTML=`<button class="shop-close" type="button" aria-label="Close">×</button><h3>${isCart?'Your cart':'Your wishlist'}</h3><div class="shop-list"></div>${isCart?'<button class="shop-checkout" type="button" data-checkout>Continue to sign up / login</button>':''}`;
    const listEl=panel.querySelector('.shop-list');
    if(!list.length) listEl.innerHTML=`<p class="shop-empty">${isCart?'Your cart is empty. Add products to get started.':'No favourites yet. Tap the heart on a product to save it.'}</p>`;
    else listEl.innerHTML=list.map((p,i)=>`<div class="shop-line"><div><strong>${p.name}</strong><small>${p.brand}${isCart?` · Qty ${p.qty}`:''}</small></div><button type="button" data-remove-item="${i}">Remove</button></div>`).join('');
    panel.addEventListener('click',e=>{
      if(e.target.closest('.shop-close')) panel.remove();
      const remove=e.target.closest('[data-remove-item]'); if(remove){const i=Number(remove.dataset.removeItem);if(isCart)cart.splice(i,1);else wishlist.splice(i,1);write(isCart?'icofyz_cart':'icofyz_wishlist',isCart?cart:wishlist);panel.remove();updateCounts();openPanel(kind);}
      if(e.target.closest('[data-checkout]')) { panel.remove();document.querySelector('[data-open]')?.click(); }
    });
    document.body.appendChild(panel);
  };
  products.addEventListener('click',e=>{
    const card=e.target.closest('.visual-prod'); if(!card)return;
    const p=productFrom(card);
    if(e.target.closest('[data-wishlist-toggle]')){
      e.preventDefault();e.stopPropagation();const i=wishlist.findIndex(x=>x.name===p.name);
      if(i>=0)wishlist.splice(i,1);else wishlist.push(p);write('icofyz_wishlist',wishlist);updateCounts();return;
    }
    if(e.target.closest('[data-cart-add]')){
      e.preventDefault();e.stopPropagation();const existing=cart.find(x=>x.name===p.name);
      if(existing)existing.qty+=1;else cart.push({...p,qty:1});write('icofyz_cart',cart);const b=e.target.closest('[data-cart-add]');b.classList.add('added');b.textContent='✓ Added';updateCounts();return;
    }
  });
  tools.addEventListener('click',e=>{if(e.target.closest('[data-open-cart]'))openPanel('cart');if(e.target.closest('[data-open-wishlist]'))openPanel('wishlist');});
  updateCounts();
}

function IcofyzPage() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Execute the original scripts together: they share top-level declarations.
    let cancelled = false;
    fetch('/api/content').catch(() => null).then(r => r && r.ok ? r.json() : null).then(cms => {
      if (cancelled) return;
      window.ICOFYZ_CMS_DATA = cms || {};
      // Run as a normal inline script (not eval/new Function), preserving
      // the original page's global-script behaviour without unsafe-eval CSP.
      const legacyScript = document.createElement('script');
      legacyScript.textContent = legacyCode;
      document.body.appendChild(legacyScript);
      legacyScript.remove();
      ensureStorefrontVisuals();
      applyVisualSettings(cms?.settings || {});
    });
    return () => { cancelled = true; };
  }, []);

  return <div id="icofyz-page" dangerouslySetInnerHTML={{ __html: pageMarkup }} />;
}

function App() {
  return window.location.pathname.startsWith('/admin') ? <Admin /> : <IcofyzPage />;
}

createRoot(document.getElementById('root')).render(<App />);
