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
An initial transformation candidate was rejected by our strict semantic verification engine because it violated factual, numeric, or polarity invariants.

YOUR CONTRACT:
Repair and rewrite the candidate by grounding directly in the AUTHORITATIVE ORIGINAL SOURCE.
THE ORIGINAL SOURCE IS THE SOLE TRUTH. NEVER PRIORITIZE THE DRAFT OVER THE ORIGINAL SOURCE.

CRITICAL DEFECTS DETECTED IN DRAFT (MUST REPAIR ALL):
${repairList}

FACT LOCK INVARIANTS:
- Number of protected items: ${factLock.numbers?.length || 0}
- Claims count: ${factLock.claims?.length || 0}
- Negations count: ${factLock.negations?.length || 0}

STYLE MANDATE:
Keep the writing natural, engaging, and in ${mode.toUpperCase()} MODE, but NEVER at the expense of facts, negations, or numbers.

CLEAN OUTPUT:
Output ONLY the final corrected humanized text. No explanation, no prefix.`;

  const USER_REPAIR_PROMPT = `<authoritative_original_source>
${sourceEnvelope.normalizedText}
</authoritative_original_source>

<flawed_previous_draft>
${currentDraft}
</flawed_previous_draft>

Produce the corrected, semantically faithful humanized text now:`;

  return {
    system: SYSTEM_REPAIR_INSTRUCTIONS,
    user: USER_REPAIR_PROMPT,
  };
}
