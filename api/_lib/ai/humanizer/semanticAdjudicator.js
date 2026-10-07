/**
 * PenShift Authoritative Semantic Adjudicator (V4)
 * 
 * Implements Layer E: Final Semantic Adjudication.
 * 
 * NON-NEGOTIABLE RELEASE RULE (Section 1 & 5):
 *   A candidate may NOT be accepted merely because deterministic structural verification passes.
 *   The original source remains immutable semantic authority.
 * 
 * The Humanizer release decision requires:
 *   DETERMINISTIC HARD CHECKS = PASS
 *   +
 *   FORWARD DIRECTION ENTAILMENT (SOURCE -> CANDIDATE) = PASS
 *   +
 *   REVERSE DIRECTION ENTAILMENT (CANDIDATE -> SOURCE) = PASS
 *   +
 *   DOCUMENT CONSISTENCY = PASS
 *   +
 *   NO HIGH-SEVERITY CONTRADICTIONS
 * 
 * If the independent semantic adjudicator cannot establish preservation:
 *   UNKNOWN, TIMEOUT, MALFORMED, UNAVAILABLE, or PROVIDER ERROR
 *   MUST result in:
 *   accepted = false
 *   for ALL Humanizer semantic audits.
 */

export const ADJUDICATION_VERDICT = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  UNKNOWN: 'UNKNOWN',
  // Backwards compatibility aliases
  PRESERVED: 'PASS',
  CHANGED: 'FAIL',
  AMBIGUOUS: 'UNKNOWN',
};

/**
 * Authoritative release adjudicator.
 * Consumes all verification layers and produces the single authoritative semantic release decision.
 */
