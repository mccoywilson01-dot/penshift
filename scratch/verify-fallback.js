import fetch from 'node-fetch';

const key = process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY;

async function verifyFallback() {
  const models = ['gemini-2.5-flash', 'gemini-flash-latest'];
  let success = false;
  let finalModel = null;
  
  for (const model of models) {
    try {
      console.log(`Testing model: ${model}...`);
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Say hi' }] }] })
      });
      
      if (!res.ok) {
        if (res.status === 404) {
          console.log(`[CATCH] Model 404 detected for ${model}. Moving to next model...`);
          throw new Error(`[Model 404]`);
        }
        throw new Error(`API Error: ${res.status}`);
      }
      
      console.log(`[SUCCESS] Generated using ${model}!`);
      success = true;
      finalModel = model;
      break;
      
    } catch (e) {
      if (e.message.includes('[Model 404]')) {
        continue;
      }
      console.error(`[FAIL] Uncaught error: ${e.message}`);
      break;
    }
  }
  
  if (success) {
    console.log(`Verification Complete: Fallback chain successfully landed on ${finalModel}. API Key is safe.`);
  } else {
    console.log(`Verification Failed: No models succeeded.`);
  }
}

verifyFallback();
