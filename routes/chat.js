'use strict';
const express = require('express');
const router = express.Router();
const axios = require('axios');

// Detect legal category from message
function detectCategory(message) {
  const msg = message.toLowerCase();
  if (msg.includes('police') || msg.includes('arrest') || msg.includes('fir') || msg.includes('bail') || msg.includes('custody')) return 'criminal';
  if (msg.includes('bike') || msg.includes('car') || msg.includes('traffic') || msg.includes('challan') || msg.includes('licence') || msg.includes('vehicle')) return 'traffic';
  if (msg.includes('consumer') || msg.includes('refund') || msg.includes('product') || msg.includes('service') || msg.includes('fraud')) return 'consumer';
  if (msg.includes('labour') || msg.includes('salary') || msg.includes('job') || msg.includes('employee') || msg.includes('workplace') || msg.includes('pf') || msg.includes('esi')) return 'labour';
  if (msg.includes('property') || msg.includes('land') || msg.includes('rent') || msg.includes('eviction') || msg.includes('tenant')) return 'property';
  if (msg.includes('divorce') || msg.includes('marriage') || msg.includes('custody') || msg.includes('maintenance') || msg.includes('dowry')) return 'family';
  if (msg.includes('constitution') || msg.includes('fundamental right') || msg.includes('writ') || msg.includes('pil') || msg.includes('supreme court')) return 'constitutional';
  return 'general';
}

// Detect if user wants a detailed/elaborated response
function isElaborationRequest(message) {
  const msg = message.toLowerCase();
  const triggers = [
    'explain', 'elaborate', 'tell me more', 'more detail', 'in detail',
    'what does that mean', 'what do you mean', 'how does', 'how do i',
    'step by step', 'walk me through', 'break it down', 'full', 'complete',
    'everything about', 'all about', 'clarify', 'describe', 'expand',
    'what is', 'what are', 'why is', 'why does', 'can you explain',
    'please explain', 'more about', 'know more', 'want to know'
  ];
  return triggers.some(t => msg.includes(t));
}

// POST /api/chats/message — stateless, no auth required
router.post('/message', async (req, res) => {
  const { message, history } = req.body;
  if (!message?.trim()) return res.status(400).json({ success: false, message: 'Message required' });

  const lang = req.body.lang || 'en';
  const detailed = isElaborationRequest(message);

  try {
    const langInstructions = {
      en: 'Respond in clear, simple English.',
      hi: 'अपना पूरा जवाब हिंदी में दें। सरल और स्पष्ट हिंदी का उपयोग करें जो आम नागरिक समझ सके। कानूनी शब्दों के साथ उनका हिंदी अर्थ भी बताएं।',
      bn: 'সম্পূর্ণ উত্তর বাংলায় দিন। সহজ ও স্পষ্ট বাংলা ব্যবহার করুন যা সাধারণ নাগরিক বুঝতে পারেন। আইনি শব্দগুলির পাশে তাদের বাংলা অর্থও উল্লেখ করুন।'
    };
    const langInstruction = langInstructions[lang] || langInstructions['en'];

    const briefGuidelines = `RESPONSE GUIDELINES (BRIEF MODE):
1. Be CONCISE — 3 to 5 sentences max. Users need quick answers, not essays.
2. Lead with the single most important action or right.
3. Cite the relevant law/section briefly (e.g., "under Section 41A CrPC").
4. If urgent, mention emergency contacts in one line (100 police, 112 emergency).
5. Only add "Consult a lawyer for court matters." if the situation genuinely requires it.
6. No long bullet lists. No section headers. Write in plain, direct sentences.

Tone: calm, clear, empowering. This is legal information, not legal advice.`;

    const detailedGuidelines = `RESPONSE GUIDELINES (DETAILED MODE):
The user wants a thorough explanation. Give a complete, well-structured answer covering:
1. A clear explanation of the legal situation or concept
2. Relevant laws, sections, and articles with what they mean in plain language
3. Step-by-step actions the user can take
4. Their rights and what authorities can/cannot do
5. Practical tips, deadlines, or documents needed
6. When and why to consult a lawyer
7. Emergency contacts if relevant (100 police, 112 emergency)

Use clear headings and bullet points to organize the response. Be thorough but keep language simple.

Tone: calm, clear, empowering. This is legal information, not legal advice.`;

    const systemPrompt = `You are Nyay Mitra (meaning "Legal Friend" in Hindi), an expert Indian legal assistant. You provide accurate, practical legal guidance based on Indian laws, the Constitution of India, and citizens' rights.

Your expertise covers:
- Constitution of India & Fundamental Rights (Articles 12-35)
- Indian Penal Code (IPC) & Criminal Procedure Code (CrPC)
- Motor Vehicles Act, 1988 & traffic laws
- Consumer Protection Act, 2019
- Labour laws (Industrial Disputes Act, Shops & Establishments Act, EPF, ESI)
- Property laws (Transfer of Property Act, RERA)
- Family laws (Hindu Marriage Act, Muslim Personal Law, etc.)
- Right to Information Act, 2005
- Protection of Human Rights Act, 1993
- Code of Civil Procedure (CPC)

LANGUAGE INSTRUCTION: ${langInstruction}

${detailed ? detailedGuidelines : briefGuidelines}`;

    // Build Gemini conversation (history passed from frontend localStorage)
    const conversationHistory = (history || []).slice(-10);

    // Map roles: assistant -> model for Gemini
    const contents = conversationHistory.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    // Ensure last turn is user
    if (!contents.length || contents[contents.length - 1].role !== 'user') {
      contents.push({ role: 'user', parts: [{ text: message }] });
    }

    const geminiResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          maxOutputTokens: detailed ? 1500 : 400,
          temperature: 0.7
        }
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const aiReply = geminiResponse.data.candidates[0].content.parts[0].text;

    res.json({
      success: true,
      reply: aiReply,
      category: detectCategory(message),
      mode: detailed ? 'detailed' : 'brief'
    });

  } catch (err) {
    console.error('Gemini error:', err.response?.data || err.message);
    res.status(500).json({ success: false, message: 'Failed to get response. Please try again.' });
  }
});

module.exports = router;