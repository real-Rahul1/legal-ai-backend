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

// POST /api/chats/message — stateless, no auth required
router.post('/message', async (req, res) => {
  const { message, history } = req.body;
  if (!message?.trim()) return res.status(400).json({ success: false, message: 'Message required' });

  const lang = req.body.lang || 'en';

  try {
    const langInstructions = {
      en: 'Respond in clear, simple English.',
      hi: 'अपना पूरा जवाब हिंदी में दें। सरल और स्पष्ट हिंदी का उपयोग करें जो आम नागरिक समझ सके। कानूनी शब्दों के साथ उनका हिंदी अर्थ भी बताएं।',
      bn: 'সম্পূর্ণ উত্তর বাংলায় দিন। সহজ ও স্পষ্ট বাংলা ব্যবহার করুন যা সাধারণ নাগরিক বুঝতে পারেন। আইনি শব্দগুলির পাশে তাদের বাংলা অর্থও উল্লেখ করুন।'
    };
    const langInstruction = langInstructions[lang] || langInstructions['en'];

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

RESPONSE GUIDELINES:
1. Start with immediate, actionable advice for the situation
2. Cite specific Indian laws, sections, or articles when relevant
3. Explain rights clearly in simple language
4. Use structured format: 🚨 Immediate Steps → ⚖️ Your Rights → 📋 Legal Framework → 💡 Pro Tips
5. Always mention when to consult a lawyer for complex matters
6. Be empathetic and reassuring — many users are in stressful situations
7. For emergencies, provide emergency contacts (100 for police, 112 national emergency)
8. Note: This is legal information, not legal advice. Recommend professional lawyers for court matters.

Always respond in a helpful, clear, and empowering tone — help citizens know their rights!`;

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
        generationConfig: { maxOutputTokens: 1500, temperature: 0.7 }
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const aiReply = geminiResponse.data.candidates[0].content.parts[0].text;

    res.json({
      success: true,
      reply: aiReply,
      category: detectCategory(message)
    });

  } catch (err) {
    console.error('Gemini error:', err.response?.data || err.message);
    res.status(500).json({ success: false, message: 'Failed to get response. Please try again.' });
  }
});

module.exports = router;
