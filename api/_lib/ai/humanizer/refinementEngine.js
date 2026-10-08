/**
 * PenShift Actionable Critique & Refinement Engine
 * Converts validation defects into structured critique artifacts and generates targeted repair instructions
 * grounded directly in the authoritative source envelope.
 */

import { buildFactLock } from './semanticLedger.js';

export const MAX_REFINEMENT_RETRIES = 2;

/**
 * Builds structured, actionable critique artifact from evaluation violations.
 */
export function buildActionableCritique(violations, _options = {}) {
  const critique = {
    semanticDrift: [],
    unsupportedAdditions: [],
    omissions: [],
    factChanges: [],
    numericChanges: [],
    entityChanges: [],
    negationChanges: [],
    modalityChanges: [],
    styleIssues: [],
    grammarIssues: [],
    rhythmIssues: [],
    hasCriticalDefects: false,
    repairInstructions: [],
  };

  if (!Array.isArray(violations) || violations.length === 0) {
    return critique;
  }

  for (const v of violations) {
    const item = {
      sourceSpan: v.sourceSpan || v.expected || '',
      rewriteSpan: v.rewriteSpan || v.found || '',
      problem: v.problem || 'Semantic drift detected.',
      severity: v.severity || 'HIGH',
      repairInstruction: v.repairInstruction || `Strictly restore: '${v.expected || v.sourceSpan}'.`,
    };

    if (v.severity === 'CRITICAL') {
      critique.hasCriticalDefects = true;
    }

    critique.repairInstructions.push(item.repairInstruction);

    switch (v.type) {
      case 'UNSUPPORTED_ADDITION':
        critique.unsupportedAdditions.push(item);
        break;
      case 'NUMERIC_OMISSION':
      case 'NUMERIC_MUTATION':
      case 'NUMERIC_PARAGRAPH_DRIFT':
        critique.numericChanges.push(item);
        break;
      case 'TEMPORAL_MUTATION':
      case 'TEMPORAL_INVERSION':
      case 'CRITICAL_OMISSION':
      case 'CONDITION_OMISSION':
      case 'EXCEPTION_OMISSION':
        critique.omissions.push(item);
        break;
      case 'NEGATION_REVERSAL':
      case 'UNAUTHORIZED_NEGATION':
        critique.negationChanges.push(item);
        break;
      case 'MODALITY_MUTATION':
        critique.modalityChanges.push(item);
        break;
      case 'PROTECTED_SPAN_VIOLATION':
      case 'TERMINOLOGY_VIOLATION':
        critique.factChanges.push(item);
        break;
      case 'CAUSAL_INVERSION':
      case 'COMPARISON_INVERSION':
      case 'SCOPE_RESTRICTION_REMOVED':
      case 'QUANTIFIER_MUTATION':
      case 'ATTRIBUTION_DROPPED':
      case 'RELATION_INVERSION':
      case 'DOCUMENT_CONTRADICTION':
      case 'ADJUDICATED_SEMANTIC_CHANGE':
      case 'MODEL_CONTRADICTION':
        critique.semanticDrift.push(item);
        break;
      default:
        critique.semanticDrift.push(item);
        break;
    }
  }

  return critique;
}

/**
 * Builds a prompt for the REFINE stage that supplies:
 * ORIGINAL SOURCE + SEMANTIC LEDGER + PROTECTED SPANS + CURRENT DRAFT + CRITIQUE + USER STYLE CONTROLS.
 * Re-anchors regeneration to the original immutable source.
 */
export function buildRefinementPrompt(sourceEnvelope, currentDraft, critique, options = {}) {
  const factLock = buildFactLock(sourceEnvelope) || {};
  const mode = options.mode || 'standard';

  const repairList = critique.repairInstructions.length > 0
    ? critique.repairInstructions.map((r, i) => `${i + 1}. ${r}`).join('\n')
    : 'Maintain complete factual equivalence.';

  const SYSTEM_REPAIR_INSTRUCTIONS = `You are PenShift's Elite Semantic Refinement Specialist.
An initial transformation candidate needed fine-tuning to perfectly match factual, numeric, and semantic invariants while retaining a rich, human voice.

YOUR CONTRACT:
1. Repair and rewrite the text grounded in the facts of the AUTHORITATIVE ORIGINAL SOURCE.
2. MANDATE: You MUST rewrite into natural, fluent human prose with authentic sentence cadence. DO NOT simply output or copy the raw original source text verbatim.
3. Fix the detected defects while keeping the human style, natural rhythm, and active sentence flow.

CRITICAL DEFECTS DETECTED IN PREVIOUS ATTEMPT:
${repairList}

FACT LOCK INVARIANTS:
- Number of protected items: ${factLock.numbers?.length || 0}
- Claims count: ${factLock.claims?.length || 0}
- Negations count: ${factLock.negations?.length || 0}

STYLE MANDATE:
Write in natural, engaging human cadence (${mode.toUpperCase()} MODE). Never sacrifice factual fidelity, but never output an unhumanized verbatim copy of the source.

CLEAN OUTPUT:
Output ONLY the refined humanized text. No conversational preamble, no quotes, no commentary.`;

  const USER_REPAIR_PROMPT = `<authoritative_source_facts>
${sourceEnvelope.normalizedText}
</authoritative_source_facts>

<previous_draft>
${currentDraft}
</previous_draft>

Produce the improved humanized text now (do not output the original source verbatim):`;

  return {
    system: SYSTEM_REPAIR_INSTRUCTIONS,
    user: USER_REPAIR_PROMPT,
  };
}
