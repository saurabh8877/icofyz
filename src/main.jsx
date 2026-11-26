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
      <a href="#catpanel" class="cat visual-cat" data-visual-category="${name}">
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
        <article class="prod visual-prod">
          <div class="img">${tag?`<span class="tag ${tag==='New'?'new':'best'}">${tag}</span>`:''}
            <img src="${customImage||base+image+'.webp'}" alt="${name}" loading="lazy">
          </div>
          <h4>${name}</h4><div class="brand">${brand}</div>
          <span class="unlock">Sign up to view wholesale terms →</span>
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
    `;
    document.head.appendChild(style);
  }
  cats?.addEventListener('click',e=>{
    const a=e.target.closest('[data-visual-category]'); if(!a)return;
    const panel=document.getElementById('catpanel'); if(!panel)return;
    const label=a.dataset.visualCategory;
    panel.innerHTML=`<div class="cp-head"><div><h3>${label}</h3><p>Explore curated ${label.toLowerCase()} collections from independent makers.</p></div></div>`;
  });
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
