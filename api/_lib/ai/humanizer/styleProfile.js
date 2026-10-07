/**
 * PenShift Style Profile Engine
 * Extracts deep stylometric voice characteristics independently from semantic meaning.
 * Enforces priority: MEANING > FACTUAL FIDELITY > USER INTENT > STRUCTURAL CONSTRAINTS > STYLE > COSMETIC VARIATION.
 */

const FORMAL_TRANSITIONS = new Set([
  'furthermore', 'moreover', 'consequently', 'therefore', 'nevertheless',
  'nonetheless', 'accordingly', 'subsequently', 'in addition', 'in conclusion',
]);

const COLLOQUIAL_CONTRACTIONS = [
  "can't", "won't", "don't", "didn't", "doesn't", "it's", "that's", "there's",
  "we're", "they're", "you're", "i'm", "i've", "we've", "couldn't", "wouldn't", "shouldn't",
];

const EXPANDED_FORMS = [
  'cannot', 'will not', 'do not', 'did not', 'does not', 'it is', 'that is', 'there is',
  'we are', 'they are', 'you are', 'i am', 'i have', 'we have', 'could not', 'would not', 'should not',
];

/**
 * Calculates sentence length distribution and rhythm.
 */
export function analyzeSentenceLengths(sentences) {
  if (!sentences || sentences.length === 0) {
    return { min: 0, max: 0, mean: 0, variance: 0, bimodal: false, distribution: [] };
  }

  const lengths = sentences.map((s) => s.trim().split(/\s+/).filter(Boolean).length);
  const min = Math.min(...lengths);
  const max = Math.max(...lengths);
  const sum = lengths.reduce((acc, l) => acc + l, 0);
  const mean = sum / lengths.length;

  const variance = lengths.reduce((acc, l) => acc + Math.pow(l - mean, 2), 0) / lengths.length;

  // Bimodal detection: presence of both very short (<=7 words) and long (>=22 words) sentences
  const hasShort = lengths.some((l) => l <= 7);
  const hasLong = lengths.some((l) => l >= 22);
  const bimodal = hasShort && hasLong;

  return {
    min,
    max,
    mean: Math.round(mean * 10) / 10,
    variance: Math.round(variance * 10) / 10,
    bimodal,
    lengths,
  };
}

/**
 * Analyzes sentence opening diversity and repetition patterns.
 */
export function analyzeSentenceOpenings(sentences) {
  if (!sentences || sentences.length === 0) return { uniqueRatio: 1, frequentOpeners: [] };

  const openers = sentences.map((s) => {
    const words = s.trim().split(/\s+/).filter(Boolean);
    return words.slice(0, 2).join(' ').toLowerCase();
  });

  const counts = {};
  for (const op of openers) {
    if (op) counts[op] = (counts[op] || 0) + 1;
  }

  const frequentOpeners = Object.entries(counts)
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([opener, count]) => ({ opener, count }));

  const uniqueRatio = Object.keys(counts).length / (openers.length || 1);
  return {
    uniqueRatio: Math.round(uniqueRatio * 100) / 100,
    frequentOpeners,
  };
}

/**
 * Calculates vocabulary density (Type-Token Ratio) and contraction habits.
 */
export function analyzeLexicalHabits(text) {
  if (!text) return { ttr: 0, contractionRatio: 0, formality: 'neutral' };

  const words = text.toLowerCase().match(/\b[a-z']+\b/g) || [];
  if (words.length === 0) return { ttr: 0, contractionRatio: 0, formality: 'neutral' };

  const uniqueWords = new Set(words);
  const ttr = uniqueWords.size / words.length;

  let contractionCount = 0;
  for (const c of COLLOQUIAL_CONTRACTIONS) {
    const rx = new RegExp(`\\b${c}\\b`, 'gi');
    const matches = text.match(rx);
    if (matches) contractionCount += matches.length;
  }

  let expandedCount = 0;
  for (const exp of EXPANDED_FORMS) {
    const rx = new RegExp(`\\b${exp}\\b`, 'gi');
    const matches = text.match(rx);
    if (matches) expandedCount += matches.length;
  }

  const totalContractable = contractionCount + expandedCount;
  const contractionRatio = totalContractable > 0 ? contractionCount / totalContractable : 0.5;

  let formalTransitionCount = 0;
  for (const ft of FORMAL_TRANSITIONS) {
    if (text.toLowerCase().includes(ft)) formalTransitionCount++;
  }

  let formality = 'balanced';
  if (contractionRatio < 0.2 && formalTransitionCount >= 2) {
    formality = 'formal';
  } else if (contractionRatio > 0.6) {
    formality = 'conversational';
  }

  return {
    ttr: Math.round(ttr * 100) / 100,
    contractionCount,
    expandedCount,
    contractionRatio: Math.round(contractionRatio * 100) / 100,
    formalTransitionCount,
    formality,
  };
}

/**
 * Analyzes punctuation habits (em-dashes, semicolons, colons, rhetorical questions).
 */
export function analyzePunctuation(text) {
  if (!text) return {};
  return {
    emDashes: (text.match(/—|--/g) || []).length,
    semicolons: (text.match(/;/g) || []).length,
    colons: (text.match(/:/g) || []).length,
    questions: (text.match(/\?/g) || []).length,
    exclamations: (text.match(/!/g) || []).length,
    parentheses: (text.match(/\([^)]+\)/g) || []).length,
    ellipses: (text.match(/\.\.\./g) || []).length,
  };
}

/**
 * Builds a holistic Style Profile for the document, incorporating user controls.
 */
export function buildStyleProfile(text, userControls = {}) {
  const sentences = (text || '').split(/(?<=[.?!])\s+/).filter((s) => s.trim().length > 0);
  const paragraphs = (text || '').split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  const sentenceLengthProfile = analyzeSentenceLengths(sentences);
  const sentenceOpeningProfile = analyzeSentenceOpenings(sentences);
  const lexicalHabits = analyzeLexicalHabits(text);
  const punctuation = analyzePunctuation(text);

  // Analyze first-person and second-person stance
  const firstPersonCount = (text.match(/\b(i|me|my|mine|we|us|our|ours)\b/gi) || []).length;
  const secondPersonCount = (text.match(/\b(you|your|yours)\b/gi) || []).length;

  // Active vs passive balance heuristic
  const passiveConstructions = (text.match(/\b(is|are|was|were|been|being)\s+([a-z]+ed|[a-z]+en)\b/gi) || []).length;

  return {
    sentenceLengths: sentenceLengthProfile,
    sentenceOpenings: sentenceOpeningProfile,
    lexical: lexicalHabits,
    punctuation,
    stance: {
      firstPersonCount,
      secondPersonCount,
      passiveConstructions,
      hasRhetoricalQuestions: punctuation.questions > 0,
    },
    paragraphs: {
      count: paragraphs.length,
      avgSentencesPerParagraph: paragraphs.length > 0 ? Math.round((sentences.length / paragraphs.length) * 10) / 10 : 0,
    },
    userControls: {
      tone: userControls.tone || 'standard',
      writingStyle: userControls.writingStyle || 'natural',
      vocab: userControls.vocab || 'natural',
      sentenceLength: userControls.sentenceLength || 'varied',
      userMemory: userControls.userMemory || '',
    },
    hierarchyMandate: 'MEANING > FACTUAL FIDELITY > USER INTENT > STRUCTURAL CONSTRAINTS > STYLE > COSMETIC VARIATION',
  };
}
