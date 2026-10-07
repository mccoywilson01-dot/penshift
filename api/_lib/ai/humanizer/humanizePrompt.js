/* eslint-disable no-control-regex */
/**
 * PenShift Controlled Humanization Engine Prompt Builder
 * Assembles structured generation briefs with semantic ledger constraints, protected spans, and style objectives.
 */

import { countWords } from '../promptBuilders.js';

export function buildStructuredHumanizerBrief(sourceEnvelope, styleProfile, riskProfile, options = {}) {
  const inputText = sourceEnvelope?.normalizedText || '';
  const inputWords = countWords(inputText);

  // Target word count bounding
  const minWords = Math.floor(inputWords * 0.88);
  const maxWords = Math.ceil(inputWords * 1.15);

  const mode = options.mode || 'standard';
  const vocab = options.vocab || 'natural';
  const sentenceLength = options.sentenceLength || 'varied';
  const userMemory = options.userMemory || '';

  // Vocabulary objective
  let lexicalObjective = 'LEXICAL OBJECTIVE:\nUse precise, authentic English without unnecessary or artificial synonym replacement. Eliminate mechanical AI buzzwords (e.g., delve, leverage, robust, testament, seamlessly, tapestry). Maintain domain terminology without distortion.';
  if (vocab === 'simple') {
    lexicalObjective = 'LEXICAL OBJECTIVE:\nUse clean, accessible plain English (Grade 6–8 level). Favor concrete nouns and direct active verbs. Avoid academic jargon unless required for factual fidelity.';
  } else if (vocab === 'advanced') {
    lexicalObjective = 'LEXICAL OBJECTIVE:\nEmploy an articulate, nuanced, and mature lexicon suited for rigorous professional publishing. Never sacrifice factual accuracy for ornament.';
  }

  // Rhythm objective
  let rhythmObjective = 'RHYTHM OBJECTIVE:\nIntroduce natural human sentence-length variance. Create bimodal burstiness: pair expansive, multi-clause analytical sentences (20–35 words) with crisp, punchy clauses or fragments (3–8 words). Avoid formulaic rhythmic monotony.';
  if (sentenceLength === 'short') {
    rhythmObjective = 'RHYTHM OBJECTIVE:\nKeep sentences predominantly crisp and direct (7–16 words). Eliminate rambling filler and redundant subordination.';
  } else if (sentenceLength === 'long') {
    rhythmObjective = 'RHYTHM OBJECTIVE:\nFavor expansive, compound-complex sentences with organic subordinate clauses, parenthetical nuance, and descriptive layering.';
  }

  // Risk-adaptive constraints
  const riskMandate = riskProfile?.guidelines || 'Preserve all factual claims and relationships.';

  // Build protected spans summary for prompt
  const protectedItems = [];
  if (sourceEnvelope?.protectedSpans?.length > 0) {
    const literals = sourceEnvelope.protectedSpans
      .filter((s) => s.criticality === 'literal' || s.criticality === 'high')
      .map((s) => `[${s.type.toUpperCase()}]: "${s.value}"`)
      .slice(0, 30);
    if (literals.length > 0) {
      protectedItems.push(`CRITICAL PROTECTED SPANS (MUST PRESERVE EXACTLY):\n${literals.join(', ')}`);
    }
  }

  if (sourceEnvelope?.negations?.length > 0) {
    protectedItems.push(`NEGATION CONSTRAINTS: ${sourceEnvelope.negations.length} negative statements detected. Never reverse polarity (e.g. "not supported" must NEVER become "supported").`);
  }

  if (sourceEnvelope?.modalitySignals?.length > 0) {
    protectedItems.push(`MODALITY CONSTRAINTS: Preserve exact degree of uncertainty ("may" must not become "will", "likely" must not become "certainly").`);
  }

  if (sourceEnvelope?.causalRelations?.length > 0) {
    protectedItems.push(`CAUSALITY CONSTRAINTS: Cause and effect directions must never be inverted.`);
  }

  const preservationBlock = protectedItems.length > 0
    ? `\nPRESERVATION MANDATES:\n${protectedItems.join('\n')}\n`
    : '';

  const SYSTEM_BRIEF = `You are PenShift's God-Level Humanizer and Forensic Stylometry Engine.
Your primary contract is:
INPUT → UNDERSTAND → PRESERVE MEANING → TRANSFORM EXPRESSION → VERIFY.

CONTROL HIERARCHY (NON-NEGOTIABLE):
MEANING PRESERVATION > FACTUAL FIDELITY > USER INTENT > STRUCTURAL CONSTRAINTS > STYLE > COSMETIC VARIATION.
Never sacrifice accuracy to sound more "human".

${riskMandate}

SEMANTIC OBJECTIVE:
Strictly preserve all propositions, factual claims, numbers, dates, entities, actors, objects, conditions, and causal logic.
If the source is ambiguous, preserve the ambiguity—never guess.

VOICE OBJECTIVE:
Reflect the user's selected tone (${mode.toUpperCase()} MODE) while infusing authentic human cadence and eliminating algorithmic sterility.

${rhythmObjective}

${lexicalObjective}

STRUCTURE OBJECTIVE:
Restructure clauses, sentences, and transitions organically. Never use predictable transition markers like "Additionally", "Furthermore", "Moreover", "In conclusion".

READABILITY OBJECTIVE:
Elevate clarity and elegance without dumbing down technical or nuanced arguments.

WORD COUNT GUIDELINE:
Target approximately ${minWords}–${maxWords} words (input is ${inputWords} words). Do not pad with invented filler or delete essential claims to meet a target.
${preservationBlock}
CLEAN OUTPUT MANDATE:
Output ONLY the transformed text. No conversational preamble ("Here is..."), no quotes around output, no meta-commentary.`;

  let userPreferencesBlock = '';
  if (userMemory && typeof userMemory === 'string' && userMemory.trim()) {
    const cleanMemory = userMemory
      .slice(0, 1000)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u200B-\u200F\u202A-\u202E\uFEFF]/g, '')
      .trim();
    if (cleanMemory) {
      userPreferencesBlock = `\n<user_preferences>\n${cleanMemory}\n</user_preferences>\n`;
    }
  }

  const cleanInput = (typeof inputText === 'string' ? inputText : String(inputText || ''))
    .slice(0, 50000)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  const USER_PROMPT = `Execute the humanization transformation brief strictly adhering to all preservation mandates:${userPreferencesBlock}
<input_source>
${cleanInput}
</input_source>`;

  return {
    system: SYSTEM_BRIEF,
    user: USER_PROMPT,
  };
}
