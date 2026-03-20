exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) return { statusCode: 500, headers: {"Content-Type":"application/json"}, body: JSON.stringify({ error: "API key not configured" }) };

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  // Convertir formato Anthropic -> Gemini
  const messages = body.messages || [];
  const systemPrompt = body.system || "";
  
  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  const geminiBody = {
    system_instruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
    contents,
    generationConfig: {
      maxOutputTokens: body.max_tokens || 9000,
      temperature: 0.7
    }
  };

  try {
    const model = "gemini-1.5-flash-latest";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
    
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody)
    });

    const data = await res.json();

    if (!res.ok) {
      return { statusCode: res.status, headers: {"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}, body: JSON.stringify({ error: data.error?.message || "Gemini error" }) };
    }

    // Convertir respuesta Gemini -> formato Anthropic (para que el index.html no cambie)
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const anthropicFormat = {
      content: [{ type: "text", text }]
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(anthropicFormat)
    };
  } catch (e) {
    return { statusCode: 500, headers: {"Content-Type":"application/json"}, body: JSON.stringify({ error: e.message }) };
  }
};
