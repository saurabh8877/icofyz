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
