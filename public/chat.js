const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const messages = document.getElementById('messages');

let conversationHistory = [];

window.addEventListener('DOMContentLoaded', () => {
  const welcome = "Hi there! I'm here to help with your pet’s visit. Please tell me what’s going on today.";
  addMessageToUI(welcome, 'bot');
  conversationHistory.push({ role: 'assistant', content: welcome });
});

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const userMessage = chatInput.value.trim();
  if (!userMessage) return;

  addMessageToUI(userMessage, 'user');
  conversationHistory.push({ role: 'user', content: userMessage });
  chatInput.value = '';

  const response = await fetch('/api/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ history: conversationHistory })
  });

  const data = await response.json();
  let botMessage = data.reply;
  conversationHistory = data.history;

  // Extract and handle JSON if present
  const jsonRegex = /\{[\s\S]*\}/;
  const jsonMatch = botMessage.match(jsonRegex);

  if (jsonMatch) {
    const structuredData = JSON.parse(jsonMatch[0]);

    // Send structured data to Supabase
    await fetch('/api/save-intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(structuredData)
    });

    // Remove JSON from the displayed message
    botMessage = botMessage.replace(jsonRegex, '').trim();
  }

  addMessageToUI(botMessage, 'bot');
});

function addMessageToUI(message, sender) {
  const div = document.createElement('div');
  div.className = `message ${sender}`;
  div.innerHTML = sanitizeAndFormat(message);
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

// Optional: handle basic markdown or line breaks
function sanitizeAndFormat(text) {
  const safeText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return safeText.replace(/\n/g, "<br>");
}
