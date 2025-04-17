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

  try {
    const response = await fetch('/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history: conversationHistory })
    });

    const data = await response.json();
    let botMessage = data.reply;
    conversationHistory = data.history;

    // 🛡️ Handle backend errors gracefully
    if (!botMessage) {
      botMessage = "Sorry, I couldn't generate a response. Our team will review this shortly.";
      addMessageToUI(botMessage, 'bot');
      return;
    }

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

    // 🔁 Trigger summarization and Supabase intake save
    await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history: conversationHistory })
    });

    // 📤 Save full chat log to Supabase (temp ID for now)
    await logChatHistory("demo-intake-id", conversationHistory);

  } catch (error) {
    console.error("Frontend error:", error);
    addMessageToUI("Something went wrong while connecting to the assistant. Please try again later.", 'bot');
  }
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

// 🧠 New function: Send full chat log to Supabase
async function logChatHistory(intakeId, history) {
  try {
    const logs = history.map(entry => ({
      role: entry.role,
      message: entry.content
    }));

    await fetch('/api/save-chat-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intake_id: intakeId, logs })
    });
  } catch (error) {
    console.error("Failed to save chat log:", error);
  }
}
