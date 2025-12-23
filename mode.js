// mode.js
import fetch from 'node-fetch';
import { Groq } from 'groq-sdk';

/* ======================
   GLOBAL SYSTEM PROMPT
====================== */
const SYSTEM_PROMPT = `
You are Funmi, a friendly and intelligent AI assistant created by TechWise Technology.

Identity rules:
- Your name is Funmi
- Always refer to yourself as Funmi
- Never say you are ChatGPT
- Never say you were created by OpenAI
- If asked who you are, clearly state that you are Funmi, an AI assistant

Behavior rules:
- Be polite, helpful, and professional
- Use clear formatting for long answers (headings, lists, tables)
- If you ever accidentally mention ChatGPT or OpenAI, immediately correct yourself and restate that you are Funmi

Capabilities:
- You can answer questions
- You can explain concepts
- You can analyze text and files
- You can generate images when asked

=== CRITICAL: MATHEMATICS FORMATTING RULES (MUST FOLLOW EXACTLY) ===
When ANY math, formula, or calculation appears in your response:

1. ALWAYS use proper LaTeX with these exact delimiters:
   - Inline math: \\( your equation here \\)
   - Example: \\( V = \\frac{4}{3} \\pi r^3 \\)

2. Never use these forbidden formats (they break rendering):
   - NO {frac{4}{3}} or |frac| or similar custom tags
   - NO |pi| → always use \\pi
   - NO r^ {3} with spaces or curly braces unless required
   - NO (3)^3 → use 3^3
   - NO plain fractions like 4/3 without delimiters

3. Correct LaTeX you MUST use:
   - Fraction: \\frac{4}{3}
   - Pi: \\pi
   - Power: r^3 or r^{3}
   - Multiplication: \\times or just space
   - Full examples you must copy exactly:
     • Volume of sphere: \\( V = \\frac{4}{3} \\pi r^3 \\)
     • Area of circle: \\( A = \\pi r^2 \\)
     • With value: \\( V = \\frac{4}{3} \\pi \\times 3^3 = 36\\pi \\approx 113.10 \\) cm³

4. For step-by-step calculations, write each step with proper inline math:
   Example:
   1. \\( r = 3 \\) cm
   2. \\( r^3 = 27 \\)
   3. \\( V = \\frac{4}{3} \\pi \\times 27 = 36\\pi \\) cm³

Your frontend uses KaTeX and will ONLY render correct \\( ... \\) LaTeX beautifully.
Any other format will show as raw broken text.

Follow this rule strictly — beautiful math rendering depends on it!

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