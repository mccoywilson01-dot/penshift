/**
 * PenShift Semantic Risk Classifier
 * Evaluates semantic risk profile (low, medium, high) based on numeric, legal, technical, and structural density.
 * Directs generation strategies toward conservative fidelity or stylistic latitude.
 */

const LEGAL_TERMS = [
  'indemnify', 'warranty', 'liability', 'statute', 'jurisdiction', 'arbitration',
  'confidentiality', 'disclosure', 'binding', 'breach', 'remedy', 'termination',
  'pursuant to', 'hereunder', 'in witness whereof', 'governing law',
];

const MEDICAL_TERMS = [
  'dosage', 'contraindication', 'clinical', 'symptom', 'diagnosis', 'prognosis',
  'treatment', 'efficacy', 'pathogen', 'adverse effect', 'patient', 'therapy',
  'pharmacological', 'syndrome', 'biomarker',
];

const FINANCIAL_TERMS = [
  'ebitda', 'revenue', 'amortization', 'fiscal', 'dividend', 'liquidity',
  'equity', 'collateral', 'interest rate', 'portfolio', 'quarterly earnings',
  'sec filing', 'audit report', 'balance sheet',
];

const PROCEDURAL_TERMS = [
  'step 1', 'step 2', 'first,', 'second,', 'ensure that', 'do not omit',
  'prerequisites', 'execute the command', 'following configuration',
];

/**
 * Classifies document risk and determines generation and validation tolerances.
 */
export function classifySemanticRisk(sourceEnvelope) {
  if (!sourceEnvelope) {
    return { level: 'medium', score: 50, factors: {}, guidelines: 'Standard balanced humanization' };
  }

  const text = (sourceEnvelope.normalizedText || '').toLowerCase();
  const wordCount = Math.max(1, text.split(/\s+/).filter(Boolean).length);

  // 1. Numeric Density
  const numCount = sourceEnvelope.quantitativeClaims?.length || 0;
  const numDensity = numCount / wordCount;

  // 2. Named Entity Density
  const entityCount = sourceEnvelope.entities?.length || 0;
  const entityDensity = entityCount / wordCount;

  // 3. Negation & Condition Density
  const negationCount = sourceEnvelope.negations?.length || 0;
  const conditionCount = sourceEnvelope.conditions?.length || 0;
  const logicalConstraintCount = negationCount + conditionCount;

  // 4. Domain Term Density
  let legalHits = 0;
  for (const term of LEGAL_TERMS) {
    if (text.includes(term)) legalHits++;
  }

  let medicalHits = 0;
  for (const term of MEDICAL_TERMS) {
    if (text.includes(term)) medicalHits++;
  }

  let financialHits = 0;
  for (const term of FINANCIAL_TERMS) {
    if (text.includes(term)) financialHits++;
  }

  let proceduralHits = 0;
  for (const term of PROCEDURAL_TERMS) {
    if (text.includes(term)) proceduralHits++;
  }

  const domainHits = legalHits + medicalHits + financialHits + proceduralHits;

  // 5. Code or Formulas
  const hasCode = (sourceEnvelope.protectedSpans || []).some((s) => s.type === 'code' || s.type === 'equation');

  // Compute Risk Score (0 - 100)
  let riskScore = 0;
  if (numDensity > 0.05) riskScore += 25;
  else if (numDensity > 0.02) riskScore += 15;

  if (entityDensity > 0.04) riskScore += 20;
  else if (entityDensity > 0.01) riskScore += 10;

  if (logicalConstraintCount >= 3) riskScore += 20;
  else if (logicalConstraintCount >= 1) riskScore += 10;

  if (domainHits >= 3) riskScore += 30;
  else if (domainHits >= 1) riskScore += 15;

  if (hasCode) riskScore += 20;

  riskScore = Math.min(100, riskScore);

  let level = 'low';
  let guidelines = 'Conversational mode: prioritize natural expression, cadence, and lively voice while keeping core facts intact.';

  if (riskScore >= 60 || domainHits >= 3 || (hasCode && numCount >= 3)) {
    level = 'high';
    guidelines = 'HIGH-RISK CONTENT DETECTED (Technical/Legal/Medical/Financial/Procedural): Enforce strict literal preservation of terminology, numbers, conditions, and causal logic. Zero speculative synonym substitution allowed. Rewriting must be conservative.';
  } else if (riskScore >= 25 || logicalConstraintCount >= 2 || numCount >= 2) {
    level = 'medium';
    guidelines = 'Balanced mode: Moderate cadence and lexical enhancement with strict preservation of all propositions, entities, and numbers.';
  }

  return {
    level,
    score: riskScore,
    factors: {
      numericDensity: Math.round(numDensity * 1000) / 1000,
      entityDensity: Math.round(entityDensity * 1000) / 1000,
      logicalConstraints: logicalConstraintCount,
      domainHits,
      legalHits,
      medicalHits,
      financialHits,
      proceduralHits,
      hasCode,
    },
    guidelines,
    strictness: level === 'high' ? 'conservative' : (level === 'medium' ? 'standard' : 'expressive'),
  };
}
