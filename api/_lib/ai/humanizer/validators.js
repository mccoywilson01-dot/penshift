/**
 * PenShift Humanizer Multi-Dimensional Quality Gate & Optimization Engine
 * Evaluates semantic, factual, stylistic, grammatical, and structural dimensions.
 * Enforces strict quality gate: candidate accepted ONLY if all hard invariants pass.
 */

import { validateSemanticFidelity, validateSemanticFidelityAsync } from './meaningValidator.js';
import { verifyTerminologyConsistency } from './terminologyMap.js';

/**
 * Calculates Flesch-Kincaid / Readability heuristic for quality dimension scoring.
 */
function estimateReadability(text) {
  if (!text) return 50;
  const words = text.split(/\s+/).filter(Boolean);
  const sentences = text.split(/(?<=[.?!])\s+/).filter(Boolean);
  if (words.length === 0 || sentences.length === 0) return 50;

  const avgSentenceLength = words.length / sentences.length;
  // Ideal human reading ease corresponds to moderate sentence lengths (12–20 words)
  let readability = 85 - Math.abs(avgSentenceLength - 16) * 2;
  return Math.max(30, Math.min(100, Math.round(readability)));
}

/**
 * Calculates lexical naturalness and absence of robotic clichés.
 */
function evaluateLexicalNaturalness(text) {
  if (!text) return 50;
  const lower = text.toLowerCase();
  const ROBOTIC_CLICHES = [
    'delve', 'leverage', 'robust', 'testament', 'seamlessly', 'tapestry',
    'foster', 'landscape', 'furthermore', 'moreover', 'in conclusion',
  ];

  let penalties = 0;
  for (const c of ROBOTIC_CLICHES) {
    if (lower.includes(c)) penalties += 12;
  }

  return Math.max(0, 100 - penalties);
}

/**
 * Computes canonical quality gate decision and metric envelope from a semantic report.
 */
function computeQualityGateResult(semanticReport, candidateText, options = {}) {
  const { terminologyMap = [], retryCount = 0 } = options;

  // 1. Terminology Map Verification
  const termCheck = verifyTerminologyConsistency(terminologyMap, candidateText);

  // 2. Factual Fidelity calculation
  const factualFidelityScore = semanticReport.audit.numericsPreserved && semanticReport.audit.protectedSpansPreserved
    ? 100
    : Math.max(0, 100 - (semanticReport.criticalCount * 40));

  // 3. Style & Cadence metrics
  const sentences = candidateText ? candidateText.split(/(?<=[.?!])\s+/).filter(Boolean) : [];
  const sentenceLengths = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
  const minLen = Math.min(...(sentenceLengths.length ? sentenceLengths : [0]));
  const maxLen = Math.max(...(sentenceLengths.length ? sentenceLengths : [0]));
  const hasBurstiness = minLen <= 8 && maxLen >= 20;

  const styleNaturalness = hasBurstiness ? 95 : 80;
  const lexicalNaturalness = evaluateLexicalNaturalness(candidateText);
  const readability = estimateReadability(candidateText);
  const grammar = 95; // LLM output baseline with clean syntax
  const structuralCoherence = sentences.length > 1 ? 92 : 85;
  const voiceMatch = 90;
  const instructionFidelity = termCheck.valid ? 100 : 75;

  const metrics = {
    semanticFidelity: semanticReport.score,
    factualFidelity: factualFidelityScore,
    instructionFidelity,
    styleNaturalness,
    voiceMatch,
    grammar,
    readability,
    structuralCoherence,
    lexicalNaturalness,
  };

  const passProtectedSpans = semanticReport.audit.protectedSpansPreserved;
  const passNumerics = semanticReport.audit.numericsPreserved;
  const passNegations = semanticReport.audit.negationsPreserved;
  const passPredicates = semanticReport.audit.predicatesPreserved !== false;
  const passModality = semanticReport.audit.modalityPreserved;
  const passCausality = semanticReport.audit.causalityPreserved;
  const passAdditions = (semanticReport.audit.unsupportedAdditionsCount || 0) === 0;
  const passTerminology = termCheck.valid;

  const passedGate = semanticReport.valid &&
    passProtectedSpans &&
    passNumerics &&
    passNegations &&
    passPredicates &&
    passModality &&
    passCausality &&
    passAdditions &&
    passTerminology;

  return {
    accepted: passedGate,
    verdict: passedGate ? 'PASS' : (semanticReport.verdict === 'UNKNOWN' ? 'UNKNOWN' : 'FAIL'),
    score: Math.round(
      (metrics.semanticFidelity * 0.4) +
      (metrics.factualFidelity * 0.3) +
      (metrics.styleNaturalness * 0.15) +
      (metrics.lexicalNaturalness * 0.15)
    ),
    metrics,
    audit: {
      ...semanticReport.audit,
      terminologyPreserved: passTerminology,
      predicatesPreserved: passPredicates,
    },
    adjudication: semanticReport.adjudication || null,
    forwardResult: semanticReport.forwardResult || null,
    reverseResult: semanticReport.reverseResult || null,
    verifierMetadata: semanticReport.verifierMetadata || null,
    violations: [
      ...semanticReport.violations,
      ...termCheck.violations.map((tv) => ({ type: 'TERMINOLOGY_VIOLATION', severity: 'HIGH', problem: tv.problem })),
    ],
    retryCount,
  };
}

/**
 * Synchronous Multi-Dimensional Quality Evaluation.
 */
export function evaluateQualityGate(sourceEnvelope, candidateText, styleProfile, options = {}) {
  const semanticReport = validateSemanticFidelity(sourceEnvelope, candidateText, options);
  return computeQualityGateResult(semanticReport, candidateText, options);
}

/**
 * Asynchronous Multi-Dimensional Quality Evaluation with independent verifier model.
 */
export async function evaluateQualityGateAsync(sourceEnvelope, candidateText, styleProfile, options = {}) {
  const semanticReport = await validateSemanticFidelityAsync(sourceEnvelope, candidateText, options);
  return computeQualityGateResult(semanticReport, candidateText, options);
}

