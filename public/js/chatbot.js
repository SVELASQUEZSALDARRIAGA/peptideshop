class ChatBot {
  constructor() {
    this.isOpen = false;
    this.messages = [];
    this.init();
  }

  init() {
    const toggle = document.getElementById('chatbotToggle');
    const close = document.getElementById('chatbotClose');
    const send = document.getElementById('chatbotSend');
    const input = document.getElementById('chatbotInput');
    const window = document.getElementById('chatbotWindow');

    toggle.addEventListener('click', () => this.toggle());
    close.addEventListener('click', () => this.close());
    send.addEventListener('click', () => this.sendMessage());
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });
  }

  toggle() {
    this.isOpen = !this.isOpen;
    document.getElementById('chatbotWindow').classList.toggle('active', this.isOpen);
    if (this.isOpen) {
      setTimeout(() => {
        document.getElementById('chatbotInput').focus();
      }, 300);
    }
  }

  close() {
    this.isOpen = false;
    document.getElementById('chatbotWindow').classList.remove('active');
  }

  async sendMessage(message) {
    const input = document.getElementById('chatbotInput');
    const msg = message || input.value.trim();
    if (!msg) return;

    this.addMessage(msg, 'user');
    input.value = '';
    input.focus();

    document.getElementById('chatbotSend').disabled = true;
    document.getElementById('chatbotSend').innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span>';

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      });

      if (response.ok) {
        const data = await response.json();
        this.addMessage(data.response, 'bot');
        if (data.response.includes('comparte tu correo o WhatsApp')) {
          this.showLeadForm();
        }
      } else {
        this.addMessage('Lo siento, estoy teniendo problemas para conectarme. Por favor, intenta de nuevo.', 'bot');
      }
    } catch (err) {
      this.addMessage('Lo siento, parece que hay un problema de conexión. ¿Quieres preguntarme otra cosa?', 'bot');
    } finally {
      document.getElementById('chatbotSend').disabled = false;
      document.getElementById('chatbotSend').innerHTML = '&#10148;';
    }
  }

  showLeadForm() {
    const container = document.getElementById('chatbotMessages');
    const div = document.createElement('div');
    div.className = 'message bot lead-form-message';
    div.innerHTML = `
      <div class="message-content lead-form">
        <input type="text" class="lead-input" placeholder="Tu correo electrónico o WhatsApp..." />
        <button class="lead-btn">Enviar</button>
        <div class="lead-feedback"></div>
      </div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    const input = div.querySelector('.lead-input');
    const btn = div.querySelector('.lead-btn');
    const feedback = div.querySelector('.lead-feedback');
    const submit = () => this.submitLead(input, feedback, div);
    btn.addEventListener('click', submit);
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') submit(); });
    input.focus();
  }

  async submitLead(input, feedback, formEl) {
    const contact = input.value.trim();
    if (!contact) { feedback.textContent = 'Por favor ingresa tu correo o WhatsApp.'; return; }
    feedback.textContent = 'Enviando...';
    input.disabled = true;
    formEl.querySelector('.lead-btn').disabled = true;
    try {
      const res = await fetch('/api/lead-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact, message: 'Lead capturado vía chatbot' })
      });
      const data = await res.json();
      if (res.ok) {
        feedback.className = 'lead-feedback success';
        feedback.textContent = '✅ ¡Gracias! Un especialista te contactará pronto.';
        formEl.querySelector('.lead-btn').remove();
        input.remove();
      } else {
        feedback.className = 'lead-feedback error';
        feedback.textContent = data.error || 'Error al enviar. Intenta de nuevo.';
        input.disabled = false;
        formEl.querySelector('.lead-btn').disabled = false;
      }
    } catch {
      feedback.className = 'lead-feedback error';
      feedback.textContent = 'Error de conexión. Intenta de nuevo.';
      input.disabled = false;
      formEl.querySelector('.lead-btn').disabled = false;
    }
  }

  addMessage(text, type) {
    const container = document.getElementById('chatbotMessages');
    const div = document.createElement('div');
    div.className = `message ${type}`;
    div.innerHTML = `<div class="message-content">${text.replace(/\n/g, '<br>')}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    this.messages.push({ text, type });
  }
}
