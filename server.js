require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

app.use(cors(isProd ? {
  origin: process.env.ORIGIN || true,
  methods: ['GET', 'POST'],
  maxAge: 86400
} : {}));

app.use(express.json({ limit: '10kb' }));
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use((req, res, next) => {
  if (isProd && req.headers['x-forwarded-proto'] !== 'https' && req.headers.host) {
    return res.redirect('https://' + req.headers.host + req.url);
  }
  next();
});

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: isProd, httpOnly: true, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 }
}));

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.warn('⚠️  ADVERTENCIA: ACCESS_TOKEN no configurado. La página será accesible sin restricción.');
}

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (!ACCESS_TOKEN) return next();
  if (req.session.authorized) return next();
  if (req.query.token === ACCESS_TOKEN) {
    req.session.authorized = true;
    return res.redirect('/');
  }
  res.status(401).send('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Acceso Restringido</title><style>body{margin:0;background:#0a0a0f;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:.5rem;text-align:center;padding:1rem}h1{color:#00d4aa;font-size:2rem}.sub{color:#666;font-size:.9rem}.lock{font-size:3rem}</style></head><body><div class="lock">🔒</div><h1>Acceso Restringido</h1><p class="sub">Esta página es privada. Solo visible para invitados autorizados.</p><p class="sub" style="margin-top:2rem;font-size:.8rem">PeptideShop &mdash; Colombia</p></body></html>');
});

app.use(express.static('public'));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo en 15 minutos.' }
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Has superado el límite de mensajes. Intenta de nuevo en 1 hora.' }
});

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').trim().slice(0, 2000);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

app.use('/api/', apiLimiter);

const products = JSON.parse(fs.readFileSync('./data/products.json', 'utf8'));
let orders = [];

const botKnowledge = {
  saludos: ['hola', 'buenas', 'hey', 'hi', 'hello', 'buenos días', 'buenas tardes', 'qué tal'],
  envio: ['envío', 'envio', 'enviar', 'envían', 'shipping', 'entrega', 'llegar', 'cuánto tarda', 'demora', 'tiempo de envío', 'colombia', 'latinoamérica', 'latam', 'américa latina', 'bogotá', 'medellín'],
  pago: ['pago', 'pagar', 'tarjeta', 'paypal', 'stripe', 'transferencia', 'bitcoin', 'cripto', 'métodos de pago', 'usdt', 'usdc', 'nequi', 'daviplata', 'bancolombia', 'crypto'],
  producto: ['producto', 'péptido', 'peptido', 'catalogo', 'tienes', 'venden', 'comprar', 'precio'],
  dosis: ['dosis', 'dosificación', 'dosificacion', 'cuánto', 'cómo se usa', 'administración', 'administrar', 'inyectar'],
  efectos: ['efectos', 'efectos secundarios', 'side effects', 'contraindicaciones', 'seguro', 'peligro', 'daño'],
  almacenamiento: ['almacenar', 'almacenamiento', 'guardar', 'nevera', 'refrigerar', 'congelar', 'conservar'],
  calidad: ['calidad', 'pureza', 'hplc', 'gmp', 'laboratorio', 'certificado', 'análisis', 'terceros', 'testeado'],
  devolucion: ['devolución', 'devolucion', 'reembolso', 'reembolsar', 'garantía', 'garantia', 'cambio', 'cambiar'],
  contacto: ['contacto', 'hablar', 'persona', 'teléfono', 'telefono', 'email', 'correo', 'whatsapp']
};

