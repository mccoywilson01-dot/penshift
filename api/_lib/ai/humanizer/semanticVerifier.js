/**
 * PenShift Multi-Layer Semantic Verifier (V4)
 * 
 * Implements the 5-Layer verification architecture:
 *   - Layer A: Deterministic Invariants (Protected Spans, Units, Currencies, Normalized Numbers, Dates, Code, URLs)
 *   - Layer B: Structured Semantic Comparison (ClaimGraph: Scope Focus, Anaphora, Causality, Comparisons, Temporal, Conditions)
 *   - Layer C: Independent Directional Semantic Verification (Direction 1: SOURCE -> CANDIDATE, Direction 2: CANDIDATE -> SOURCE)
 *   - Layer D: Document-Level Consistency (18 Asymmetric Relation Families & Cross-Paragraph Invariants)
 *   - Layer E: Authoritative Final Semantic Adjudication (adjudicateSemanticRelease)
 * 
 * Invariant: Zero silent fallback. Structural pass alone never implies semantic pass.
 */

import { verifyProtectedSpans, extractCandidateNumbers } from './protectedSpans.js';
import { buildClaimGraph, compareClaimGraphs } from './claimGraph.js';
import {
  verifyBidirectionalEntailment,
  evaluateStructuralEntailment,
} from './semanticEntailment.js';
import { adjudicateSemanticRelease } from './semanticAdjudicator.js';
import { verifyDocumentConsistency } from './documentConsistency.js';
import { checkUnsupportedAdditions, checkNumericFidelity } from './meaningValidator.js';

/**
 * Synchronous execution of multi-layer semantic audit.
 */
