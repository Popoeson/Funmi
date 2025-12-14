// mode.js
import fetch from 'node-fetch';
import { Groq } from 'groq-sdk';

/* ======================
   CHAT (Robust: Groq SDK → HF → Dummy)
====================== */
export async function handleChat(message) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  // --------------------
  // Try Groq first
  // --------------------
  try {
    const chatCompletion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_completion_tokens: 8192,
      top_p: 1,
      stream: false // false because we want the full response at once
    });

    const reply = chatCompletion.choices?.[0]?.message?.content;

    if (reply) return reply;
    throw new Error('Groq empty response');
  } catch (err) {
    console.error('Groq failed → HF fallback', err.message);
  }

  // --------------------
// Try Hugging Face as fallback
// --------------------
try {
  const hfRes = await fetch(
    'https://router.huggingface.co/hf-inference/models/mistralai/Mistral-7B-Instruct-v0.2',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HF_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: message,
        parameters: {
          max_new_tokens: 300,
          temperature: 0.7
        }
      })
    }
  );

  // Check if response is OK
  if (!hfRes.ok) {
    const text = await hfRes.text(); // capture raw text if not JSON
    console.error('HF API error', hfRes.status, text);
    throw new Error('HF API request failed');
  }

  // Parse JSON safely
  let hfData;
  try {
    hfData = await hfRes.json();
  } catch (jsonErr) {
    console.error('HF response not JSON:', await hfRes.text());
    throw new Error('HF JSON parse failed');
  }

  // Return generated text if available
  if (Array.isArray(hfData) && hfData[0]?.generated_text) return hfData[0].generated_text;
  if (hfData?.generated_text) return hfData.generated_text;
  if (hfData?.error) console.error('HF error:', hfData.error);

  // Fallback to dummy if HF returns no usable text
  console.warn('HF returned no text, using dummy response');
  return `Hi! You said: "${message}"`;
} catch (err) {
  console.error('HF completely failed', err.message);
  // Always return dummy if everything fails
  return `Hi! You said: "${message}"`;
}
/* ======================
   IMAGE GENERATION
====================== */
export async function handleImage(prompt) {
  try {
    const res = await fetch(
      'https://api.stability.ai/v1/generation/sdxl-1-0/text-to-image',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.STABILITY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text_prompts: [{ text: prompt }],
          width: 1024,
          height: 1024,
          samples: 1
        })
      }
    );

    const data = await res.json();
    const base64 = data?.artifacts?.[0]?.base64;

    if (!base64) throw new Error('No image generated');

    return `data:image/png;base64,${base64}`;
  } catch (err) {
    console.error('SDXL failed', err.message);
    return 'Image generation failed. Please try again later.';
  }
}

/* ======================
   SEARCH / RESEARCH
====================== */
export async function handleSearch(message, mode) {
  try {
    if (mode === 'Research') {
      const res = await fetch(
        `https://api.exa.com/v1/search?q=${encodeURIComponent(message)}`,
        { headers: { Authorization: `Bearer ${process.env.EXA_API_KEY}` } }
      );
      const data = await res.json();
      return data?.results?.[0]?.snippet || 'No research result found.';
    }

    if (mode === 'Web Search') {
      const res = await fetch('https://api.serper.dev/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': process.env.SERPER_API_KEY
        },
        body: JSON.stringify({ q: message })
      });
      const data = await res.json();
      return data?.organic?.[0]?.snippet || 'No web result found.';
    }
  } catch (err) {
    console.error('Search failed', err.message);
    return 'Search is temporarily unavailable.';
  }
}

/* ======================
   FILE ANALYSIS
====================== */
export async function handleFile() {
  return 'File analysis coming soon.';
}