// Shared product components — markup mirrors the reference HTML (productCard, sectionHead).
import { safe, toast } from './dom.js';
import { formatMoney, state, toggleWishlist, addToCart } from './store.js';
import { byId } from './data.js';

// Compare list lives on the app shell for both card checkboxes and the dock.
export const isCompare = (id) => (window.__compare || []).includes(id);

export function productCard(p, i = 0, eager = false) {
  const inWish = state.wishlist.includes(p.id);
  const isComp = isCompare(p.id);
  const low = p.stock <= 4;
  return `<article class="product-card" style="--i:${i}"><div class="product-image"><a href="#/product/${p.slug}" aria-label="View ${safe(p.name)}"><img src="${p.image}" alt="${safe(p.name)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async"></a>${p.fresh ? '<span class="product-badge">Just landed</span>' : p.old > p.price ? '<span class="product-badge sale">A little less</span>' : ''}${low ? `<span class="stock-chip"><i aria-hidden="true"></i>${p.stock === 1 ? 'Last one' : `Only ${p.stock} left`}</span>` : ''}<button class="heart ${inWish ? 'active' : ''}" data-wish="${p.id}" aria-label="${inWish ? 'Remove from' : 'Add to'} wishlist"><svg viewBox="0 0 24 24"><path d="M20.8 8.8c0 5.2-8.8 10.2-8.8 10.2S3.2 14 3.2 8.8A4.4 4.4 0 0 1 12 6.6a4.4 4.4 0 0 1 8.8 2.2Z"/></svg></button><div class="quick"><button class="btn" data-add="${p.id}">Add to bag <span class="arrow">↗</span></button><button class="btn quick-look" data-quickview="${p.id}" type="button">Quick look</button></div></div><div class="product-info"><div class="product-meta"><span>${safe(p.category)}</span><span>${safe(p.age)}</span></div><h3><a href="#/product/${p.slug}">${safe(p.name)}</a></h3><div class="rating"><span class="stars" aria-hidden="true">★★★★★</span><span class="rating-copy"><b>${p.rating}</b> · ${p.reviews} notes</span></div><div class="price-row"><span class="price">${formatMoney(p.price)}</span>${p.old > p.price ? `<span class="old-price">${formatMoney(p.old)}</span>` : ''}</div><div class="product-quickline">${safe(p.benefit)}</div><label class="compare-row"><input type="checkbox" data-compare="${p.id}" ${isComp ? 'checked' : ''}><span class="compare-box" aria-hidden="true"></span><span class="compare-text">Compare</span></label></div></article>`;
}

export function sectionHead(kicker, title, desc = '', link = '', linkText = 'Explore all') {
  return `<div class="section-head reveal"><div><div class="mono muted">${kicker}</div><h2>${title}</h2></div>${desc ? `<p>${desc}</p>` : ''}${link ? `<a class="text-link" href="${link}">${linkText} <span>↗</span></a>` : ''}</div>`;
}

export function refreshHearts(root = document) {
  root.querySelectorAll('[data-wish]').forEach((b) => {
    const active = state.wishlist.includes(b.dataset.wish);
    if (b.classList.contains('heart')) {
      b.classList.toggle('active', active);
      b.setAttribute('aria-label', `${active ? 'Remove from' : 'Add to'} wishlist`);
    } else {
      const t = b.textContent.trim();
      if (t === '♥' || t === '♡') b.textContent = active ? '♥' : '♡';
    }
  });
}

// Delegated wishlist / add-to-bag / compare handling for the whole document.
export function bindProductActions(root = document) {
  root.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) {
      e.preventDefault(); e.stopPropagation();
      const p = byId(add.dataset.add);
      if (p) { addToCart({ productId: p.id, unitPrice: p.price, name: p.name, image: p.image }); toast('Added to your bag.', p.name); }
      return;
    }
    const wish = e.target.closest('[data-wish]');
    if (wish) {
      e.preventDefault(); e.stopPropagation();
      const added = toggleWishlist(wish.dataset.wish);
      toast(added ? 'Saved for later.' : 'Removed from saved things.', added ? '♡' : '');
      refreshHearts(root);
      return;
    }
  });
  root.addEventListener('change', (e) => {
    const cmp = e.target.closest('[data-compare]');
    if (cmp) window.__appToggleCompare?.(cmp.dataset.compare, cmp.checked);
  });
}