export function executeSemanticVerificationSync(sourceText, candidateText, options = {}) {
  const {
    protectedSpans = [],
    riskScore = 0.0,
    isHighRisk = riskScore > 0.6,
    allowStructuralOnlyTesting = false,
  } = options;

  const violations = [];
  const auditReport = {
    layerA_deterministic: { passed: false, violations: [] },
    layerB_claimGraph: { passed: false, violations: [] },
    layerC_entailment: { status: 'UNKNOWN', confidence: 0.0, violations: [] },
    documentConsistency: { passed: false, violations: [] },
  };

  // ══════════════════════════════════════════════════════════════════
  // LAYER A: DETERMINISTIC SAFEGUARDS
  // ══════════════════════════════════════════════════════════════════
  const spanResult = verifyProtectedSpans(protectedSpans, candidateText);
  if (!spanResult.valid) {
    for (const v of spanResult.violations) {
      violations.push({
        type: 'PROTECTED_SPAN_VIOLATION',
        severity: v.criticality === 'literal' ? 'CRITICAL' : 'HIGH',
        expected: v.expected,
        problem: v.problem,
      });
      auditReport.layerA_deterministic.violations.push(v);
    }
  }

  // Check numeric, unit, currency, and date fidelity with normalized representations
  const numViolations = checkNumericFidelity({
    normalizedText: sourceText,
    temporalClaims: protectedSpans.filter((s) => s.type === 'date' || s.type === 'time'),
  }, candidateText);

  // Filter out false positives where candidate word numbers match normalized source numbers
  const candidateNums = extractCandidateNumbers(candidateText);
  const realNumViolations = numViolations.filter((nv) => {
    if (nv.type === 'NUMERIC_OMISSION' && nv.expected && candidateNums.has(nv.expected)) {
      return false;
    }
    return true;
  });

  if (realNumViolations.length > 0) {
    violations.push(...realNumViolations);
    auditReport.layerA_deterministic.violations.push(...realNumViolations);
  }
  auditReport.layerA_deterministic.passed = spanResult.valid && realNumViolations.length === 0;

  // ══════════════════════════════════════════════════════════════════
  // LAYER B: STRUCTURED SEMANTIC COMPARISON (CLAIM GRAPH)
  // ══════════════════════════════════════════════════════════════════
  const sourceGraph = options.sourceGraph || buildClaimGraph(sourceText);
  const candidateGraph = buildClaimGraph(candidateText);

  const claimComparison = compareClaimGraphs(sourceGraph, candidateGraph, { riskScore, isHighRisk });
  if (!claimComparison.valid) {
    violations.push(...claimComparison.violations);
    auditReport.layerB_claimGraph.violations.push(...claimComparison.violations);
  }

  // Hallucination / Unsupported Additions Check
  const additionViolations = checkUnsupportedAdditions({ normalizedText: sourceText }, candidateText);
  if (additionViolations.length > 0) {
    violations.push(...additionViolations);
    auditReport.layerB_claimGraph.violations.push(...additionViolations);
  }
  auditReport.layerB_claimGraph.passed = claimComparison.valid && additionViolations.length === 0;

  // ══════════════════════════════════════════════════════════════════
  // LAYER C: STRUCTURAL ENTAILMENT
  // ══════════════════════════════════════════════════════════════════
  const structuralEntailmentResult = evaluateStructuralEntailment(sourceGraph, candidateGraph, { riskScore, isHighRisk });
  auditReport.layerC_entailment = {
    status: structuralEntailmentResult.status,
    confidence: structuralEntailmentResult.confidence,
    violations: structuralEntailmentResult.violations || [],
  };

  // ══════════════════════════════════════════════════════════════════
  // LAYER D: DOCUMENT-LEVEL CONSISTENCY
  // ══════════════════════════════════════════════════════════════════
  const docResult = verifyDocumentConsistency(sourceText, candidateText, { riskScore });
  if (!docResult.valid) {
    violations.push(...docResult.violations);
    auditReport.documentConsistency.violations.push(...docResult.violations);
  }
  auditReport.documentConsistency.passed = docResult.valid;
  auditReport.documentConsistency.valid = docResult.valid;

  // Deduplicate violations by type and problem
  const seen = new Set();
  const uniqueViolations = [];
  for (const v of violations) {
    const key = `${v.type}:${v.problem}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueViolations.push(v);
    }
  }

  const criticalCount = uniqueViolations.filter((v) => v.severity === 'CRITICAL').length;
  const highCount = uniqueViolations.filter((v) => v.severity === 'HIGH').length;

  // ══════════════════════════════════════════════════════════════════
  // LAYER E: FINAL SEMANTIC ADJUDICATION
  // ══════════════════════════════════════════════════════════════════
  let forwardResult;
  let reverseResult;

  if (allowStructuralOnlyTesting) {
    const passed = criticalCount === 0 && highCount === 0 && docResult.valid && auditReport.layerA_deterministic.passed;
    forwardResult = { direction: 'SOURCE_TO_CANDIDATE', verdict: passed ? 'PASS' : 'FAIL', confidence: 0.95 };
    reverseResult = { direction: 'CANDIDATE_TO_SOURCE', verdict: passed ? 'PASS' : 'FAIL', confidence: 0.95 };
  } else {
    // In sync mode without an LLM verifier, Directional verification is UNKNOWN
    forwardResult = { direction: 'SOURCE_TO_CANDIDATE', verdict: 'UNKNOWN', confidence: 0.0, reason: 'Sync audit has no independent verifier executed.' };
    reverseResult = { direction: 'CANDIDATE_TO_SOURCE', verdict: 'UNKNOWN', confidence: 0.0, reason: 'Sync audit has no independent verifier executed.' };
  }

  const adjudication = adjudicateSemanticRelease({
    sourceText,
    candidateText,
    deterministicResult: auditReport.layerA_deterministic,
    structuralResult: { criticalCount, highCount, violations: uniqueViolations, confidence: structuralEntailmentResult.confidence },
    forwardResult,
    reverseResult,
    documentConsistency: docResult,
    riskMetadata: { riskScore, isHighRisk },
  });

  return {
    valid: adjudication.accepted,
    verdict: adjudication.verdict,
    adjudication,
    criticalCount,
    highCount,
    violations: uniqueViolations,
    auditReport,
    sourceGraph,
    candidateGraph,
    forwardResult,
    reverseResult,
  };
}

/**
 * Asynchronous multi-layer semantic audit with independent verifier model.
 * Adheres strictly to Zero Fallback Release Policy:
 *   verifier failure/timeout/malformed/unknown -> FAIL CLOSED (accepted = false).
 */
export async function executeSemanticVerification(sourceText, candidateText, options = {}) {
  // First run synchronous structural audit
  const syncResult = executeSemanticVerificationSync(sourceText, candidateText, options);

  const {
    riskScore = 0.0,
    isHighRisk = riskScore > 0.6,
    verifierProvider = null,
    verifierProviderName = null,
    verifierModel = null,
    timeoutMs = 12000,
    allowStructuralOnlyTesting = false,
  } = options;

  // Run independent model-based entailment
  const entailmentResult = await verifyBidirectionalEntailment(
    sourceText,
    candidateText,
    syncResult.sourceGraph,
    syncResult.candidateGraph,
    {
      verifierProvider,
      verifierProviderName,
      verifierModel,
      riskScore,
      isHighRisk,
      timeoutMs,
      allowStructuralOnlyTesting,
    }
  );

  syncResult.verifierMetadata = entailmentResult.metadata || {
    verifierInvoked: Boolean(verifierProvider),
    verifierProvider: verifierProviderName,
    verifierModel,
    verifierResult: entailmentResult.status,
    fallbackReason: null,
    malformedResponse: false,
    timedOut: false,
  };

  syncResult.forwardResult = entailmentResult.forwardResult;
  syncResult.reverseResult = entailmentResult.reverseResult;

  syncResult.auditReport.layerC_entailment = {
    status: entailmentResult.status,
    confidence: entailmentResult.confidence,
    violations: entailmentResult.violations || [],
    metadata: syncResult.verifierMetadata,
    forwardResult: entailmentResult.forwardResult,
    reverseResult: entailmentResult.reverseResult,
  };

  // Add any violations flagged by the independent model verifier
  for (const v of entailmentResult.violations || []) {
    if (!syncResult.violations.some((ev) => ev.type === v.type && ev.problem === v.problem)) {
      syncResult.violations.push(v);
      if (v.severity === 'CRITICAL') syncResult.criticalCount++;
      else syncResult.highCount++;
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // LAYER E: AUTHORITATIVE FINAL ADJUDICATION
  // ══════════════════════════════════════════════════════════════════
  const adjudication = adjudicateSemanticRelease({
    sourceText,
    candidateText,
    deterministicResult: syncResult.auditReport.layerA_deterministic,
    structuralResult: {
      criticalCount: syncResult.criticalCount,
      highCount: syncResult.highCount,
      violations: syncResult.violations,
      confidence: entailmentResult.confidence,
    },
    forwardResult: entailmentResult.forwardResult,
    reverseResult: entailmentResult.reverseResult,
    documentConsistency: syncResult.auditReport.documentConsistency,
    riskMetadata: { riskScore, isHighRisk },
  });

  syncResult.adjudication = adjudication;
  syncResult.valid = adjudication.accepted;
  syncResult.verdict = adjudication.verdict;

  if (!adjudication.accepted && adjudication.violations?.length > 0) {
    for (const v of adjudication.violations) {
      if (!syncResult.violations.some((ev) => ev.type === v.type && ev.problem === v.problem)) {
        syncResult.violations.push(v);
        if (v.severity === 'CRITICAL') syncResult.criticalCount++;
        else syncResult.highCount++;
      }
    }
  }

  return syncResult;
}
