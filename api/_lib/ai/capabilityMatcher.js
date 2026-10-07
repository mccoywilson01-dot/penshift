import { getModelsByProvider } from './modelRegistry.js';
import { getProviderHealth } from './circuitBreaker.js';

/**
 * Capability Matcher for PenShift.
 * Intelligently routes requests to the optimal provider and model.
 */
export function matchProviderAndModel(options = {}) {
  const {
    task = 'humanize',
    mode: _mode = 'standard',
    inputText = '',
    requestedProvider = 'auto',
  } = options;

  const wordCount = (inputText || '').trim().split(/\s+/).filter(Boolean).length;
  const groqHealth = getProviderHealth('groq');
  const geminiHealth = getProviderHealth('gemini');

  let primaryProvider = requestedProvider;
  if (primaryProvider === 'auto' || !['groq', 'gemini'].includes(primaryProvider)) {
    // Intelligent routing heuristics:
    // 1. Scoring tasks: groq is ultra fast with openai/gpt-oss-20b or llama-3.3-70b-versatile
    // 2. Long form blog (> 1,500 words input or complex context): gemini has massive context window
    // 3. High throughput humanizing (< 600 words): groq provides sub-second drafting
    if (task === 'score') {
      primaryProvider = groqHealth.available ? 'groq' : 'gemini';
    } else if (wordCount > 1500 && geminiHealth.available) {
      primaryProvider = 'gemini';
    } else if (groqHealth.available) {
      primaryProvider = 'groq';
    } else {
      primaryProvider = 'gemini';
    }
  } else {
    // If requested provider is down, fallback to other
    if (primaryProvider === 'groq' && !groqHealth.available && geminiHealth.available) {
      primaryProvider = 'gemini';
    } else if (primaryProvider === 'gemini' && !geminiHealth.available && groqHealth.available) {
      primaryProvider = 'groq';
    }
  }

  const secondaryProvider = primaryProvider === 'groq' ? 'gemini' : 'groq';

  // Select optimal model for primary provider
  const primaryModels = getModelsByProvider(primaryProvider, { onlyEnabled: true });
  let primaryModel = primaryModels[0]?.providerModelId;

  if (task === 'score') {
    const scoreModel = primaryModels.find((m) => m.scoringMaxOutputTokens);
    if (scoreModel) primaryModel = scoreModel.providerModelId;
  }

  // Select optimal model for secondary provider
  const secondaryModels = getModelsByProvider(secondaryProvider, { onlyEnabled: true });
  let secondaryModel = secondaryModels[0]?.providerModelId;

  if (task === 'score') {
    const scoreModel = secondaryModels.find((m) => m.scoringMaxOutputTokens);
    if (scoreModel) secondaryModel = scoreModel.providerModelId;
  }

  return {
    actual_provider: primaryProvider,
    actual_model: primaryModel || (primaryProvider === 'groq' ? 'openai/gpt-oss-120b' : 'gemini-3.8-flash'),
    fallback_provider: secondaryProvider,
    fallback_model: secondaryModel || (secondaryProvider === 'groq' ? 'openai/gpt-oss-120b' : 'gemini-3.8-flash'),
  };
}
