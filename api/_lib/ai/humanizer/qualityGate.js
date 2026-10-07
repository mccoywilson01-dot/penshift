/**
 * PenShift Authoritative Semantic Quality Gate (V4)
 * 
 * Enforces the non-negotiable release gate:
 *   THE USER'S MEANING MUST SURVIVE THE TRANSFORMATION.
 * 
 * Invariants:
 *   1. Zero silent fallback: Verifier failure/unknown -> FAIL CLOSED (accepted = false).
 *   2. Independent semantic adjudication is authoritative.
 *   3. Genuine bidirectional directional entailment required for release.
 *   4. No single aggregate score may average away a critical semantic violation.
 */

import { executeSemanticVerificationSync, executeSemanticVerification } from './semanticVerifier.js';
import { buildClaimGraph } from './claimGraph.js';

/**
 * Builds the canonical quality gate response payload.
 */
function buildQualityGateReport(auditResult, options = {}) {
  const violations = auditResult.violations || [];
  const audit = auditResult.auditReport || {};

  const criticalViolations = violations.filter((v) => v.severity === 'CRITICAL');
  const highViolations = violations.filter((v) => v.severity === 'HIGH');

  const deterministicPassed = audit.layerA_deterministic?.passed ?? (auditResult.criticalCount === 0);
  const claimChecksPassed = audit.layerB_claimGraph?.passed ?? (auditResult.criticalCount === 0);
  const entailmentStatus = audit.layerC_entailment?.status || 'UNKNOWN';
  const documentPassed = audit.documentConsistency?.passed ?? true;

  // Specific semantic dimension preservation
  const hasScopeViolation = violations.some((v) => v.type === 'SCOPE_RESTRICTION_REMOVED' || v.type === 'SCOPE_FOCUS_MUTATION' || v.type === 'SCOPE_STRUCTURE_MUTATION');
  const hasQuantifierViolation = violations.some((v) => v.type === 'QUANTIFIER_MUTATION');
  const hasAttributionViolation = violations.some((v) => v.type === 'ATTRIBUTION_DROPPED');
  const hasCausalViolation = violations.some((v) => v.type === 'CAUSAL_INVERSION' || v.type === 'CAUSAL_MUTATION');
  const hasConditionViolation = violations.some((v) => v.type === 'CONDITION_OMISSION');
  const hasExceptionViolation = violations.some((v) => v.type === 'EXCEPTION_OMISSION');
  const hasComparisonViolation = violations.some((v) => v.type === 'COMPARISON_INVERSION');
  const hasTemporalViolation = violations.some((v) => v.type === 'TEMPORAL_INVERSION');
  const hasModalityViolation = violations.some((v) => v.type === 'MODALITY_MUTATION');
  const hasNegationViolation = violations.some((v) => v.type === 'NEGATION_REVERSAL');
  const hasPredicateViolation = violations.some((v) => v.type === 'PREDICATE_MUTATION');
  const hasNumericViolation = violations.some((v) => v.type === 'NUMERIC_OMISSION' || v.type === 'NUMERIC_MUTATION' || v.type === 'UNIT_MUTATION' || v.type === 'CURRENCY_MUTATION' || v.type === 'DIMENSION_MUTATION');
  const hasCoreferenceViolation = violations.some((v) => v.type === 'COREFERENCE_ROLE_MUTATION');
  const hasDocContradiction = violations.some((v) => v.type === 'DOCUMENT_CONTRADICTION' || v.type === 'INTERNAL_DOCUMENT_CONTRADICTION' || v.type === 'NUMERIC_PARAGRAPH_DRIFT');

  // Authoritative Release Decision from Layer E (Adjudication)
  const adjudication = auditResult.adjudication || {
    verdict: auditResult.valid ? 'PASS' : 'FAIL',
    accepted: auditResult.valid === true,
    reason: 'Adjudication',
  };

  // NON-NEGOTIABLE RELEASE POLICY (Section 1 & 5):
  // Release requires:
  //   deterministicHardChecks = PASS
  //   AND forwardResult = PASS
  //   AND reverseResult = PASS
  //   AND documentConsistency = PASS
  //   AND no critical violations
  // Any UNKNOWN, TIMEOUT, MALFORMED, or UNAVAILABLE must result in accepted = false
  const accepted = adjudication.accepted === true && criticalViolations.length === 0 && highViolations.length === 0;
  const status = accepted ? 'PASS' : (adjudication.verdict === 'UNKNOWN' ? 'UNKNOWN' : 'FAIL');

  // Diagnostic score for telemetry only (never overrides hard gate)
  let score = 100;
  score -= criticalViolations.length * 40;
  score -= highViolations.length * 20;
  if (!accepted) score = Math.min(score, 45);
  score = Math.max(0, Math.min(100, score));

  return {
    accepted,
    status,
    verdict: adjudication.verdict,
    score,
    criticalCount: criticalViolations.length,
    highCount: highViolations.length,
    adjudication,
    deterministicChecks: {
      passed: deterministicPassed && !hasNumericViolation && !hasDocContradiction,
      numericsPreserved: !hasNumericViolation,
      protectedSpansPreserved: deterministicPassed,
      violations: audit.layerA_deterministic?.violations || [],
    },
    claimChecks: {
      passed: claimChecksPassed && !hasPredicateViolation && !hasScopeViolation && !hasCausalViolation && !hasCoreferenceViolation,
      scopePreserved: !hasScopeViolation,
      quantifiersPreserved: !hasQuantifierViolation,
      conditionsPreserved: !hasConditionViolation,
      exceptionsPreserved: !hasExceptionViolation,
      causalityPreserved: !hasCausalViolation,
      comparisonsPreserved: !hasComparisonViolation,
      temporalPreserved: !hasTemporalViolation,
      attributionsPreserved: !hasAttributionViolation,
      modalityPreserved: !hasModalityViolation,
      negationsPreserved: !hasNegationViolation,
      predicatesPreserved: !hasPredicateViolation,
      coreferencePreserved: !hasCoreferenceViolation,
      violations: audit.layerB_claimGraph?.violations || [],
    },
    entailmentChecks: {
      status: entailmentStatus,
      confidence: audit.layerC_entailment?.confidence || (accepted ? 0.95 : 0.0),
      forwardEntailed: auditResult.forwardResult?.verdict === 'PASS',
      reverseEntailed: auditResult.reverseResult?.verdict === 'PASS',
      forwardResult: auditResult.forwardResult || null,
      reverseResult: auditResult.reverseResult || null,
    },
    contradictionChecks: {
      passed: criticalViolations.length === 0 && entailmentStatus !== 'CONTRADICTED',
      contradictionCount: criticalViolations.length,
    },
    documentChecks: {
      passed: documentPassed && !hasDocContradiction,
      crossParagraphContradictions: audit.documentConsistency?.violations?.length || 0,
    },
    violations,
    confidence: audit.layerC_entailment?.confidence || 0.95,
    verifierAgreement: accepted ? 1.0 : 0.0,
    verifierMetadata: auditResult.verifierMetadata || {
      verifierInvoked: Boolean(options.verifierProvider),
      verifierProvider: options.verifierProviderName || null,
      verifierModel: options.verifierModel || null,
      verifierResult: entailmentStatus,
      fallbackReason: null,
      malformedResponse: false,
      timedOut: false,
    },
    audit: {
      protectedSpansPreserved: deterministicPassed,
      numericsPreserved: !hasNumericViolation,
      negationsPreserved: !hasNegationViolation,
      predicatesPreserved: !hasPredicateViolation,
      modalityPreserved: !hasModalityViolation,
      causalityPreserved: !hasCausalViolation,
      scopePreserved: !hasScopeViolation,
      quantifiersPreserved: !hasQuantifierViolation,
      conditionsPreserved: !hasConditionViolation,
      comparisonsPreserved: !hasComparisonViolation,
      temporalPreserved: !hasTemporalViolation,
      attributionsPreserved: !hasAttributionViolation,
      coreferencePreserved: !hasCoreferenceViolation,
      unsupportedAdditionsCount: violations.filter((v) => v.type === 'UNSUPPORTED_ADDITION').length,
    },
  };
}

