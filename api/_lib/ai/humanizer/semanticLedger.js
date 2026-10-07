/**
 * PenShift Semantic Ledger Engine
 * Decomposes source text into proposition-level invariants, semantic envelopes, and FACT_LOCK artifacts.
 */

import crypto from 'crypto';
import { extractProtectedSpans } from './protectedSpans.js';
import { buildClaimGraph } from './claimGraph.js';

// Modality classifications
const MODAL_CERTAINTY_MAP = {
  may: 'possibility',
  might: 'possibility',
  could: 'possibility',
  can: 'ability_or_permission',
  possibly: 'possibility',
  perhaps: 'possibility',
  maybe: 'possibility',
  likely: 'probability_high',
  unlikely: 'probability_low',
  probably: 'probability_high',
  definitely: 'certainty_high',
  certainly: 'certainty_high',
  always: 'certainty_absolute',
  never: 'negation_absolute',
  will: 'future_certainty',
  shall: 'obligation_formal',
  must: 'obligation_strict',
  should: 'recommendation',
  ought: 'recommendation',
  approximately: 'approximation',
  roughly: 'approximation',
  about: 'approximation',
  exactly: 'precision_strict',
};

// Polarity / Negation patterns
const NEGATION_PATTERNS = [
  /\b(cannot|can't)\b/gi,
  /\b(will not|won't)\b/gi,
  /\b(do not|don't|does not|doesn't|did not|didn't)\b/gi,
  /\b(is not|isn't|are not|aren't|was not|wasn't|were not|weren't)\b/gi,
  /\b(have not|haven't|has not|hasn't|had not|hadn't)\b/gi,
  /\b(should not|shouldn't|must not|mustn't)\b/gi,
  /\b(not|never|no|neither|nor|none|nowhere|nobody|nothing)\b/gi,
  /\b(without|prohibited|forbidden|unable|fails to|disallowed)\b/gi,
];

// Causal connectives
const CAUSAL_CONNECTIVES = [
  { regex: /\b(?:because of|because|since|as a result of|due to)\s+(.+?)(?:,\s*|\.\s*|\s+so\s+|\s+therefore\s+)(.+)/i, causeFirst: true },
  { regex: /\b(.+?)\s+(?:therefore|thus|hence|consequently|as a result)\s+(.+)/i, causeFirst: true },
  { regex: /\b(.+?)\s+(?:leads to|causes|results in)\s+(.+)/i, causeFirst: true },
  { regex: /\b(.+?)\s+(?:because of|because|since|due to)\s+(.+)/i, causeFirst: false },
];

// Conditional markers
const CONDITIONAL_MARKERS = [
  /\b(only if|if|unless|provided that|on the condition that|as long as|when|whenever)\b/gi,
  /\b(without|except when|except if|with the exception of)\b/gi,
];

/**
 * Computes deterministic SHA-256 hash of normalized text.
 */
export function hashText(text) {
  if (typeof text !== 'string') return '';
  const normalized = text.trim().replace(/\s+/g, ' ');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Splits text into discrete structural blocks (headings, lists, quotes, paragraphs).
 */
export function extractDocumentStructure(text) {
  if (!text || typeof text !== 'string') return [];
  const lines = text.split(/\r?\n/);
  const structure = [];

  let currentPara = [];

  function flushPara() {
    if (currentPara.length > 0) {
      const content = currentPara.join('\n').trim();
      if (content) {
        structure.push({ type: 'paragraph', content });
      }
      currentPara = [];
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushPara();
      continue;
    }

    if (/^#{1,6}\s+/.test(trimmed)) {
      flushPara();
      structure.push({ type: 'heading', level: trimmed.match(/^#+/)[0].length, content: trimmed.replace(/^#{1,6}\s+/, '') });
    } else if (/^[-*+]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      flushPara();
      structure.push({ type: 'list_item', content: trimmed });
    } else if (/^>\s+/.test(trimmed)) {
      flushPara();
      structure.push({ type: 'quote', content: trimmed.replace(/^>\s+/, '') });
    } else if (/^```/.test(trimmed)) {
      flushPara();
      structure.push({ type: 'code_block', content: trimmed });
    } else {
      currentPara.push(line);
    }
  }
  flushPara();
  return structure;
}

/**
 * Extracts negation signals and their immediate scopes.
 */
export function extractNegations(text) {
  if (!text || typeof text !== 'string') return [];
  const negations = [];

  const sentences = text.split(/(?<=[.?!])\s+/).filter(Boolean);
  for (const sentence of sentences) {
    for (const pat of NEGATION_PATTERNS) {
      let match;
      const regex = new RegExp(pat.source, 'gi');
      while ((match = regex.exec(sentence)) !== null) {
        const token = match[0].toLowerCase();
        // Capture context around negation
        const start = Math.max(0, match.index - 20);
        const end = Math.min(sentence.length, match.index + match[0].length + 40);
        const scope = sentence.slice(start, end).trim();

        negations.push({
          token,
          sentence: sentence.trim(),
          scope,
          polarity: 'negative',
        });
      }
    }
  }
  return negations;
}

/**
 * Extracts modality markers and certainty signals.
 */
export function extractModalitySignals(text) {
  if (!text || typeof text !== 'string') return [];
  const signals = [];

  const words = text.toLowerCase().split(/\b/);
  for (const w of words) {
    const term = w.trim();
    if (MODAL_CERTAINTY_MAP[term]) {
      signals.push({
        term,
        classification: MODAL_CERTAINTY_MAP[term],
      });
    }
  }
  return signals;
}

/**
 * Extracts causal relations from text.
 */
export function extractCausalRelations(text) {
  if (!text || typeof text !== 'string') return [];
  const relations = [];

  const sentences = text.split(/(?<=[.?!])\s+/).filter(Boolean);
  for (const sentence of sentences) {
    for (const { regex, causeFirst } of CAUSAL_CONNECTIVES) {
      const match = sentence.match(regex);
      if (match) {
        const partA = match[1]?.trim();
        const partB = match[2]?.trim() || match[3]?.trim();
        if (partA && partB) {
          relations.push({
            sentence: sentence.trim(),
            cause: causeFirst ? partA : partB,
            effect: causeFirst ? partB : partA,
            connector: match[0].slice(0, 30),
          });
          break;
        }
      }
    }
  }
  return relations;
}

/**
 * Extracts conditional constraints from text.
 */
export function extractConditions(text) {
  if (!text || typeof text !== 'string') return [];
  const conditions = [];

  const sentences = text.split(/(?<=[.?!])\s+/).filter(Boolean);
  for (const sentence of sentences) {
    for (const pat of CONDITIONAL_MARKERS) {
      let match;
      const regex = new RegExp(pat.source, 'gi');
      while ((match = regex.exec(sentence)) !== null) {
        conditions.push({
          marker: match[0].toLowerCase(),
          sentence: sentence.trim(),
        });
      }
    }
  }
  return conditions;
}

/**
 * Extracts comparative claims from text.
 */
export function extractComparisons(text) {
  if (!text || typeof text !== 'string') return [];
  const comparisons = [];
  const compRegex = /\b([A-Za-z0-9_ -]+?)\s+(?:is|are|was|were)?\s*(faster|slower|better|worse|cheaper|more expensive|higher|lower|superior|inferior|more\s+\w+|less\s+\w+)\s+than\s+([A-Za-z0-9_ -]+)/gi;
  let match;
  while ((match = compRegex.exec(text)) !== null) {
    comparisons.push({
      subject: match[1].trim(),
      metric: match[2].trim(),
      object: match[3].trim(),
      raw: match[0].trim(),
    });
  }
  return comparisons;
}

/**
 * Decomposes sentence into atomic proposition.
 */
export function parseSentenceProposition(sentence) {
  const clean = sentence.trim();
  if (!clean) return null;

  // Extract polarity
  let polarity = 'positive';
  for (const pat of NEGATION_PATTERNS) {
    if (pat.test(clean)) {
      polarity = 'negative';
      break;
    }
  }

  // Extract modality
  let modality = 'certainty';
  for (const [term, val] of Object.entries(MODAL_CERTAINTY_MAP)) {
    const rx = new RegExp(`\\b${term}\\b`, 'i');
    if (rx.test(clean)) {
      modality = val;
      break;
    }
  }

  // Basic subject-verb-object heuristic
  const words = clean.split(/\s+/);
  const subject = words.slice(0, Math.min(3, words.length)).join(' ');
  const predicate = words.slice(Math.min(3, words.length)).join(' ');

  return {
    raw: clean,
    subject,
    predicate,
    polarity,
    modality,
  };
}

/**
 * Builds the complete immutable Source Envelope before generation.
 * This envelope is the single source of truth.
 */
export function buildSourceEnvelope(originalText, options = {}) {
  const text = typeof originalText === 'string' ? originalText : String(originalText || '');
  const normalizedText = text.trim().replace(/\r\n/g, '\n');
  const sourceHash = hashText(normalizedText);

  const documentStructure = extractDocumentStructure(normalizedText);
  const protectedSpans = extractProtectedSpans(normalizedText);

  // Group protected spans into categories
  const entities = protectedSpans.filter((s) => s.type === 'entity');
  const quantitativeClaims = protectedSpans.filter((s) => s.type === 'numeric' || s.type === 'percentage' || s.type === 'currency' || s.type === 'unit');
  const temporalClaims = protectedSpans.filter((s) => s.type === 'date' || s.type === 'time');
  const citations = protectedSpans.filter((s) => s.type === 'citation');
  const urls = protectedSpans.filter((s) => s.type === 'url' || s.type === 'email');
  const quotedText = protectedSpans.filter((s) => s.type === 'quoted');

  const negations = extractNegations(normalizedText);
  const modalitySignals = extractModalitySignals(normalizedText);
  const causalRelations = extractCausalRelations(normalizedText);
  const conditions = extractConditions(normalizedText);
  const comparisons = extractComparisons(normalizedText);

  // Extract propositions from sentences
  const rawSentences = normalizedText.split(/(?<=[.?!])\s+/).filter(Boolean);
  const factualClaims = rawSentences.map((s, idx) => ({
    id: `prop-${idx + 1}`,
    ...parseSentenceProposition(s),
  }));

  // Build semantic constraints
  const semanticConstraints = [];
  if (negations.length > 0) {
    semanticConstraints.push(`PRESERVE_POLARITY: ${negations.length} negative claims must not be reversed.`);
  }
  if (quantitativeClaims.length > 0) {
    semanticConstraints.push(`PRESERVE_NUMERICS: ${quantitativeClaims.length} numbers/currencies/units must remain exact.`);
  }
  if (temporalClaims.length > 0) {
    semanticConstraints.push(`PRESERVE_CHRONOLOGY: ${temporalClaims.length} dates/times must remain exact.`);
  }
  if (modalitySignals.length > 0) {
    semanticConstraints.push(`PRESERVE_UNCERTAINTY: Modal forces (may, might, likely, must) must remain faithful.`);
  }
  if (causalRelations.length > 0) {
    semanticConstraints.push(`PRESERVE_CAUSALITY: Causal direction must not be reversed.`);
  }

  return {
    originalText,
    normalizedText,
    sourceHash,
    documentStructure,
    protectedSpans,
    entities,
    factualClaims,
    quantitativeClaims,
    temporalClaims,
    negations,
    modalitySignals,
    causalRelations,
    conditions,
    comparisons,
    claimGraph: buildClaimGraph(normalizedText),
    instructions: options.instructions || [],
    citations,
    urls,
    quotedText,
    technicalTerms: options.technicalTerms || [],
    semanticConstraints,
  };
}

/**
 * Builds the concrete FACT_LOCK artifact for checkpointing.
 */
export function buildFactLock(envelope) {
  if (!envelope) return null;
  return {
    version: '2.0',
    sourceHash: envelope.sourceHash,
    lockedAt: Date.now(),
    claims: envelope.factualClaims || [],
    claimGraph: envelope.claimGraph || null,
    numbers: envelope.quantitativeClaims || [],
    entities: envelope.entities || [],
    dates: envelope.temporalClaims || [],
    negations: envelope.negations || [],
    conditions: envelope.conditions || [],
    uncertainty: envelope.modalitySignals || [],
    relationships: envelope.causalRelations || [],
    comparisons: envelope.comparisons || [],
    protectedSpanCount: envelope.protectedSpans?.length || 0,
  };
}
