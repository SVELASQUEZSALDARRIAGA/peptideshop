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

const DISCLAIMER = '\n\n<i>Nota: Esta información es educativa y basada en literatura científica. PeptideShop recomienda la supervisión de un profesional de la salud. Nuestros productos son para fines de investigación y optimización física.</i>';

const LEAD_CAPTURE = '\n\n📋 <b>¿Necesitas una asesoría más detallada?</b>\nPara brindarte una asesoría técnica personalizada sobre este protocolo, por favor compárteme tu <b>correo electrónico o WhatsApp</b> y un especialista te contactará a la brevedad.';

const botKnowledge = {
  saludos: ['hola', 'buenas', 'hey', 'hi', 'hello', 'buenos días', 'buenas tardes', 'qué tal', 'buen día', 'buenas noches'],
  envio: ['envío', 'envio', 'enviar', 'envían', 'shipping', 'entrega', 'llegar', 'cuánto tarda', 'demora', 'tiempo de envío', 'colombia', 'latinoamérica', 'latam', 'américa latina', 'bogotá', 'medellín', 'seguimiento', 'tracking', 'discreto', 'embalaje'],
  pago: ['pago', 'pagar', 'tarjeta', 'paypal', 'stripe', 'transferencia', 'bitcoin', 'cripto', 'métodos de pago', 'usdt', 'usdc', 'nequi', 'daviplata', 'bancolombia', 'crypto', 'comisión', 'comision', 'fee', 'estable'],
  producto: ['producto', 'péptido', 'peptido', 'catalogo', 'catálogo', 'tienes', 'venden', 'comprar', 'precio', 'oferta', 'disponible', 'variedad'],
  dosis: ['dosis', 'dosificación', 'dosificacion', 'cuánto', 'cómo se usa', 'administración', 'administrar', 'inyectar', 'reconstituir', 'agua bacteriostática', 'bac water', 'protocolo', 'ciclo', 'stack', 'apilar'],
  efectos: ['efectos', 'efectos secundarios', 'side effects', 'contraindicaciones', 'seguro', 'peligro', 'daño', 'tóxico', 'toxicidad', 'colateral', 'reacción', 'adverso'],
  almacenamiento: ['almacenar', 'almacenamiento', 'guardar', 'nevera', 'refrigerar', 'congelar', 'conservar', 'frigorífico', 'refrigeración', 'estable', 'polvo', 'liofilizado', 'reconstituido'],
  calidad: ['calidad', 'pureza', 'hplc', 'gmp', 'laboratorio', 'certificado', 'análisis', 'analisis', 'terceros', 'testeado', 'lote', 'coa', 'certificación', 'certificado'],
  devolucion: ['devolución', 'devolucion', 'reembolso', 'reembolsar', 'garantía', 'garantia', 'cambio', 'cambiar', 'reemplazo', 'satisfecho', 'conforme'],
  contacto: ['contacto', 'hablar', 'persona', 'teléfono', 'telefono', 'email', 'correo', 'whatsapp', 'asesor', 'especialista', 'ayuda humana']
};

