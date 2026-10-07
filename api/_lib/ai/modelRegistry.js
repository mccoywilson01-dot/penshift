/**
 * Centralized Model Registry for PenShift AI SaaS.
 * Distinguishes official physical provider capabilities from PenShift configured safety budgets.
 * Targets authentic production LLM IDs on Groq (Llama 3.3/3.1) and Google (Gemini 2.0/1.5).
 */

export const MODEL_REGISTRY = {
  // ═══════════════════════════════════ GROQ HOSTED PRODUCTION MODELS ═══════════════════════════════════
  'openai/gpt-oss-120b': {
    provider: 'groq',
    providerModelId: 'openai/gpt-oss-120b',
    status: 'production',
    purpose: 'Primary drafting, forensic critique, human cadence synthesis, stylometric verification',
    fallbackPriority: 1,
    enabled: true,
    isCanonical: true,
    providerContextLimit: 131072,      // 128k physical context
    providerMaxOutputTokens: 65536,    // 64k physical output capacity
    supportsStreaming: true,
    supportsStructuredOutputs: true,
    defaultMaxOutputTokens: 4096,
    debateDraftMaxOutputTokens: 3000,
    refineMaxOutputTokens: 4096,
    defaultTemperature: 0.72,
    presencePenalty: 0.6,
  },

  'openai/gpt-oss-20b': {
    provider: 'groq',
    providerModelId: 'openai/gpt-oss-20b',
    status: 'production',
    purpose: 'High-throughput input scoring, fact lock extraction, structural blueprinting',
    fallbackPriority: 2,
    enabled: true,
    isCanonical: true,
    providerContextLimit: 131072,      // 128k physical context
    providerMaxOutputTokens: 8192,
    supportsStreaming: true,
    supportsStructuredOutputs: true,
    defaultMaxOutputTokens: 2048,
    scoringMaxOutputTokens: 512,       // Strict budget for non-streaming JSON scoring
    factLockMaxOutputTokens: 1024,
    defaultTemperature: 0.2,           // Low temperature for analytical scoring
  },

  'qwen/qwen3.8-27b': {
    provider: 'groq',
    providerModelId: 'qwen/qwen3.8-27b',
    status: 'disabled',
    purpose: 'Preview model disabled by default; deterministic canonical fallback',
    fallbackPriority: 99,
    enabled: false,
    isCanonical: false,
    providerContextLimit: 32768,
    providerMaxOutputTokens: 8192,
    supportsStreaming: true,
    supportsStructuredOutputs: false,
    defaultMaxOutputTokens: 2048,
    defaultTemperature: 0.72,
  },

  // Backward-compatible aliases for Groq pointing to live operational IDs:
  'llama-3.3-70b-versatile': {
    provider: 'groq',
    providerModelId: 'openai/gpt-oss-120b',
    status: 'production',
    purpose: 'Primary drafting, forensic critique, human cadence synthesis, stylometric verification',
    fallbackPriority: 10,
    enabled: true,
    isCanonical: false,
    providerContextLimit: 131072,
    providerMaxOutputTokens: 32768,
    supportsStreaming: true,
    supportsStructuredOutputs: true,
    defaultMaxOutputTokens: 4096,
    debateDraftMaxOutputTokens: 3000,
    refineMaxOutputTokens: 4096,
    defaultTemperature: 0.72,
    presencePenalty: 0.6,
  },

  'llama-3.1-8b-instant': {
    provider: 'groq',
    providerModelId: 'openai/gpt-oss-20b',
    status: 'production',
    purpose: 'High-throughput input scoring, fact lock extraction, structural blueprinting',
    fallbackPriority: 11,
    enabled: true,
    isCanonical: false,
    providerContextLimit: 131072,
    providerMaxOutputTokens: 8192,
    supportsStreaming: true,
    supportsStructuredOutputs: true,
    defaultMaxOutputTokens: 2048,
    scoringMaxOutputTokens: 512,
    factLockMaxOutputTokens: 1024,
    defaultTemperature: 0.2,
  },

  // ═══════════════════════════════════ GOOGLE GEMINI PRODUCTION MODELS ═══════════════════════════════════
  'gemini-3.5-flash': {
    provider: 'gemini',
    providerModelId: 'gemini-3.5-flash',
    status: 'production',
    purpose: 'Primary Google drafting, long-form humanization, stylometric verification fallback',
    fallbackPriority: 1,
    enabled: true,
    isCanonical: true,
    providerContextLimit: 1048576,     // 1,048,576 tokens physical context
    providerMaxOutputTokens: 65536,    // 65,536 tokens physical output capacity
    supportsStreaming: true,
    supportsStructuredOutputs: true,
    defaultMaxOutputTokens: 4096,
    defaultTemperature: 0.75,
    topP: 0.90,
    topK: 40,
  },

  'gemini-3.8-flash': {
    provider: 'gemini',
    providerModelId: 'gemini-3.8-flash',
    status: 'production',
    purpose: 'Secondary Google drafting model',
    fallbackPriority: 2,
    enabled: true,
    isCanonical: false,
    providerContextLimit: 1048576,
    providerMaxOutputTokens: 65536,
    supportsStreaming: true,
    supportsStructuredOutputs: true,
    defaultMaxOutputTokens: 4096,
    defaultTemperature: 0.75,
    topP: 0.90,
    topK: 40,
  },

  'gemini-2.5-flash': {
    provider: 'gemini',
    providerModelId: 'gemini-3.5-flash',
    status: 'production',
    purpose: 'Canonical drafting alias resolving to operational flash model',
    fallbackPriority: 10,
    enabled: true,
    isCanonical: false,
    providerContextLimit: 1048576,
    providerMaxOutputTokens: 65536,
    supportsStreaming: true,
    supportsStructuredOutputs: true,
    defaultMaxOutputTokens: 4096,
    defaultTemperature: 0.75,
    topP: 0.90,
    topK: 40,
  },

  'gemini-3.1-flash-lite': {
    provider: 'gemini',
    providerModelId: 'gemini-3.1-flash-lite',
    status: 'production',
    purpose: 'Cost-optimized fast scoring, fact lock extraction, directional semantic verification',
    fallbackPriority: 3,
    enabled: true,
    isCanonical: true,
    providerContextLimit: 1048576,
    providerMaxOutputTokens: 8192,
    supportsStreaming: true,
    supportsStructuredOutputs: true,
    defaultMaxOutputTokens: 2048,
    scoringMaxOutputTokens: 512,
    defaultTemperature: 0.1,
  },

  'gemini-flash-latest': {
    provider: 'gemini',
    providerModelId: 'gemini-flash-latest',
    status: 'production',
    purpose: 'High-resilience secondary fallback drafting model',
    fallbackPriority: 4,
    enabled: true,
    isCanonical: false,
    providerContextLimit: 1048576,
    providerMaxOutputTokens: 65536,
    supportsStreaming: true,
    supportsStructuredOutputs: true,
    defaultMaxOutputTokens: 4096,
    defaultTemperature: 0.75,
    topP: 0.90,
  },

  // Backward-compatible aliases for Gemini pointing to live operational IDs:
  'gemini-2.0-flash': {
    provider: 'gemini',
    providerModelId: 'gemini-3.8-flash',
    status: 'production',
    purpose: 'Legacy drafting alias resolving to operational gemini-3.8-flash',
    fallbackPriority: 10,
    enabled: true,
    isCanonical: false,
    providerContextLimit: 1048576,
    providerMaxOutputTokens: 65536,
    supportsStreaming: true,
    supportsStructuredOutputs: true,
    defaultMaxOutputTokens: 4096,
    defaultTemperature: 0.75,
    topP: 0.90,
    topK: 40,
  },

  'gemini-1.5-flash': {
    provider: 'gemini',
    providerModelId: 'gemini-3.1-flash-lite',
    status: 'production',
    purpose: 'Legacy scoring alias resolving to operational gemini-3.1-flash-lite',
    fallbackPriority: 11,
    enabled: true,
    isCanonical: false,
    providerContextLimit: 1048576,
    providerMaxOutputTokens: 8192,
    supportsStreaming: true,
    supportsStructuredOutputs: true,
    defaultMaxOutputTokens: 2048,
    scoringMaxOutputTokens: 512,
    defaultTemperature: 0.1,
  },


  'gemini-3.5-flash-lite': {
    provider: 'gemini',
    providerModelId: 'gemini-3.1-flash-lite',
    status: 'production',
    purpose: 'Scoring alias resolving to operational gemini-3.1-flash-lite',
    fallbackPriority: 13,
    enabled: true,
    isCanonical: false,
    providerContextLimit: 1048576,
    providerMaxOutputTokens: 8192,
    supportsStreaming: true,
    supportsStructuredOutputs: true,
    defaultMaxOutputTokens: 2048,
    scoringMaxOutputTokens: 512,
    defaultTemperature: 0.1,
  },
};

/**
 * Retrieves registry entry for a specific model ID.
 */
export function getModel(modelId) {
  return MODEL_REGISTRY[modelId] || null;
}

/**
 * Returns available models for a given provider ('groq' | 'gemini').
 * Prioritizes canonical production models.
 */
export function getModelsByProvider(provider, options = {}) {
  const { onlyEnabled = true, canonicalOnly = false } = options;
  return Object.values(MODEL_REGISTRY)
    .filter((m) => {
      if (m.provider !== provider) return false;
      if (onlyEnabled && !m.enabled) return false;
      if (canonicalOnly && !m.isCanonical) return false;
      return true;
    })
    .sort((a, b) => a.fallbackPriority - b.fallbackPriority);
}

/**
 * Resolves optimal model config for a requested provider and task/purpose.
 */
export function resolveModel(provider, purpose = 'draft') {
  const models = getModelsByProvider(provider, { onlyEnabled: true, canonicalOnly: true });
  if (purpose === 'score' || purpose === 'fast' || purpose === 'verifier') {
    const scoringModel = models.find((m) => m.scoringMaxOutputTokens);
    return scoringModel || models[models.length - 1];
  }
  return models[0] || null;
}
