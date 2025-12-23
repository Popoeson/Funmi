// mode.js
import fetch from 'node-fetch';
import { Groq } from 'groq-sdk';

/* ======================
   GLOBAL SYSTEM PROMPT
====================== */
const SYSTEM_PROMPT = `
=== ABSOLUTE TOP PRIORITY: PERFECT MATH RENDERING ===
You MUST always use clean standard LaTeX with \\( ... \\) for EVERY formula. Users see beautiful rendered equations only when you do this.

CORRECT WAY (use this exactly):
- \\( V = \\frac{4}{3} \\pi r^3 \\)
- \\( A = \\pi r^2 \\)
- \\( C = 2 \\pi r \\)

FORBIDDEN FOREVER (never use these — they show as ugly raw code):
- {frac{4}{3}}, |pi|, |r^3|, |r^2|, any |tag| or {tag}

When introducing a formula, write:
"The volume of a sphere is \\( V = \\frac{4}{3} \\pi r^3 \\)"
"The area of a circle is \\( A = \\pi r^2 \\)"

Do not use parentheses around formulas.
Do not use old tags in any context — text, tables, or calculations.

Clean LaTeX is essential for the app to work properly.

You are Funmi, a friendly and intelligent AI assistant created by TechWise Technology.

Identity:
- Name: Funmi
- Never mention ChatGPT or OpenAI

Behavior:
- Polite, helpful, professional
- Use headings, lists, tables for clarity

Capabilities:
- Answer questions
- Explain concepts
- Analyze text/files
- Generate images

Always prioritize clean LaTeX above all else.
`;

/* ======================
   CHAT (Groq → HF → Dummy)
====================== */
export async function handleChat(message) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: message }
  ];

  /* --------------------
     1️⃣ Groq (Primary)
  -------------------- */
  try {
    const chatCompletion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages,
      temperature: 0.7,
      max_completion_tokens: 8192,
      top_p: 1,
      stream: false
    });

    const reply = chatCompletion.choices?.[0]?.message?.content;

    if (reply) return reply;
    throw new Error('Groq returned empty response');
  } catch (err) {
    console.error('Groq failed → HF fallback', err.message);
  }

  /* --------------------
     2️⃣ Hugging Face (Fallback)
  -------------------- */
  try {
    const hfPrompt = `
${SYSTEM_PROMPT}

User: ${message}
Funmi:
`;

    const hfRes = await fetch(
      'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: hfPrompt,
          options: { wait_for_model: true }
        })
      }
    );

    if (!hfRes.ok) {
      const text = await hfRes.text();
      console.error('HF API error', hfRes.status, text);
      throw new Error('HF API request failed');
    }

    const hfData = await hfRes.json();

    if (hfData?.generated_text) return hfData.generated_text;
    if (Array.isArray(hfData) && hfData[0]?.generated_text)
      return hfData[0].generated_text;

    return `Hi! I'm Funmi. You said: "${message}"`;
  } catch (err) {
    console.error('HF completely failed', err.message);
    return `Hi! I'm Funmi. You said: "${message}"`;
  }
}

/* ======================
   IMAGE GENERATION
   FLUX → SDXL
====================== */
export async function handleImage(prompt) {

  /* -------- FLUX -------- */
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
      throw new Error(err);
    }

    const buffer = Buffer.from(await fluxRes.arrayBuffer());
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch (err) {
    console.error('FLUX failed → SDXL fallback', err.message);
  }

  /* -------- SDXL -------- */
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

    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();
    return `data:image/png;base64,${data.image}`;
  } catch (err) {
    console.error('SDXL failed', err.message);
    return 'Image generation failed. Please try again later.';
  }
}

/* ======================
   WEB SEARCH
====================== */
export async function handleSearch(query) {
  try {
    const searchRes = await fetch(
      'https://api-inference.huggingface.co/models/deepset/roberta-base-squad2',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ inputs: query })
      }
    );

    const data = await searchRes.json();
    return data?.answer || `No results found for: "${query}"`;
  } catch {
    return `No results found for: "${query}"`;
  }
}

/* ======================
   FILE ANALYSIS
====================== */
export async function handleFile(file) {
  if (!file?.buffer) return 'No file provided';

  const content = file.buffer.toString('utf-8').slice(0, 5000);
  return handleChat(`Analyze this file content:\n${content}`);
}