const botResponses = {
  saludos: [
    '¡Hola! Soy <b>PeptideBot</b>, asistente experto de PeptideShop. Estoy aquí para brindarte información técnica detallada sobre nuestro catálogo de péptidos de alta pureza (>98%). ¿En qué puedo ayudarte hoy? Puedes consultarme sobre productos, dosis, protocolos, envíos o formas de pago.',
    'Bienvenido a PeptideShop, soy <b>PeptideBot</b> 🤖. Cuento con información detallada de cada producto de nuestro catálogo, incluyendo beneficios, mecanismos de acción y dosificación. ¿Qué te gustaría saber?'
  ],
  envio: [
    '🇨🇴 <b>Logística de envíos PeptideShop</b>\n\n📦 <b>Cobertura:</b> Colombia y toda Latinoamérica\n⏱ <b>Procesamiento:</b> 24 horas hábiles\n🚚 <b>Tiempo de entrega:</b>\n&nbsp;&nbsp;• Colombia: 3-7 días hábiles\n&nbsp;&nbsp;• Resto de LATAM: 5-12 días según país\n🔒 <b>Embalaje discreto:</b> Sin referencias a péptidos en el exterior\n📍 <b>Número de seguimiento:</b> Incluido en todos los pedidos\n\n🚚 <b>Envío GRATIS</b> en pedidos superiores a 200 USD.\n\n💡 <i>Los productos se envían en presentación liofilizada. Requieren reconstitución con agua bacteriostática antes de su uso.</i>',
    '📦 <b>Política de envíos</b>\n\nTodos nuestros pedidos se procesan en un máximo de 24 horas y se envían con embalaje completamente discreto (sin logotipos ni referencias al contenido). Aceptamos pagos en USDT/USDC, transferencias bancarias Colombia (Nequi, Daviplata, Bancolombia) y tarjetas Visa/Mastercard vía Stripe.\n\n¿Te gustaría conocer el costo de envío a tu ciudad?'
  ],
  pago: [
    '💰 <b>Métodos de pago — Colombia y LATAM</b>\n\n<b>1. Criptomonedas (recomendado)</b>\n• USDT (TRC20) — Paridad 1:1 con USD\n• USDC (TRC20/ERC20) — Paridad 1:1 con USD\n• Bitcoin (BTC)\n✅ Sin comisiones ni fluctuaciones\n\n<b>2. Transferencia bancaria Colombia</b>\n• Bancolombia\n• Nequi\n• Daviplata\n\n<b>3. Tarjetas internacionales</b>\n• Visa, Mastercard, American Express (vía Stripe)\n\n💎 <b>Beneficio crypto:</b> Tus USDT/USDC mantienen su valor exacto en USD, sin volatilidad. Ideal para proteger tu poder adquisitivo.'
  ],
  producto: [
    '🔬 <b>Catálogo PeptideShop</b>\n\nDisponemos de péptidos de alta pureza verificada (>98% HPLC). Todos nuestros productos son sintetizados en laboratorios certificados GMP. Contamos con las siguientes categorías:\n\n🏋️ <b>Pérdida de peso:</b> Tirzepatide, Semaglutide, Retatrutide\n🔄 <b>Regeneración:</b> BPC-157, TB-500\n⏳ <b>Anti-envejecimiento:</b> NAD+, GHK-Cu, Ipamorelin\n📈 <b>Rendimiento:</b> CJC-1295, PT-141, AOD-9604\n\n¿Te interesa alguna categoría o producto en específico?'
  ],
  dosis: [
    '📐 <b>Guía general de dosificación</b>\n\nLas dosis varían según el péptido, tus objetivos y experiencia previa. Como referencia general:\n\n• Péptidos regenerativos (BPC-157, TB-500): 250-500 mcg/día\n• Péptidos GH (CJC-1295, Ipamorelin): 200-300 mcg/día\n• GLP-1 (Semaglutide, Tirzepatide): Iniciar con dosis baja e incrementar gradualmente cada 4 semanas\n• NAD+: 250-1000 mg/ciclo\n\n⚠️ <b>Preparación:</b> Todos los productos se envían liofilizados. Requieren reconstitución con agua bacteriostática (no incluida). Una vez reconstituidos, refrigerar a 2-8°C y usar dentro de 7-10 días.\n\n¿Sobre qué péptido necesitas información específica de dosificación?' + DISCLAIMER,
    '💉 <b>Protocolo de administración</b>\n\nLa mayoría de nuestros péptidos se administran por vía subcutánea (SC) o intramuscular (IM), dependiendo del compuesto:\n\n• SC: BPC-157, Semaglutide, Tirzepatide, CJC-1295, Ipamorelin\n• IM/SC: TB-500, NAD+\n• Tópico: GHK-Cu (cosmético)\n\n<b>Agua bacteriostática:</b> No incluida. Se requiere para reconstituir el péptido liofilizado. Volumen recomendado: 1-2 mL generalmente.\n\n¿Te gustaría que profundice en algún aspecto?' + DISCLAIMER
  ],
  efectos: [
    '⚠️ <b>Perfil de seguridad y tolerabilidad</b>\n\nLos péptidos son generalmente bien tolerados cuando se usan dentro de los parámetros recomendados. Los efectos adversos reportados son usualmente leves y transitorios:\n\n• Eritema o inflamación local en el sitio de inyección\n• Cefalea leve (primeros días de adaptación)\n• Náuseas transitorias (especialmente con GLP-1)\n• Fatiga inicial en algunos compuestos\n\n⚠️ <b>Importante:</b> Estos productos son para fines de investigación y optimización física. No diagnosticamos patologías ni recetamos tratamientos. Ante cualquier condición de salud crónica, consulta con un profesional de la salud.' + DISCLAIMER
  ],
  almacenamiento: [
    '❄️ <b>Almacenamiento y conservación</b>\n\n<b>Estado liofilizado (polvo):</b>\n• Almacenar a temperatura ambiente (15-25°C)\n• Proteger de la luz directa y la humedad\n• Estable hasta 12 meses en condiciones óptimas\n\n<b>Estado reconstituido (líquido):</b>\n• Refrigeración obligatoria: 2-8°C\n• Estable 7-10 días en nevera\n• NO congelar una vez reconstituido\n• NO exponer a temperaturas superiores a 25°C\n\n<b>Excepciones:</b>\n• GHK-Cu: estable a temperatura ambiente\n• NAD+: estable a temperatura ambiente hasta 30 días\n\n💡 <i>Siempre revisa las especificaciones de cada producto en nuestra tienda.</i>'
  ],
  calidad: [
    '🏆 <b>Control de calidad PeptideShop</b>\n\nTodos nuestros péptidos son sintetizados en laboratorios certificados bajo Buenas Prácticas de Manufactura (GMP). Implementamos estrictos controles de calidad:\n\n✅ Pureza >98% verificada por HPLC\n✅ Espectrometría de masas (MS) para verificación de peso molecular\n✅ Certificado de Análisis (CoA) disponible por lote\n✅ Cadena de suministro auditada\n✅ Embalaje con control de temperatura\n\n📄 <b>¿Quieres ver el CoA de un lote específico?</b> Solicítalo a tu asesor y te lo compartiremos.\n\nNuestro diferencial: transparencia total en la calidad de cada producto.'
  ],
  devolucion: [
    '🔄 <b>Política de devoluciones y garantía</b>\n\nRespaldo tu compra con nuestra garantía de satisfacción:\n\n• <b>14 días</b> para devolución desde la recepción\n• Reembolso completo si el producto está sellado y sin abrir\n• Cambio gratuito por otro producto de igual valor\n• Reemplazo sin costo si hay algún problema de calidad verificado\n\n📱 ¿Tienes un problema con tu pedido? Contáctanos vía WhatsApp al +57 300 123 4567 y lo resolveremos de inmediato.'
  ],
  contacto: [
    '📬 <b>Canales de contacto</b>\n\nEstamos disponibles para resolver cualquier duda:\n\n📧 Email: info@peptideshop.com\n📱 WhatsApp: +57 300 123 4567\n💬 Chat web: 24/7 (estoy aquí)\n📍 Bogotá, Colombia\n\n<b>Horario de atención:</b>\nLunes a viernes: 8:00 AM - 6:00 PM\nSábados: 9:00 AM - 2:00 PM\n\n¿En qué más puedo ayudarte?'
  ],
  asesoria: [
    '📋 <b>¿Buscas una asesoría personalizada?</b>\n\nSi necesitas ayuda con un protocolo complejo, un stack personalizado de múltiples péptidos, o tienes problemas con un pedido existente, puedo derivarte con un especialista.' + LEAD_CAPTURE + '\n\nMientras tanto, ¿te gustaría conocer más sobre algún producto en específico?'
  ],
  protocolo: [
    '🔬 <b>Protocolos personalizados</b>\n\nDiseñar un protocolo efectivo requiere considerar múltiples variables: objetivos específicos, experiencia previa, tolerancia individual y posible interacción entre compuestos.' + LEAD_CAPTURE + '\n\n¿Te gustaría mientras tanto explorar nuestro catálogo de productos?'
  ],
  default: [
    'Soy <b>PeptideBot</b>, tu asistente técnico de PeptideShop. Puedo ayudarte con:\n\n🔬 Información detallada de productos y sus mecanismos de acción\n📐 Dosis y protocolos de administración\n📦 Envíos discretos a Colombia y LATAM\n💰 Métodos de pago: USDT/USDC, transferencias, tarjetas\n❄️ Almacenamiento y conservación\n🏆 Certificaciones de calidad y pureza\n\n¿Sobre qué tema te gustaría consultarme?'
  ]
};

