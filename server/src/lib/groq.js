const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export async function groqChat({ system, user, temperature = 0.4, responseFormat }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not set');
  }

  const requestedModel = process.env.GROQ_MODEL || 'llama3-70b-8192';
  const fallbackModels = [
    requestedModel,
    'llama-3.3-70b-versatile',
    'llama3-70b-8192',
    'llama3-8b-8192'
  ];

  let lastError = null;
  for (const model of fallbackModels) {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          temperature,
          ...(responseFormat ? { response_format: responseFormat } : {}),
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ]
        })
      });

      if (!response.ok) {
        const detail = await response.text();
        lastError = new Error(`Groq error: ${response.status} ${detail}`);
        continue;
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() ?? '';
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Groq request failed');
}