const botResponses = {
  saludos: ['¡Hola! Bienvenido a PeptideShop. Soy tu asistente virtual. ¿En qué puedo ayudarte hoy? Puedes preguntarme sobre productos, dosis, envíos o cualquier duda que tengas.',
    '¡Hola! Encantado de verte. Estoy aquí para resolver tus dudas sobre péptidos. ¿Qué necesitas saber?'],
  envio: ['🇨🇴 Realizamos envíos a COLOMBIA y toda Latinoamérica.\n\n<b>Colombia:</b> 3-7 días hábiles\n<b>Resto de LATAM:</b> 5-12 días hábiles según el país\n\nTodos los envíos incluyen número de seguimiento y embalaje discreto (sin referencias a péptidos).\n\n🚚 Envío GRATIS en pedidos superiores a 200 USD.',
    'Los envíos son discretos y completamente anónimos. El embalaje no contiene ninguna referencia al contenido.\n\nAceptamos pagos en:<br>💰 USDT / USDC (TRC20)<br>🏦 Transferencia bancaria Colombia<br>📱 Nequi, Daviplata<br>💳 Tarjetas Visa/Mastercard'],
  pago: ['💰 <b>Métodos de pago para Colombia y LATAM:</b>\n\n<b>1. Criptomonedas (recomendado)</b>\n• USDT (TRC20) — Stablecoin 1:1 con USD\n• USDC (TRC20/ERC20) — Stablecoin 1:1 con USD\n• Bitcoin (BTC)\n\n<b>2. Transferencia bancaria</b>\n• Bancolombia\n• Nequi\n• Daviplata\n\n<b>3. Tarjetas</b>\n• Visa, Mastercard, American Express (vía Stripe)\n\n💎 <b>Beneficio crypto:</b> Tus USDT/USDC valen exactamente 1 USD cada uno, sin fluctuaciones. Ideal para mantener el valor de tu dinero.'],
  producto: ['Disponemos de un amplio catálogo de péptidos de alta pureza (>99% HPLC). Algunos de nuestros más vendidos son:\n• BPC-157 (regeneración)\n• Semaglutide (pérdida de peso)\n• Tirzepatide (el más potente para peso)\n• NAD+ (anti-envejecimiento)\n• CJC-1295 + Ipamorelin (GH stack)\n\nTodos nuestros productos son de laboratorio GMP.'],
  dosis: ['Las dosis varían según el péptido y tus objetivos. En la página de cada producto encontrarás la dosificación recomendada. Como regla general:\n• Péptidos regenerativos: 250-500 mcg/día\n• Péptidos GH: 200-300 mcg/día\n• GLP-1 (Semaglutide/Tirzepatide): iniciar con dosis baja e incrementar gradualmente.\n\n¿Sobre qué péptido necesitas información específica?'],
  efectos: ['Los péptidos son generalmente bien tolerados cuando se usan correctamente. Los efectos secundarios más comunes suelen ser leves:\n• Enrojecimiento temporal en el lugar de inyección\n• Ligero dolor de cabeza (primeros días)\n• Náuseas leves (especialmente GLP-1)\n\nImportante: Siempre consulta con un profesional de la salud antes de comenzar cualquier ciclo. No excedas las dosis recomendadas.'],
  almacenamiento: ['La mayoría de nuestros péptidos deben refrigerarse entre 2-8°C. Una vez reconstituidos, se mantienen estables hasta 7-10 días en nevera. No congelar. Mantener protegidos de la luz directa.\n\n• GHK-Cu puede mantenerse a temperatura ambiente\n• NAD+ es estable a temperatura ambiente por 30 días\n\nSiempre revisa las especificaciones de cada producto.'],
  calidad: ['Todos nuestros péptidos son sintetizados en laboratorios certificados GMP (Good Manufacturing Practices). Cada lote es analizado mediante HPLC y espectrometría de masas, garantizando una pureza >99%.\n\nProporcionamos certificados de análisis (CoA) para cada lote. La calidad es nuestra prioridad número uno.'],
  devolucion: ['Ofrecemos garantía de satisfacción del 100%. Si no estás conforme con tu pedido:\n• Puedes devolverlo en los primeros 14 días\n• Reembolso completo si el producto está sellado\n• Cambio gratuito por otro producto de igual valor\n• Si hay algún problema con la calidad, te reemplazamos el producto sin coste.'],
  contacto: ['Puedes contactarnos por los siguientes medios:\n\n📧 Email: info@peptideshop.com\n📱 WhatsApp: +57 300 123 4567\n💬 Chat en vivo: 24/7\n📍 Bogotá, Colombia\n\nEstamos listos para ayudarte con cualquier duda.'],
  default: ['No estoy seguro de entender tu pregunta. ¿Podrías reformularla? Puedo ayudarte con:\n• Información sobre productos y dosis\n• Envíos y formas de pago\n• Almacenamiento y calidad\n• Devoluciones y garantía\n\nO simplemente escribe "catálogo" para ver todos nuestros productos.']
};

