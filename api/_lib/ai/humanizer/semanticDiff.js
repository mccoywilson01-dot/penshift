/**
 * PenShift Semantic Diff Engine
 * Produces structured diagnostic diff artifacts comparing source envelope vs candidate output.
 * Designed for internal observability and checkpoint forensics without leaking private user data.
 */

import crypto from 'crypto';

function hashCandidate(text) {
  if (typeof text !== 'string') return '';
  return crypto.createHash('sha256').update(text.trim().replace(/\s+/g, ' ')).digest('hex');
}

/**
 * Builds the internal semantic diff artifact.
 */
export function buildSemanticDiffArtifact(sourceEnvelope, candidateText, validationResult, retryCount = 0) {
  const sourceHash = sourceEnvelope?.sourceHash || '';
  const candidateHash = hashCandidate(candidateText);

  const preservedClaims = [];
  const addedClaims = [];
  const removedClaims = [];
  const changedClaims = [];
  const protectedSpanDiffs = [];

  const violations = validationResult?.violations || [];

  for (const v of violations) {
    if (v.type === 'UNSUPPORTED_ADDITION') {
      addedClaims.push({ problem: v.problem, span: v.rewriteSpan || '' });
    } else if (v.type === 'NUMERIC_OMISSION' || v.type === 'CRITICAL_OMISSION') {
      removedClaims.push({ expected: v.expected, problem: v.problem });
    } else if (v.type === 'NEGATION_REVERSAL' || v.type === 'MODALITY_MUTATION' || v.type === 'CAUSAL_INVERSION') {
      changedClaims.push({
        type: v.type,
        problem: v.problem,
        source: v.sourceSpan || '',
        candidate: v.rewriteSpan || '',
      });
    } else if (v.type === 'PROTECTED_SPAN_VIOLATION') {
      protectedSpanDiffs.push({
        expected: v.expected,
        problem: v.problem,
        severity: v.severity,
      });
    }
  }

  // Count preserved claims
  const totalClaims = sourceEnvelope?.factualClaims?.length || 0;
  const changedCount = changedClaims.length + removedClaims.length;
  const preservedCount = Math.max(0, totalClaims - changedCount);

  for (let i = 0; i < preservedCount; i++) {
    preservedClaims.push(`prop-${i + 1}`);
  }

  const confidence = validationResult?.score ? validationResult.score / 100 : 0;

  return {
    sourceHash,
    candidateHash,
    semanticStatus: (validationResult?.valid ?? validationResult?.accepted ?? (validationResult?.verdict === 'PASS')) ? 'PASS' : 'FAIL',
    confidence: Math.round(confidence * 100) / 100,
    retryCount,
    timestamp: Date.now(),
    summary: {
      totalClaims,
      preservedCount,
      violationsCount: violations.length,
      criticalViolations: validationResult?.criticalCount || 0,
    },
    preservedClaims,
    addedClaims,
    removedClaims,
    changedClaims,
    protectedSpanDiffs,
  };
}
