const cart = new Cart();
const chatbot = new ChatBot();

let allProducts = [];

document.addEventListener('DOMContentLoaded', () => {
  fetchProducts();
  setupMobileMenu();
  setupFilters();
  setupSearch();
  setupFaq();
  setupContactForm();
  setupNewsletterForm();
});

function generateProductImage(product) {
  const [c1, c2] = product.color || ['#1a1a3e', '#0d0d2b'];
  const name = product.name;
  const cat = product.category;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <defs>
    <linearGradient id="bg_${product.id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${c1}"/>
      <stop offset="50%" style="stop-color:${c2}"/>
      <stop offset="100%" style="stop-color:#050510"/>
    </linearGradient>
    <linearGradient id="glow_${product.id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:rgba(108,92,231,0.15)"/>
      <stop offset="100%" style="stop-color:rgba(162,155,254,0.05)"/>
    </linearGradient>
    <pattern id="hex_${product.id}" patternUnits="userSpaceOnUse" width="40" height="69.28">
      <path d="M20 0 L40 11.54 L40 34.64 L20 46.18 L0 34.64 L0 11.54 Z" fill="none" stroke="rgba(108,92,231,0.06)" stroke-width="1"/>
      <path d="M20 69.28 L40 57.74 L40 34.64 L20 46.18 L0 34.64 L0 57.74 Z" fill="none" stroke="rgba(108,92,231,0.04)" stroke-width="1"/>
    </pattern>
    <filter id="shadow_${product.id}">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="rgba(0,0,0,0.3)"/>
    </filter>
  </defs>
  <rect width="400" height="300" fill="url(#bg_${product.id})"/>
  <rect width="400" height="300" fill="url(#hex_${product.id})"/>
  <circle cx="320" cy="50" r="120" fill="rgba(108,92,231,0.08)" filter="url(#glow)"/>
  <circle cx="80" cy="250" r="100" fill="rgba(162,155,254,0.05)" filter="url(#glow)"/>
  <circle cx="200" cy="150" r="80" fill="rgba(108,92,231,0.03)"/>
  <g transform="translate(200,130)">
    <text text-anchor="middle" font-family="'Courier New',monospace" font-size="13" fill="rgba(162,155,254,0.3)" dy="-25">${'◇'.repeat(8)}</text>
  </g>
  <text x="200" y="135" text-anchor="middle" font-family="'Inter','Segoe UI',sans-serif" font-size="32" font-weight="800" fill="white" filter="url(#shadow_${product.id})">${name}</text>
  <g transform="translate(200,175)">
    <rect x="-60" y="-12" width="120" height="24" rx="12" fill="rgba(108,92,231,0.2)" stroke="rgba(108,92,231,0.3)" stroke-width="0.5"/>
    <text text-anchor="middle" font-family="'Inter',sans-serif" font-size="10" fill="#a29bfe" dy="4">${cat.toUpperCase()}</text>
  </g>
  <g transform="translate(12,12)">
    <rect width="70" height="20" rx="4" fill="rgba(108,92,231,0.15)"/>
    <text x="35" y="14" text-anchor="middle" font-family="'Inter',sans-serif" font-size="7" fill="#a29bfe" font-weight="600">PEPTIDESHOP</text>
  </g>
  <g transform="translate(350,285)">
    <text text-anchor="end" font-family="'Courier New',monospace" font-size="8" fill="rgba(255,255,255,0.1)">⚗ HPLC >99%</text>
  </g>
</svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

async function fetchProducts() {
  try {
    const res = await fetch('/api/products');
    allProducts = await res.json();
    renderProducts(allProducts);
  } catch (err) {
    console.error('Error fetching products:', err);
    document.getElementById('productsGrid').innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-muted);">
        <p style="font-size:1.2rem;margin-bottom:8px;">Error al cargar productos</p>
        <p>Asegúrate de que el servidor esté funcionando</p>
      </div>
    `;
  }
}

function renderProducts(products) {
  const grid = document.getElementById('productsGrid');
  if (!products.length) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-muted);">
        <p style="font-size:1.2rem;">No se encontraron productos</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = products.map(p => `
    <div class="product-card" onclick="openProductModal(${p.id})">
      ${p.badge ? `<span class="product-badge" style="background:${p.badgeColor}">${p.badge}</span>` : ''}
      <div class="product-image" style="background:${p.color ? p.color[0] : '#1a1a3e'}">
        <img src="${generateProductImage(p)}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;">
      </div>
      <div class="product-info">
        <div class="product-category">${p.category}</div>
        <h3 class="product-name">${p.name}</h3>
        <div class="product-fullname">${p.fullName}</div>
        <div class="product-rating">
          <span class="stars">${'★'.repeat(Math.floor(p.rating))}${p.rating % 1 >= 0.5 ? '½' : ''}</span>
          <span class="rating-count">(${p.reviews})</span>
        </div>
        <div class="product-price">
          <span class="current-price">${p.price.toFixed(2)} USD</span>
          ${p.originalPrice ? `<span class="original-price">${p.originalPrice.toFixed(2)} USD</span>` : ''}
        </div>
        <button class="add-to-cart-btn" onclick="event.stopPropagation(); cart.add({id:${p.id},name:'${p.name}',price:${p.price},color:'${p.color ? p.color[0] : '#1a1a3e'}'})">
          Añadir al Carrito
        </button>
      </div>
    </div>
  `).join('');
}

function openProductModal(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;

  const modal = document.getElementById('productModal');
  const body = document.getElementById('modalBody');

  body.innerHTML = `
    <div class="modal-product">
      <div class="modal-product-image" style="background:${p.color ? p.color[0] : '#1a1a3e'}">
        <img src="${generateProductImage(p)}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;">
      </div>
      <div class="modal-product-info">
        <div class="product-category">${p.category}</div>
        <h2>${p.name}</h2>
        <div class="product-fullname">${p.fullName}</div>
        <div class="product-rating">
          <span class="stars">${'★'.repeat(Math.floor(p.rating))}${p.rating % 1 >= 0.5 ? '½' : ''}</span>
          <span class="rating-count">${p.rating} (${p.reviews} reseñas)</span>
        </div>
        <div class="product-price">
          <span class="current-price">${p.price.toFixed(2)} USD</span>
          ${p.originalPrice ? `<span class="original-price">${p.originalPrice.toFixed(2)} USD</span>` : ''}
        </div>
        <p class="modal-description">${p.description}</p>
        <div class="modal-benefits">
          <h4>Beneficios Principales</h4>
          <ul>${p.benefits.map(b => `<li>${b}</li>`).join('')}</ul>
        </div>
        <div class="modal-usage">
          <strong>💉 Dosificación</strong>
          ${p.usage}
        </div>
        <div class="modal-specs">
          ${Object.entries(p.specs).map(([k, v]) => `
            <div class="modal-spec">
              <span>${k}</span>
              <span>${v}</span>
            </div>
          `).join('')}
        </div>
        <button class="add-to-cart-btn" onclick="cart.add({id:${p.id},name:'${p.name}',price:${p.price},color:'${p.color ? p.color[0] : '#1a1a3e'}'}); document.getElementById('productModal').classList.remove('active');">
          Añadir al Carrito - ${p.price.toFixed(2)} USD
        </button>
      </div>
    </div>
  `;

  modal.classList.add('active');
  modal.querySelector('.modal-overlay').addEventListener('click', () => modal.classList.remove('active'));
  modal.querySelector('.modal-close').addEventListener('click', () => modal.classList.remove('active'));
}

function setupMobileMenu() {
  const btn = document.getElementById('mobileMenuBtn');
  const menu = document.getElementById('mobileMenu');
  btn.addEventListener('click', () => {
    menu.classList.toggle('active');
    btn.textContent = menu.classList.contains('active') ? '✕' : '☰';
  });
  menu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      menu.classList.remove('active');
      btn.textContent = '☰';
    });
  });
}

function setupFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      if (filter === 'all') {
        renderProducts(allProducts);
      } else {
        renderProducts(allProducts.filter(p => p.category === filter));
      }
    });
  });
}

function setupSearch() {
  const input = document.getElementById('searchInput');
  let timeout;
  input.addEventListener('input', () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      const q = input.value.toLowerCase().trim();
      if (!q) {
        renderProducts(allProducts);
        return;
      }
      const filtered = allProducts.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.fullName.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
      renderProducts(filtered);
    }, 300);
  });
}

function setupFaq() {
  document.querySelectorAll('.faq-item').forEach(item => {
    item.addEventListener('click', () => {
      item.classList.toggle('active');
    });
  });
}

function setupContactForm() {
  const form = document.getElementById('contactForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputs = form.querySelectorAll('input, textarea');
    const data = {
      name: inputs[0].value,
      email: inputs[1].value,
      message: inputs[2].value
    };

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        cart.showToast('✓ Mensaje enviado. Te responderemos pronto.');
        form.reset();
      } else {
        cart.showToast('Error al enviar mensaje', true);
      }
    } catch {
      cart.showToast('Error de conexión', true);
    }
  });
}

function setupNewsletterForm() {
  const form = document.getElementById('newsletterForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.querySelector('input').value;

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        cart.showToast('✓ ¡Gracias por suscribirte!');
        form.reset();
      }
    } catch {
      cart.showToast('Error al suscribirte', true);
    }
  });
}