function getBotResponse(message) {
  const msg = message.toLowerCase().trim();

  if (msg.includes('catálogo') || msg.includes('catalogo') || msg.includes('productos') || msg.includes('ver todo')) {
    return '¡Claro! Aquí un resumen de nuestro catálogo 🇨🇴\n\n<b>Más vendidos:</b>\n• Tirzepatide - 149.99 USD (pérdida de peso)\n• Semaglutide - 129.99 USD (pérdida de peso)\n• BPC-157 - 59.99 USD (regeneración)\n• NAD+ - 99.99 USD (anti-envejecimiento)\n• GHK-Cu - 44.99 USD (estética)\n\n💎 Todos los precios en USD. Aceptamos USDT/USDC al valor de 1:1.\n\nUsa el buscador para filtrar por categoría o nombre. ¿Te interesa alguno en específico?';
  }

  if (msg.includes('gracias') || msg.includes('thank')) {
    return '¡De nada! Si tienes más preguntas, aquí estoy. ¡Que tengas un excelente día! 😊';
  }

  let bestCategory = null;
  let maxMatches = 0;

  for (const [category, keywords] of Object.entries(botKnowledge)) {
    const matches = keywords.filter(kw => msg.includes(kw)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      bestCategory = category;
    }
  }

  if (bestCategory && maxMatches > 0) {
    const responses = botResponses[bestCategory];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  for (const product of products) {
    if (msg.includes(product.name.toLowerCase()) || msg.includes(product.fullName.toLowerCase())) {
      return `El <b>${product.name}</b> (${product.fullName}) es uno de nuestros productos estrella.\n\n<b>Precio:</b> ${product.price} USD (paga con USDT/USDC al 1:1)\n<b>Descripción:</b> ${product.description}\n\n<b>Beneficios principales:</b>\n${product.benefits.slice(0, 3).map(b => `• ${b}`).join('\n')}\n\n<b>Dosificación:</b> ${product.usage}\n\n¿Te gustaría agregarlo a tu carrito o tienes más preguntas sobre este producto?`;
    }
  }

  if (msg.length < 5) {
    return 'Dime, ¿en qué puedo ayudarte? Puedes preguntarme sobre productos, dosis, envíos, pagos... ¡lo que necesites!';
  }

  return botResponses.default[Math.floor(Math.random() * botResponses.default.length)];
}

app.get('/api/config', (req, res) => {
  res.json({
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    siteName: 'PeptideShop'
  });
});

app.get('/api/products', (req, res) => {
  res.json(products);
});

app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(product);
});

app.get('/api/products/category/:category', (req, res) => {
  const cat = req.params.category.normalize('NFC').toLowerCase();
  const filtered = products.filter(p =>
    p.category.normalize('NFC').toLowerCase() === cat
  );
  res.json(filtered);
});

app.post('/api/chat', (req, res) => {
  const message = sanitize(req.body.message || '');
  if (!message) return res.status(400).json({ error: 'Mensaje requerido' });
  if (message.length > 500) return res.status(400).json({ error: 'Mensaje demasiado largo' });
  const response = getBotResponse(message);
  res.json({ response, timestamp: new Date().toISOString() });
});

app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const { items, shipping } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Carrito inválido o vacío' });
    }

    const total = items.reduce((sum, item) => {
      if (!item.id || !item.quantity || item.quantity < 1) return sum;
      const product = products.find(p => p.id === item.id);
      return sum + (product ? product.price * Math.min(item.quantity, 99) : 0);
    }, 0);

    if (total <= 0) return res.status(400).json({ error: 'Carrito vacío' });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100),
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        order_id: uuidv4(),
        items: JSON.stringify(items.map(i => ({ id: i.id, qty: i.quantity })))
      }
    });

    const order = {
      id: paymentIntent.metadata.order_id,
      items,
      total,
      shipping: shipping || {},
      status: 'pending',
      paymentIntentId: paymentIntent.id,
      createdAt: new Date().toISOString()
    };
    orders.push(order);

    res.json({
      clientSecret: paymentIntent.client_secret,
      orderId: order.id
    });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: 'Error al procesar el pago' });
  }
});

app.post('/api/confirm-order', async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    const order = orders.find(o => o.paymentIntentId === paymentIntentId);
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

    if (paymentIntent.status === 'succeeded') {
      order.status = 'confirmed';
      order.confirmedAt = new Date().toISOString();
      res.json({ success: true, order });
    } else {
      res.json({ success: false, status: paymentIntent.status });
    }
  } catch (err) {
    console.error('Confirm error:', err);
    res.status(500).json({ error: 'Error al confirmar orden' });
  }
});

app.get('/api/orders/:id', (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
  res.json(order);
});

app.post('/api/newsletter', contactLimiter, (req, res) => {
  const email = sanitize(req.body.email || '');
  if (!email) return res.status(400).json({ error: 'Email requerido' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Email inválido' });
  console.log(`Newsletter signup: ${email}`);
  res.json({ success: true, message: '¡Gracias por suscribirte!' });
});

app.post('/api/contact', contactLimiter, (req, res) => {
  const name = sanitize(req.body.name || '');
  const email = sanitize(req.body.email || '');
  const message = sanitize(req.body.message || '');
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Email inválido' });
  console.log(`Contact: ${name} (${email}): ${message}`);
  res.json({ success: true, message: 'Mensaje recibido. Te responderemos pronto.' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n======================================`);
    console.log(`  PeptideShop - Servidor iniciado`);
    console.log(`  URL: http://localhost:${PORT}`);
    console.log(`  Stripe: ${process.env.STRIPE_PUBLISHABLE_KEY ? 'Configurado' : 'No configurado'}`);
    console.log(`======================================\n`);
  });
}
module.exports = app;
