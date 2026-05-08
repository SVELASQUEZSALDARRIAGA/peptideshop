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

  async sendMessage() {
    const input = document.getElementById('chatbotInput');
    const message = input.value.trim();
    if (!message) return;

    this.addMessage(message, 'user');
    input.value = '';
    input.focus();

    document.getElementById('chatbotSend').disabled = true;
    document.getElementById('chatbotSend').innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span>';

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });

      if (response.ok) {
        const data = await response.json();
        this.addMessage(data.response, 'bot');
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
