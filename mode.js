// mode.js
const fetch = require('node-fetch');

// --------------------
// Chat Mode
// --------------------
async function handleChat(message) {
  try {
    // Primary: Groq
    const groqResponse = await fetch('https://api.groq.ai/v1/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({ input: message })
    });
    const data = await groqResponse.json();
    return data.output || `Groq response placeholder: ${message}`;
  } catch (err) {
    console.error('Groq failed, falling back to Hugging Face', err.message);
    try {
      // Fallback: Hugging Face Mistral 7B Instruct
      const hfResponse = await fetch('https://api-inference.huggingface.co/models/mistral7b-instruct', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HF_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ inputs: message })
      });
      const hfData = await hfResponse.json();
      if (Array.isArray(hfData)) return hfData[0]?.generated_text || `HF placeholder: ${message}`;
      return hfData.generated_text || `HF placeholder: ${message}`;
    } catch (err2) {
      console.error('Hugging Face also failed', err2.message);
      return `Sorry, I couldn't generate a response at the moment.`;
    }
  }
}

// --------------------
// Image Generation
// --------------------
async function handleImage(message) {
  try {
    // Primary: Flux (via Black Forest)
    const fluxResponse = await fetch('https://api.blackforest.ai/v1/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.FLUX_API_KEY}`
      },
      body: JSON.stringify({
        prompt: message,
        size: '1024x1024'
      })
    });
    const fluxData = await fluxResponse.json();
    return fluxData.url || `Flux image placeholder for: ${message}`;
  } catch (err) {
    console.error('Flux failed, fallback to SDXL/Stable Diffusion', err.message);
    try {
      // Fallback: SDXL (Stability API)
      const sdxlResponse = await fetch('https://api.stability.ai/v1/generation/sdxl-v1-0/text-to-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.STABILITY_API_KEY}`
        },
        body: JSON.stringify({
          text_prompts: [{ text: message }],
          width: 1024,
          height: 1024,
          samples: 1
        })
      });
      const sdxlData = await sdxlResponse.json();
      return sdxlData.artifacts?.[0]?.url || `SDXL image placeholder for: ${message}`;
    } catch (err2) {
      console.error('SDXL failed', err2.message);
      return `Sorry, I couldn't generate an image at the moment.`;
    }
  }
}

// --------------------
// Web / Research
// --------------------
async function handleSearch(message, mode) {
  try {
    if (mode === 'Research') {
      // Primary: Exa
      const exaResponse = await fetch(`https://api.exa.com/v1/search?q=${encodeURIComponent(message)}`, {
        headers: { 'Authorization': `Bearer ${process.env.EXA_API_KEY}` }
      });
      const exaData = await exaResponse.json();
      return exaData.results?.[0]?.snippet || `Exa research placeholder for: ${message}`;
    } else if (mode === 'Web Search') {
      // Primary: Serper
      const serperResponse = await fetch(`https://api.serper.dev/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': process.env.SERPER_API_KEY
        },
        body: JSON.stringify({ q: message })
      });
      const serperData = await serperResponse.json();
      return serperData?.organic?.[0]?.snippet || `Serper web search placeholder for: ${message}`;
    }
  } catch (err) {
    console.error('Search failed', err.message);
    try {
      // Fallback: Google CSE
      const googleResponse = await fetch(
        `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(message)}&cx=${process.env.GOOGLE_CSE_ID}&key=${process.env.GOOGLE_CSE_KEY}`
      );
      const googleData = await googleResponse.json();
      return googleData.items?.[0]?.snippet || `Google CSE fallback placeholder for: ${message}`;
    } catch (err2) {
      console.error('Google CSE fallback failed', err2.message);
      return `Sorry, search failed at the moment.`;
    }
  }
}

// --------------------
// File Analysis
// --------------------
async function handleFile(file) {
  // TODO: implement file analysis logic here
  return `File analysis placeholder`;
}

module.exports = {
  handleChat,
  handleImage,
  handleSearch,
  handleFile
};