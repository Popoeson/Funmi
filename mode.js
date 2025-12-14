// mode.js
import fetch from 'node-fetch';

// --------------------
// CHAT MODE
// --------------------
export async function handleChat(message) {
  // 1️⃣ Try Groq first
  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [{ role: 'user', content: message }]
      })
    });

    const groqData = await groqResponse.json();

    const content =
      groqData?.choices?.[0]?.message?.content;

    if (content) return content;

    throw new Error('Groq empty response');
  } catch (err) {
    console.error('Groq failed → HF fallback', err.message);
  }

  // 2️⃣ Hugging Face fallback (SAFE PARSING)
  try {
    const hfResponse = await fetch(
      'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HF_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ inputs: message })
      }
    );

    const hfData = await hfResponse.json();

    // ✅ Handle ALL HF response shapes
    if (Array.isArray(hfData) && hfData[0]?.generated_text) {
      return hfData[0].generated_text;
    }

    if (hfData?.generated_text) {
      return hfData.generated_text;
    }

    if (hfData?.error) {
      console.error('HF error:', hfData.error);
    }

    return "I'm having trouble responding right now. Please try again.";
  } catch (err) {
    console.error('Hugging Face failed', err.message);
    return "I'm currently unavailable. Please try again later.";
  }
}

// --------------------
// IMAGE GENERATION
// --------------------
export async function handleImage(message) {
  // ⚠️ Black Forest removed – skip directly to SDXL
  try {
    const sdxlResponse = await fetch(
      'https://api.stability.ai/v1/generation/sdxl-1-0/text-to-image',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.STABILITY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text_prompts: [{ text: message }],
          width: 1024,
          height: 1024,
          samples: 1
        })
      }
    );

    const sdxlData = await sdxlResponse.json();

    const base64 = sdxlData?.artifacts?.[0]?.base64;

    if (!base64) throw new Error('No image generated');

    // Return as image URL (frontend-ready)
    return `data:image/png;base64,${base64}`;
  } catch (err) {
    console.error('SDXL failed', err.message);
    return 'Image generation failed. Please try again.';
  }
}

// --------------------
// SEARCH / RESEARCH
// --------------------
export async function handleSearch(message, mode) {
  try {
    if (mode === 'Research') {
      const exaResponse = await fetch(
        `https://api.exa.com/v1/search?q=${encodeURIComponent(message)}`,
        { headers: { Authorization: `Bearer ${process.env.EXA_API_KEY}` } }
      );

      const exaData = await exaResponse.json();
      return exaData?.results?.[0]?.snippet || 'No research result found.';
    }

    if (mode === 'Web Search') {
      const serperResponse = await fetch('https://api.serper.dev/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': process.env.SERPER_API_KEY
        },
        body: JSON.stringify({ q: message })
      });

      const serperData = await serperResponse.json();
      return serperData?.organic?.[0]?.snippet || 'No web result found.';
    }
  } catch (err) {
    console.error('Search failed', err.message);
    return 'Search is temporarily unavailable.';
  }
}

// --------------------
// FILE ANALYSIS
// --------------------
export async function handleFile() {
  return 'File analysis coming soon.';
}