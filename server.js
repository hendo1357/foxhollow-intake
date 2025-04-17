const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
require('dotenv').config();

const app = express();
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
console.log("DEBUG: OPENAI_API_KEY = ", OPENAI_API_KEY);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// --- First GPT: Conversational Triage Assistant ---
app.post('/api/message', async (req, res) => {
  const { history } = req.body;

  if (!history || history.length === 0) {
    return res.status(400).json({ error: 'No conversation history provided.' });
  }

  const systemPrompt = `
You are a virtual veterinary intake assistant for Fox Hollow Animal Hospital in Colorado. Your job is to speak naturally and compassionately with pet owners, gather key details about their pet’s condition, assess urgency, and provide appropriate guidance.

Let the pet owner know their responses will be reviewed in real time by the medical staff at Fox Hollow. If the pet may need to be seen urgently, explain that you can help get them scheduled promptly.

Avoid veterinary jargon. Be friendly, human-sounding, and conversational — like a highly trained technician at a trusted hospital. DO NOT generate a JSON summary in this chat. That happens separately.
  `;

  try {
    console.log("Sending to GPT:", history);

    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          ...history
        ],
        temperature: 0.6
      })
    });

    const data = await completion.json();
    console.log("GPT raw response:", data);

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error("Malformed GPT response:", data);
      return res.status(500).json({ error: "Malformed GPT response" });
    }

    const assistantMessage = data.choices[0].message.content;
    const fullHistory = [...history, { role: 'assistant', content: assistantMessage }];

    res.json({ reply: assistantMessage, history: fullHistory });
  } catch (err) {
    console.error("Error processing message:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- Second GPT: Post-chat SOAP + Client Summary Generator ---
app.post('/api/summarize', async (req, res) => {
  const { history } = req.body;

  const summaryPrompt = `
You are part of the Fox Hollow Animal Hospital intake system. A pet owner has interacted with our virtual assistant. Please now summarize this intake using:

1. A SOAP-style internal note for the medical team.
2. A plain-English client-facing summary.

Be concise but thorough. If any information is missing, mark it as "unknown".

Return only JSON:
{
  "urgency": "",
  "presenting_issue": "",
  "pet_name": "",
  "species": "",
  "owner_name": "",
  "triage_summary": "SOAP-style summary for vet staff",
  "client_summary": "Simple summary for client including what to expect at Fox Hollow and whether urgent"
}

Chat history:
${history.map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n')}
`;

  try {
    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4-turbo",
        messages: [{ role: "system", content: summaryPrompt }],
        temperature: 0.3
      })
    });

    const data = await completion.json();
    const jsonResponse = data.choices[0].message.content.trim();
    let structuredData;

    try {
      structuredData = JSON.parse(jsonResponse);
    } catch (err) {
      console.warn("Failed to parse GPT JSON summary:", err);
      return res.status(400).json({ error: "Malformed JSON from summarizer." });
    }

    // Save to Supabase
    await fetch(`${SUPABASE_URL}/rest/v1/intakes`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        created_at: new Date().toISOString(),
        pet_name: structuredData.pet_name || null,
        owner_name: structuredData.owner_name || null,
        species: structuredData.species || null,
        presenting_issue: structuredData.presenting_issue || null,
        urgency: structuredData.urgency || null,
        triage_summary: structuredData.triage_summary || null,
        client_summary: structuredData.client_summary || null,
        resolved: "No"
      })
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Error summarizing chat:", err);
    res.status(500).json({ error: "Failed to generate summary." });
  }
});

// --- Save chat logs to Supabase ---
app.post('/api/save-chat-log', async (req, res) => {
  const { intake_id, logs } = req.body;

  if (!intake_id || !logs || !Array.isArray(logs)) {
    return res.status(400).json({ error: "Missing or invalid chat log data" });
  }

  try {
    const payload = logs.map(entry => ({
      intake_id: intake_id,
      role: entry.role,
      message: entry.message,
      timestamp: new Date().toISOString()
    }));

    const response = await fetch(`${SUPABASE_URL}/rest/v1/chat_logs`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorDetails = await response.text();
      console.error("Failed to save chat logs:", errorDetails);
      return res.status(500).json({ error: "Failed to save chat logs" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Error saving chat logs:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