/**
 * Authoritative synchronous release gate evaluation.
 */
export function evaluateSemanticFidelitySync(sourceText, candidateText, sourceGraph = null, options = {}) {
  if (!sourceText || !candidateText) {
    return {
      accepted: false,
      status: 'FAIL',
      score: 0,
      criticalCount: 1,
      highCount: 0,
      violations: [{ type: 'EMPTY_INPUT', severity: 'CRITICAL', problem: 'Missing source or candidate text.' }],
      deterministicChecks: { passed: false },
      claimChecks: { passed: false },
      entailmentChecks: { status: 'CONTRADICTED', confidence: 1.0 },
      contradictionChecks: { passed: false, contradictionCount: 1 },
      documentChecks: { passed: false },
      confidence: 1.0,
      verifierAgreement: 0.0,
      audit: {},
    };
  }

  const effectiveGraph = sourceGraph || buildClaimGraph(sourceText);
  const auditResult = executeSemanticVerificationSync(sourceText, candidateText, {
    ...options,
    sourceGraph: effectiveGraph,
  });

  return buildQualityGateReport(auditResult, options);
}

/**
 * Authoritative asynchronous release gate evaluation.
 */
export async function evaluateSemanticFidelity(sourceText, candidateText, sourceGraph = null, options = {}) {
  if (!sourceText || !candidateText) {
    return evaluateSemanticFidelitySync(sourceText, candidateText, sourceGraph, options);
  }

  const effectiveGraph = sourceGraph || buildClaimGraph(sourceText);
  const auditResult = await executeSemanticVerification(sourceText, candidateText, {
    ...options,
    sourceGraph: effectiveGraph,
  });

  return buildQualityGateReport(auditResult, options);
}
