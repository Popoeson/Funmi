// mode.js
import fetch from "node-fetch";

/* =====================================================
   CHAT (Groq → HF fallback)
===================================================== */
export async function handleChat(message) {
  try {
    const res = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama3-8b-8192",
          messages: [{ role: "user", content: message }],
        }),
      }
    );

    const data = await res.json();
    return data.choices[0].message.content;
  } catch (err) {
    console.error("Groq failed → HF fallback", err.message);

    const hfRes = await fetch(
      "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: message }),
      }
    );

    const hfData = await hfRes.json();
    return Array.isArray(hfData)
      ? hfData[0].generated_text
      : hfData.generated_text;
  }
}

/* =====================================================
   IMAGE (FLUX → SDXL fallback)
===================================================== */
export async function handleImage(prompt) {
  try {
    const res = await fetch("https://api.blackforest.ai/v1/generate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FLUX_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        width: 1024,
        height: 1024,
      }),
    });

    const data = await res.json();

    // FLUX usually returns base64
    return {
      type: "image",
      content: `data:image/png;base64,${data.images[0].base64}`,
    };
  } catch (err) {
    console.error("Flux failed → SDXL fallback", err.message);

    const res = await fetch(
      "https://api.stability.ai/v1/generation/sdxl-v1-0/text-to-image",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text_prompts: [{ text: prompt }],
          width: 1024,
          height: 1024,
          samples: 1,
        }),
      }
    );

    const data = await res.json();
    return {
      type: "image",
      content: `data:image/png;base64,${data.artifacts[0].base64}`,
    };
  }
}

/* =====================================================
   SEARCH / RESEARCH
===================================================== */
export async function handleSearch(query, mode) {
  if (mode === "Research") {
    const res = await fetch("https://api.exa.com/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.EXA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, numResults: 5 }),
    });

    const data = await res.json();
    return data.results.map(r => `• ${r.title}\n${r.snippet}`).join("\n\n");
  }

  // Web Search (Serper)
  const res = await fetch("https://api.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": process.env.SERPER_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query }),
  });

  const data = await res.json();
  return data.organic
    .slice(0, 5)
    .map(r => `• ${r.title}\n${r.snippet}`)
    .join("\n\n");
}

/* =====================================================
   FILE ANALYSIS (Stub for now)
===================================================== */
export async function handleFile(file) {
  return "File analysis coming soon.";
}