function getBotResponse(message) {
  const msg = message.toLowerCase().trim();

  if (msg.includes('catálogo') || msg.includes('catalogo') || msg.includes('ver todo') || msg.includes('productos disponibles')) {
    return '📋 <b>Catálogo completo PeptideShop</b>\n\n<b>🏆 Más vendidos:</b>\n• <b>Tirzepatide</b> - 149.99 USD (pérdida de peso)\n• <b>Semaglutide</b> - 129.99 USD (pérdida de peso)\n• <b>BPC-157</b> - 59.99 USD (regeneración)\n• <b>NAD+</b> - 99.99 USD (anti-envejecimiento)\n• <b>GHK-Cu</b> - 44.99 USD (estética)\n• <b>CJC-1295</b> - 69.99 USD (GH secretagogo)\n• <b>Ipamorelin</b> - 54.99 USD (GH secretagogo)\n• <b>TB-500</b> - 74.99 USD (regeneración)\n• <b>AOD-9604</b> - 64.99 USD (pérdida de grasa)\n• <b>PT-141</b> - 49.99 USD (rendimiento)\n• <b>Retatrutide</b> - 169.99 USD (pérdida de peso)\n• <b>MOTS-c</b> - 89.99 USD (metabolismo)\n\n💎 Todos los precios en USD. Aceptamos USDT/USDC al valor 1:1.\n\n¿Te interesa algún producto en específico? Puedo darte información detallada sobre beneficios, dosis y protocolo.';
  }

  if (msg.includes('gracias') || msg.includes('thank') || msg.includes('gracias totales')) {
    return '¡Por nada! Recuerda que estoy aquí para resolver cualquier duda técnica. Si en el futuro necesitas asesoría sobre protocolos más complejos, no dudes en consultarme. ¡Éxito en tus objetivos!' + DISCLAIMER;
  }

  const asesoriaKeywords = ['protocolo personalizado', 'stack', 'ciclo completo', 'asesoría', 'ayuda personalizada', 'contactar experto', 'problema con pedido', 'cambio producto', 'devolver'];
  const needsLeadCapture = asesoriaKeywords.some(kw => msg.includes(kw));
  if (needsLeadCapture) {
    const responses = botResponses.asesoria;
    return responses[Math.floor(Math.random() * responses.length)];
  }

  const protocoloKeywords = ['combinar', 'combinación', 'apilar', 'stack', 'múltiples', 'varios péptidos', 'personalizado', 'larga duración'];
  const needsProtocolHelp = protocoloKeywords.some(kw => msg.includes(kw));
  if (needsProtocolHelp) {
    const responses = botResponses.protocolo;
    return responses[Math.floor(Math.random() * responses.length)];
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
    let response = responses[Math.floor(Math.random() * responses.length)];
    return response;
  }

  for (const product of products) {
    if (msg.includes(product.name.toLowerCase()) || msg.includes(product.fullName.toLowerCase())) {
      return `🔬 <b>${product.name}</b> (${product.fullName})\n\n📋 <b>Descripción:</b> ${product.description}\n\n✅ <b>Beneficios principales:</b>\n${product.benefits.map((b, i) => `${i + 1}. ${b}`).join('\n')}\n\n📐 <b>Dosificación estándar:</b> ${product.usage}\n\n💰 <b>Precio:</b> ${product.price} USD (paga con USDT/USDC al 1:1)\n\n💡 <i>Producto liofilizado. Requiere reconstitución con agua bacteriostática (no incluida). Una vez reconstituido, refrigerar a 2-8°C.</i>\n\n¿Te gustaría agregarlo a tu carrito o necesitas más información sobre este producto?` + DISCLAIMER;
    }
  }

  if (msg.length < 5) {
    return '¡Hola! Soy <b>PeptideBot</b>. ¿En qué puedo ayudarte? Puedes preguntarme sobre:\n\n🔬 Productos y sus beneficios\n📐 Dosis y protocolos\n📦 Envíos a Colombia y LATAM\n💰 Pagos en USDT/USDC\n❄️ Almacenamiento\n\n¿Qué te gustaría saber?';
  }

  const defaultResponses = botResponses.default;
  return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
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

const leads = [];

app.post('/api/lead-capture', contactLimiter, (req, res) => {
  const contact = sanitize(req.body.contact || '');
  const message = sanitize(req.body.message || '');
  if (!contact) return res.status(400).json({ error: 'Correo o WhatsApp requerido' });
  const lead = {
    id: uuidv4(),
    contact,
    message,
    ip: req.ip,
    createdAt: new Date().toISOString()
  };
  leads.push(lead);
  if (!isProd) console.log(`Lead captured: ${contact} "${message}"`);
  res.json({ success: true, message: 'Gracias por tu interés. Un especialista te contactará a la brevedad.' });
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
