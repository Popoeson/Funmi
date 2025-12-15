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
      messages: [{ role: 'user', content: message }],
      temperature: 0.7,
      max_completion_tokens: 8192,
      top_p: 1,
      stream: false // full response at once
    });

    const reply = chatCompletion.choices?.[0]?.message?.content;

    if (reply) return reply;
    throw new Error('Groq returned empty response');
  } catch (err) {
    console.error('Groq failed → HF fallback', err.message);
  }

  // --------------------
  // Try Hugging Face as fallback
  // --------------------
  try {
    const hfRes = await fetch(
      'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HF_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: message,
          options: { wait_for_model: true } // ensures the model is loaded
        })
      }
    );

    if (!hfRes.ok) {
      const text = await hfRes.text();
      console.error('HF API error', hfRes.status, text);
      throw new Error('HF API request failed');
    }

    let hfData;
    try {
      hfData = await hfRes.json();
    } catch (jsonErr) {
      const text = await hfRes.text();
      console.error('HF response not JSON:', text);
      throw new Error('HF JSON parse failed');
    }

    if (hfData?.generated_text) return hfData.generated_text;
    if (Array.isArray(hfData) && hfData[0]?.generated_text) return hfData[0].generated_text;

    console.warn('HF returned no usable text, using dummy response');
    return `Hi! You said: "${message}"`;
  } catch (err) {
    console.error('HF completely failed', err.message);
    return `Hi! You said: "${message}"`;
  }
}

/* ======================
   IMAGE GENERATION
   FLUX (Primary) → SDXL (Fallback)
====================== */
export async function handleImage(prompt) {

  /* ======================
     1️⃣ FLUX (Primary)
  ====================== */
  try {
    const fluxRes = await fetch(
      'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            num_inference_steps: 4,
            guidance_scale: 3.5
          }
        })
      }
    );

    if (!fluxRes.ok) {
      const err = await fluxRes.text();
      console.error('FLUX API error:', err);
      throw new Error('FLUX request failed');
    }

    const buffer = Buffer.from(await fluxRes.arrayBuffer());
    const base64 = buffer.toString('base64');

    if (base64) {
      console.log('FLUX image generated');
      return `data:image/png;base64,${base64}`;
    }

    throw new Error('FLUX returned empty image');
  } catch (err) {
    console.error('FLUX failed → SDXL fallback', err.message);
  }

  /* ======================
     2️⃣ STABILITY SDXL (Fallback)
  ====================== */
  try {
    const res = await fetch(
      'https://api.stability.ai/v2beta/stable-image/generate/sdxl',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
          Accept: 'application/json'
        },
        body: new URLSearchParams({
          prompt,
          output_format: 'png'
        })
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('Stability API error:', err);
      throw new Error('Stability request failed');
    }

    const data = await res.json();

    if (!data?.image) {
      throw new Error('SDXL returned no image');
    }

    console.log('SDXL image generated');
    return `data:image/png;base64,${data.image}`;
  } catch (err) {
    console.error('SDXL failed', err.message);
    return 'Image generation failed. Please try again later.';
  }
}

/* ======================
   WEB / RESEARCH SEARCH
====================== */
export async function handleSearch(query, mode = 'Web Search') {
  try {
    // Example: using Hugging Face search model (you can switch to your preferred API)
    const searchRes = await fetch(
      'https://api-inference.huggingface.co/models/deepset/roberta-base-squad2',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HF_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ inputs: query })
      }
    );

    if (!searchRes.ok) {
      const text = await searchRes.text();
      console.error('HF search error', searchRes.status, text);
      return `No results found for: "${query}"`;
    }

    const searchData = await searchRes.json();
    // Simplified result formatting
    return searchData?.answer || `No results found for: "${query}"`;
  } catch (err) {
    console.error('Search failed', err.message);
    return `No results found for: "${query}"`;
  }
}

/* ======================
   FILE ANALYSIS
====================== */
export async function handleFile(file) {
  if (!file || !file.buffer) return 'No file provided';

  try {
    // Simple example: convert file buffer to text if possible
    const textContent = file.buffer.toString('utf-8').slice(0, 5000); // limit size
    // Send file content to handleChat for analysis
    const analysis = await handleChat(`Analyze this file content: ${textContent}`);
    return analysis;
  } catch (err) {
    console.error('File analysis failed', err.message);
    return 'Failed to analyze file';
  }
}