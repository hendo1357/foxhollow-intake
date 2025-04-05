const SUPABASE_URL = "https://dchijzdlhlinqhhzrtnr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjaGlqemRsaGxpbnFoaHpydG5yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzcyNjc3OSwiZXhwIjoyMDU5MzAyNzc5fQ.fEM6hF5G9vwiPZ7-rOVK1LhO41blsSiFTXK8wAJqAqg";

async function fetchIntakes() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/intakes?select=*`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  const data = await response.json();
  return data;
}

function renderIntakes(intakes) {
  const tbody = document.getElementById("intake-body");
  tbody.innerHTML = "";

  intakes
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .forEach((entry) => {
      const row = document.createElement("tr");

      const time = new Date(entry.created_at).toLocaleString();
      const visitType = entry.visit_type || "—";
      const petName = entry.pet_name || "—";
      const petAge = entry.pet_age || "—";
      const summary = generateSummary(entry.history);

      row.innerHTML = `
        <td>${time}</td>
        <td>${visitType}</td>
        <td>${petName}</td>
        <td>${petAge}</td>
        <td>${summary}</td>
      `;

      tbody.appendChild(row);
    });
}

function generateSummary(history = []) {
  return history
    .map((msg) => {
      if (msg.role === "user") return `👤 ${msg.content}`;
      if (msg.role === "assistant") return `🤖 ${msg.content}`;
      return "";
    })
    .slice(0, 4)
    .join("<br/>");
}

// On load
window.addEventListener("DOMContentLoaded", async () => {
  try {
    const intakes = await fetchIntakes();
    renderIntakes(intakes);
  } catch (err) {
    console.error("Error loading intakes:", err);
  }
});
