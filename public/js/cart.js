class Cart {
  constructor() {
    this.items = JSON.parse(localStorage.getItem('peptideCart')) || [];
    this.stripeKey = '';
    this.stripe = null;
    this.init();
  }

  async init() {
    document.getElementById('cartBtn').addEventListener('click', () => this.toggle());
    document.getElementById('cartClose').addEventListener('click', () => this.close());
    document.getElementById('cartOverlay').addEventListener('click', () => this.close());
    document.getElementById('checkoutBtn').addEventListener('click', () => this.startCheckout());
    try {
      const res = await fetch('/api/config');
      const config = await res.json();
      this.stripeKey = config.stripePublishableKey;
    } catch (e) {}
    this.render();
  }

  add(product) {
    const existing = this.items.find(i => i.id === product.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      this.items.push({ id: product.id, name: product.name, price: product.price, quantity: 1, image: product.image || product.name });
    }
    this.save();
    this.render();
    this.showToast(`✓ ${product.name} agregado al carrito`);
  }

  remove(id) {
    this.items = this.items.filter(i => i.id !== id);
    this.save();
    this.render();
  }

  updateQuantity(id, delta) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) {
      this.remove(id);
      return;
    }
    this.save();
    this.render();
  }

  getTotal() {
    return this.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  }

  getCount() {
    return this.items.reduce((sum, i) => sum + i.quantity, 0);
  }

  save() {
    localStorage.setItem('peptideCart', JSON.stringify(this.items));
  }

  toggle() {
    document.getElementById('cartDrawer').classList.toggle('active');
    document.getElementById('cartOverlay').classList.toggle('active');
  }

  close() {
    document.getElementById('cartDrawer').classList.remove('active');
    document.getElementById('cartOverlay').classList.remove('active');
  }

  render() {
    const container = document.getElementById('cartItems');
    const footer = document.getElementById('cartFooter');
    const count = document.getElementById('cartCount');
    const total = document.getElementById('cartTotal');

    count.textContent = this.getCount();

    if (this.items.length === 0) {
      container.innerHTML = `
        <div class="cart-empty">
          <span class="cart-empty-icon">&#128722;</span>
          <p>Tu carrito está vacío</p>
          <p class="cart-empty-sub">Explora nuestro catálogo y agrega productos</p>
        </div>
      `;
      footer.style.display = 'none';
      return;
    }

    footer.style.display = 'block';
    total.textContent = `${this.getTotal().toFixed(2)} USD`;

    container.innerHTML = this.items.map(item => `
      <div class="cart-item">
        <div class="cart-item-img" style="background:${item.color || '#1a1a3e'};display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;color:var(--accent2)">${item.name}</div>
        <div class="cart-item-details">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">${item.price.toFixed(2)} USD</div>
          <div class="cart-item-actions">
            <button class="qty-btn" onclick="cart.updateQuantity(${item.id}, -1)">-</button>
            <span class="cart-item-qty">${item.quantity}</span>
            <button class="qty-btn" onclick="cart.updateQuantity(${item.id}, 1)">+</button>
            <button class="cart-item-remove" onclick="cart.remove(${item.id})">Eliminar</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  showToast(message, isError = false) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `toast${isError ? ' error' : ''}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  }

  async startCheckout() {
    if (!this.items.length) {
      this.showToast('El carrito está vacío', true);
      return;
    }

    try {
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: this.items.map(i => ({ id: i.id, quantity: i.quantity })),
          shipping: { name: '' }
        })
      });

      if (!response.ok) throw new Error('Error del servidor');

      const data = await response.json();
      this.openCheckoutModal(data.clientSecret, data.orderId);
    } catch (err) {
      console.error('Checkout error:', err);
      this.showToast('Error al iniciar el pago. Stripe no está configurado. Usa la opción de cripto.', true);
    }
  }

  openCheckoutModal(clientSecret, orderId) {
    const modal = document.getElementById('checkoutModal');
    const overlay = modal.querySelector('.checkout-overlay');
    const content = modal.querySelector('.checkout-content');

    const total = this.getTotal();
    const usdtAmount = total.toFixed(2);
    const usdtAddress = 'TXxRkLon8vLGdKjV7zqKjYq6dJ9xkBz5NB';

    content.innerHTML = `
      <button class="checkout-close" id="checkoutModalClose">&times;</button>
      <h2>Finalizar Pedido</h2>
      <p>Elige tu método de pago</p>
      <div class="checkout-summary">
        ${this.items.map(i => `
          <div class="checkout-summary-item">
            <span>${i.name} x${i.quantity}</span>
            <span>${(i.price * i.quantity).toFixed(2)} USD</span>
          </div>
        `).join('')}
        <div class="checkout-summary-total">
          <span>Total</span>
          <span>${total.toFixed(2)} USD</span>
        </div>
      </div>

      <div class="payment-methods">
        <div class="payment-method crypto-method" id="cryptoOption">
          <div class="payment-method-header">
            <span class="payment-method-icon">₿</span>
            <span><strong>Pagar con USDT / USDC</strong><br><small>Recomendado - Sin comisiones</small></span>
          </div>
          <div class="crypto-details" id="cryptoDetails">
            <div class="crypto-info">
              <p>Envía exactamente <strong>${usdtAmount} USDT/USDC</strong> a la siguiente dirección (Red TRC20):</p>
              <div class="crypto-address">
                <code id="cryptoAddress">${usdtAddress}</code>
                <button class="copy-btn" onclick="copyAddress()">📋 Copiar</button>
              </div>
              <p class="crypto-note">Una vez realizado el pago, envíanos el comprobante por WhatsApp <strong>+57 300 123 4567</strong> y procesamos tu pedido inmediatamente.</p>
              <button class="submit-btn" onclick="cart.cryptoPayment()">✓ Ya envié el pago</button>
            </div>
          </div>
        </div>

        <div class="payment-method stripe-method" id="stripeOption">
          <div class="payment-method-header">
            <span class="payment-method-icon">💳</span>
            <span><strong>Pagar con Tarjeta</strong><br><small>Visa, Mastercard, Amex vía Stripe</small></span>
          </div>
          <div class="stripe-details" id="stripeDetails">
            <form id="payment-form">
              <div id="payment-element"></div>
              <button class="submit-btn" id="submit-btn" style="margin-top:12px">
                Pagar ${total.toFixed(2)} USD
              </button>
              <div id="payment-message" style="color:var(--red);font-size:0.85rem;text-align:center;margin-top:8px;"></div>
            </form>
          </div>
        </div>
      </div>
    `;

    modal.classList.add('active');

    document.getElementById('checkoutModalClose').addEventListener('click', () => modal.classList.remove('active'));
    overlay.addEventListener('click', () => modal.classList.remove('active'));

    document.getElementById('cryptoOption').addEventListener('click', (e) => {
      if (e.target.closest('.copy-btn') || e.target.closest('.submit-btn')) return;
      document.getElementById('cryptoDetails').classList.toggle('active');
    });
    document.getElementById('stripeOption').addEventListener('click', (e) => {
      if (e.target.closest('#submit-btn') || e.target.closest('#payment-form')) return;
      document.getElementById('stripeDetails').classList.toggle('active');
    });

    if (typeof Stripe !== 'undefined' && this.stripeKey) {
      this.initStripePayment(clientSecret);
    } else {
      document.getElementById('stripeOption').style.opacity = '0.5';
      document.getElementById('payment-message').textContent = 'Stripe no está disponible, pero puedes pagar con USDT/USDC';
    }
  }

  cryptoPayment() {
    this.showToast('✅ ¡Gracias! Te contactaremos por WhatsApp para confirmar tu pedido.');
    this.items = [];
    this.save();
    this.render();
    document.getElementById('checkoutModal').classList.remove('active');
    this.close();
  }

  initStripePayment(clientSecret) {
    try {
      if (!this.stripeKey) return;
      const stripe = Stripe(this.stripeKey);
      const elements = stripe.elements({
        clientSecret,
        appearance: {
          theme: 'night',
          variables: {
            colorPrimary: '#6c5ce7',
            colorBackground: '#12122a',
            colorText: '#e8e8f0',
            colorDanger: '#e74c3c',
            fontFamily: 'Inter, sans-serif',
            borderRadius: '10px'
          }
        }
      });

      const paymentElement = elements.create('payment');
      paymentElement.mount('#payment-element');

      const form = document.getElementById('payment-form');
      const submitBtn = document.getElementById('submit-btn');

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner"></span> Procesando...';

        const { error } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: window.location.origin + '/payment-success.html',
          },
          redirect: 'if_required'
        });

        if (error) {
          document.getElementById('payment-message').textContent = error.message || 'Error al procesar el pago';
          submitBtn.disabled = false;
          submitBtn.innerHTML = `Pagar ${this.getTotal().toFixed(2)} USD`;
        } else {
          this.showToast('¡Pago exitoso! Gracias por tu compra.');
          this.items = [];
          this.save();
          this.render();
          document.getElementById('checkoutModal').classList.remove('active');
          this.close();
        }
      });
    } catch (err) {
      console.error('Stripe init error:', err);
    }
  }
}

window.copyAddress = function() {
  const addr = document.getElementById('cryptoAddress');
  if (addr) {
    navigator.clipboard.writeText(addr.textContent).then(() => {
      document.querySelector('.copy-btn').textContent = '✅ Copiado';
      setTimeout(() => { document.querySelector('.copy-btn').textContent = '📋 Copiar'; }, 2000);
    });
  }
};