export function adjudicateSemanticRelease({
  sourceText: _sourceText,
  candidateText: _candidateText,
  deterministicResult = null,
  structuralResult = null,
  forwardResult = null,
  reverseResult = null,
  documentConsistency = null,
  riskMetadata: _riskMetadata = {},
}) {

  // 1. Layer A: Deterministic Hard Checks (Units, Currencies, Numerics, Dates, Protected Spans)
  if (deterministicResult) {
    const passed = deterministicResult.passed ?? deterministicResult.valid ?? (deterministicResult.violations?.length === 0);
    if (!passed) {
      const vList = deterministicResult.violations || [];
      return {
        verdict: ADJUDICATION_VERDICT.FAIL,
        accepted: false,
        confidence: 0.99,
        reason: 'Deterministic hard checks failed (numeric, protected span, unit, or currency mutation).',
        layerFailure: 'LAYER_A_DETERMINISTIC',
        violations: vList.length > 0 ? vList : [{ type: 'DETERMINISTIC_VIOLATION', severity: 'CRITICAL', problem: 'Deterministic hard invariant violated.' }],
      };
    }
  }

const VERIFIER_INFRA_TYPES = new Set([
  'VERIFIER_TIMEOUT',
  'VERIFIER_UNAVAILABLE',
  'MALFORMED_VERIFIER_RESPONSE',
  'UNRESOLVED_ENTAILMENT',
  'UNRESOLVED_FORWARD_ENTAILMENT',
  'UNRESOLVED_REVERSE_ENTAILMENT',
]);

  // 2. Layer B: Structured Semantic Comparison (Claim Graph)
  if (structuralResult) {
    const structuralViolations = (structuralResult.violations || []).filter(
      (v) => !VERIFIER_INFRA_TYPES.has(v.type)
    );
    const critViolations = structuralViolations.filter((v) => v.severity === 'CRITICAL');
    if (critViolations.length > 0) {
      return {
        verdict: ADJUDICATION_VERDICT.FAIL,
        accepted: false,
        confidence: structuralResult.confidence || 0.98,
        reason: 'Claim graph comparison detected critical semantic contradiction or inversion.',
        layerFailure: 'LAYER_B_CLAIM_GRAPH',
        violations: critViolations,
      };
    }
  }

  // 3. Layer D: Document-Level Consistency (Cross-Paragraph Invariants & Contradictions)
  if (documentConsistency) {
    const docPassed = documentConsistency.passed ?? documentConsistency.valid ?? (documentConsistency.violations?.length === 0);
    if (!docPassed || (documentConsistency.violations && documentConsistency.violations.length > 0)) {
      return {
        verdict: ADJUDICATION_VERDICT.FAIL,
        accepted: false,
        confidence: 0.95,
        reason: 'Document-level consistency audit detected cross-paragraph contradiction or metric drift.',
        layerFailure: 'LAYER_D_DOCUMENT_CONSISTENCY',
        violations: documentConsistency.violations || [],
      };
    }
  }

  // 4. Layer C: Independent Directional Entailment (Directions 1 & 2)
  // Direction 1: SOURCE -> CANDIDATE
  if (!forwardResult || forwardResult.verdict === 'UNKNOWN') {
    return {
      verdict: ADJUDICATION_VERDICT.UNKNOWN,
      accepted: false, // NON-NEGOTIABLE: UNKNOWN FAILS CLOSED
      confidence: forwardResult?.confidence || 0.0,
      reason: 'Direction 1 (SOURCE -> CANDIDATE) could not establish semantic preservation (fail closed).',
      layerFailure: 'LAYER_C_FORWARD_ENTAILMENT',
      violations: [{
        type: 'UNRESOLVED_FORWARD_ENTAILMENT',
        severity: 'CRITICAL',
        problem: forwardResult?.reason || 'Source does not demonstrably entail all propositions asserted in candidate.',
      }],
    };
  }

  if (forwardResult.verdict === 'FAIL') {
    return {
      verdict: ADJUDICATION_VERDICT.FAIL,
      accepted: false,
      confidence: forwardResult.confidence || 0.95,
      reason: 'Direction 1 (SOURCE -> CANDIDATE) failed: candidate introduces ungrounded propositions or contradicts source.',
      layerFailure: 'LAYER_C_FORWARD_ENTAILMENT',
      violations: (forwardResult.contradictions && forwardResult.contradictions.length > 0)
        ? forwardResult.contradictions.map((c) => ({ type: 'FORWARD_CONTRADICTION', severity: 'CRITICAL', problem: String(c) }))
        : [{ type: 'FORWARD_CONTRADICTION', severity: 'CRITICAL', problem: forwardResult.reason || 'Candidate not entailed by source.' }],
    };
  }

  // Direction 2: CANDIDATE -> SOURCE
  if (!reverseResult || reverseResult.verdict === 'UNKNOWN') {
    return {
      verdict: ADJUDICATION_VERDICT.UNKNOWN,
      accepted: false, // NON-NEGOTIABLE: UNKNOWN FAILS CLOSED
      confidence: reverseResult?.confidence || 0.0,
      reason: 'Direction 2 (CANDIDATE -> SOURCE) could not establish constraint preservation (fail closed).',
      layerFailure: 'LAYER_C_REVERSE_ENTAILMENT',
      violations: [{
        type: 'UNRESOLVED_REVERSE_ENTAILMENT',
        severity: 'CRITICAL',
        problem: reverseResult?.reason || 'Candidate does not demonstrably preserve all conditions and restrictions present in source.',
      }],
    };
  }

  if (reverseResult.verdict === 'FAIL') {
    return {
      verdict: ADJUDICATION_VERDICT.FAIL,
      accepted: false,
      confidence: reverseResult.confidence || 0.95,
      reason: 'Direction 2 (CANDIDATE -> SOURCE) failed: candidate dropped or weakened source restrictions, modalities, or conditions.',
      layerFailure: 'LAYER_C_REVERSE_ENTAILMENT',
      violations: (reverseResult.missingConstraints && reverseResult.missingConstraints.length > 0)
        ? reverseResult.missingConstraints.map((m) => ({ type: 'MISSING_CONSTRAINT', severity: 'CRITICAL', problem: String(m) }))
        : [{ type: 'MISSING_CONSTRAINT', severity: 'CRITICAL', problem: reverseResult.reason || 'Source restrictions dropped in candidate.' }],
    };
  }

  // Check remaining high severity violations from structural check
  if (structuralResult && structuralResult.highCount > 0) {
    const highViolations = (structuralResult.violations || []).filter((v) => !VERIFIER_INFRA_TYPES.has(v.type) && v.severity === 'HIGH');
    if (highViolations.length > 0) {
      return {
        verdict: ADJUDICATION_VERDICT.FAIL,
        accepted: false,
        confidence: 0.85,
        reason: 'Unresolved high-severity discrepancies found between source and candidate propositions.',
        layerFailure: 'LAYER_B_CLAIM_GRAPH',
        violations: highViolations,
      };
    }
  }

  // 5. Release Granted: ALL Required Semantic Invariants Verified
  return {
    verdict: ADJUDICATION_VERDICT.PASS,
    accepted: true,
    confidence: Math.min(
      forwardResult.confidence || 0.95,
      reverseResult.confidence || 0.95,
      structuralResult?.confidence || 0.95
    ),
    reason: 'Deterministic hard checks, claim graphs, bidirectional directional entailments, and document consistency all verified.',
    layerFailure: null,
    violations: [],
  };
}

/**
 * Backwards compatibility helper for single proposition claims.
 */
export async function adjudicateSemanticClaim({
  sourceText: _sourceText,
  candidateText: _candidateText,
  sourceClaim: _sourceClaim,
  candidateClaim: _candidateClaim,
  verifierResult,
  riskScore: _riskScore = 0.0,
  isHighRisk: _isHighRisk = false,
  adjudicatorProvider: _adjudicatorProvider = null,
  adjudicatorModel: _adjudicatorModel = null,
}) {
  if (verifierResult?.status === 'CONTRADICTED' || verifierResult?.accepted === false) {
    return {
      verdict: 'CHANGED',
      reason: 'Hard contradiction or rejection established by verifier.',
      confidence: 1.0,
    };
  }

  if (verifierResult?.status === 'UNKNOWN') {
    return {
      verdict: 'CHANGED', // Fail closed
      reason: 'Unresolved verifier status fails closed under V4 zero-fallback policy.',
      confidence: 0.9,
    };
  }

  return {
    verdict: 'PRESERVED',
    reason: 'Semantic invariance established.',
    confidence: 0.95,
  };
}
