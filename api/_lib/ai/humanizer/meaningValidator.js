/**
 * PenShift Meaning Validator Engine
 * Conducts proposition-level, bidirectional, and document-level semantic audits.
 * Enforces hard rejection rules: model proposes, validator decides.
 */

import { normalizeNumber, extractMeasurements } from './protectedSpans.js';
import { evaluateSemanticFidelitySync, evaluateSemanticFidelity } from './qualityGate.js';

/**
 * Extracts all numeric values from text into a normalized set.
 */
function extractNormalizedNumbers(text) {
  if (!text) return new Set();
  const nums = new Set();

  // Digits with decimals, percentages, and currencies (including multipliers like 10 billion)
  const matches = text.match(/\b\d+(?:,\d{3})*(?:\.\d+)?(?:\s*(?:%|percent|percentage|billion|million|thousand|hundred|trillion)\b|%)?|\b[$€£¥₹]\s*\d+(?:,\d{3})*(?:\.\d+)?(?:\s*(?:billion|million|thousand|hundred|trillion)\b)?/gi) || [];
  for (const m of matches) {
    const norm = normalizeNumber(m);
    if (norm) {
      nums.add(norm);
      const pure = norm.replace(/^[$€£¥₹]/, '');
      if (pure) nums.add(pure);
    }
  }

  // Mask out already matched digit sequences in a copy of text before searching for written word numbers
  // This prevents order-of-magnitude suffixes (like 'billion' in '$10 billion') from being matched standalone
  let textWithoutDigits = text;
  for (const m of matches) {
    textWithoutDigits = textWithoutDigits.replace(m, ' '.repeat(m.length));
  }

  const wordUnits = [
    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
    'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
    'hundred', 'thousand', 'million', 'billion', 'trillion'
  ];

  // Word percentages (e.g. "ten percent", "twenty five percent")
  const wordPctRegex = new RegExp(`\\b(?:${wordUnits.join('|')})(?:[\\s-]+(?:${wordUnits.join('|')}))*\\s*(?:%|percent|percentage)\\b`, 'gi');
  let wpMatch;
  while ((wpMatch = wordPctRegex.exec(textWithoutDigits)) !== null) {
    const norm = normalizeNumber(wpMatch[0]);
    if (norm) {
      nums.add(norm);
      const pure = norm.replace(/^[$€£¥₹]/, '');
      if (pure) nums.add(pure);
    }
  }
  textWithoutDigits = textWithoutDigits.replace(wordPctRegex, (match) => ' '.repeat(match.length));

  // Compound written number words (e.g. "three hundred", "one thousand two hundred", "twenty-five", "five million", "ten billion")
  const compoundRegex = new RegExp(`\\b(?:${wordUnits.join('|')})(?:[\\s-]+(?:${wordUnits.join('|')}))*\\b`, 'gi');
  let stMatch;
  while ((stMatch = compoundRegex.exec(textWithoutDigits)) !== null) {
    const norm = normalizeNumber(stMatch[0]);
    if (norm) {
      nums.add(norm);
      const pure = norm.replace(/^[$€£¥₹]/, '');
      if (pure) nums.add(pure);
    }
  }

  return nums;
}


/**
 * Detects polarity reversal (e.g. source is negative but candidate is positive, or vice versa).
 */
export function checkNegationPreservation(sourceEnvelope, candidateText) {
  const violations = [];
  const candidateLower = (candidateText || '').toLowerCase();

  const sourceNegations = sourceEnvelope.negations || [];

  for (const neg of sourceNegations) {
    const scopeWords = neg.scope
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !['not', 'never', 'cannot', 'none'].includes(w));

    // If key words from the negated clause appear in candidate without any negative token nearby
    const matchCount = scopeWords.filter((w) => candidateLower.includes(w)).length;
    if (matchCount >= 2) {
      // Find where in candidate these words appear
      let foundNegationNearby = false;

      // Comparative bound preservation check:
      // "no less than" / "no fewer than" / "not less than" <-> "at least"
      // "no more than" / "not more than" <-> "at most"
      const srcHasLowerBound = /\b(?:no|not)\s+(?:less|fewer)\s+than\b/i.test(neg.sentence || neg.scope);
      const srcHasUpperBound = /\b(?:no|not)\s+more\s+than\b/i.test(neg.sentence || neg.scope);
      const candHasLowerBound = /\bat least\b/i.test(candidateLower);
      const candHasUpperBound = /\bat most\b/i.test(candidateLower);

      if ((srcHasLowerBound && candHasLowerBound) || (srcHasUpperBound && candHasUpperBound)) {
        foundNegationNearby = true;
      }

      if (!foundNegationNearby) {
        const candidateSentences = candidateText.split(/(?<=[.?!])\s+/);
        for (const cs of candidateSentences) {
          const csLower = cs.toLowerCase();
          const hasScopeWords = scopeWords.filter((w) => csLower.includes(w)).length >= 2;
          if (hasScopeWords) {
            const hasNegToken = /\b(not|never|no|cannot|can't|won't|neither|without|fails|prohibited|unable|doesn't|don't|isn't|aren't)\b/i.test(csLower);
            if (hasNegToken) {
              foundNegationNearby = true;
              break;
            }
          }
        }
      }

      if (!foundNegationNearby) {
        violations.push({
          type: 'NEGATION_REVERSAL',
          severity: 'CRITICAL',
          sourceSpan: neg.sentence,
          rewriteSpan: candidateText.slice(0, 120),
          problem: `Source negation '${neg.token}' was lost or reversed in candidate rewrite.`,
          repairInstruction: `Re-apply negation to ensure claim remains negative: '${neg.sentence}'.`,
        });
      }
    }
  }

  // Also check if candidate introduced an unauthorized negation where source was strictly positive
  if (sourceNegations.length === 0) {
    const candNegations = candidateText.match(/\b(cannot|never|not|no|prohibited|forbidden)\b/gi) || [];
    // If source had 0 negations and candidate has strong prohibitions, flag for review
    if (candNegations.length >= 2) {
      violations.push({
        type: 'UNAUTHORIZED_NEGATION',
        severity: 'HIGH',
        sourceSpan: sourceEnvelope.normalizedText?.slice(0, 100),
        rewriteSpan: candNegations.join(', '),
        problem: `Candidate introduced negative/prohibitive assertions (${candNegations.join(', ')}) not grounded in source.`,
        repairInstruction: `Remove unauthorized negation and restore positive assertion.`,
      });
    }
  }

  return violations;
}

/**
 * Checks modality preservation: ensures certainty wasn't artificially strengthened or weakened.
 */
export function checkModalityPreservation(sourceEnvelope, candidateText) {
  const violations = [];
  const candidateLower = (candidateText || '').toLowerCase();

  const signals = sourceEnvelope.modalitySignals || [];
  for (const sig of signals) {
    const term = sig.term.toLowerCase();
    const classification = sig.classification;

    // Check: "may" / "might" / "could" transformed into "will" / "definitely" / "certainly"
    if (classification === 'possibility') {
      const strengthened = /\b(will|definitely|certainly|guaranteed|always)\b/i.test(candidateLower);
      const stillHasPossibility = /\b(may|might|could|possibly|potential|can)\b/i.test(candidateLower);

      if (strengthened && !stillHasPossibility) {
        violations.push({
          type: 'MODALITY_MUTATION',
          severity: 'CRITICAL',
          sourceSpan: term,
          problem: `Uncertainty in source ('${term}') was improperly strengthened into certainty ('will/definitely').`,
          repairInstruction: `Restore possibility modality: use 'may', 'could', or 'might' instead of definitive guarantees.`,
        });
      }
    }

    // Check: "must" transformed into "may" or "optional"
    if (classification === 'obligation_strict') {
      const weakened = /\b(may|optional|if you want|might)\b/i.test(candidateLower);
      const stillHasObligation = /\b(must|required|mandatory|have to|essential|need to)\b/i.test(candidateLower);

      if (weakened && !stillHasObligation) {
        violations.push({
          type: 'MODALITY_MUTATION',
          severity: 'CRITICAL',
          sourceSpan: term,
          problem: `Strict obligation in source ('${term}') was weakened into optional or permissive language.`,
          repairInstruction: `Restore required obligation: use 'must' or 'is required'.`,
        });
      }
    }
  }

  return violations;
}

/**
 * Checks numeric and temporal fidelity.
 */
export function checkNumericFidelity(sourceEnvelope, candidateText) {
  const violations = [];
  const sourceNums = extractNormalizedNumbers(sourceEnvelope.normalizedText);
  const candNums = extractNormalizedNumbers(candidateText);

  // 1. Missing numbers from source
  for (const sNum of sourceNums) {
    const sPure = sNum.replace(/^[$€£¥₹]/, '');
    const foundInCand = candNums.has(sNum) || candNums.has(sPure);
    if (!foundInCand) {
      violations.push({
        type: 'NUMERIC_OMISSION',
        severity: 'CRITICAL',
        expected: sNum,
        problem: `Source number '${sNum}' was omitted or changed in rewrite.`,
        repairInstruction: `Restore numeric value '${sNum}'.`,
      });
    }
  }

  // 2. Extraneous numbers in candidate (unsupported addition)
  for (const cNum of candNums) {
    const cPure = cNum.replace(/^[$€£¥₹]/, '');
    const foundInSource = sourceNums.has(cNum) || sourceNums.has(cPure);
    if (!foundInSource) {
      violations.push({
        type: 'NUMERIC_MUTATION',
        severity: 'CRITICAL',
        found: cNum,
        problem: `Candidate introduced an unsupported numeric value '${cNum}' not present in source.`,
        repairInstruction: `Remove extraneous number '${cNum}' and match source numbers.`,
      });
    }
  }

  // 3. Measurement Unit, Currency & Dimension Integrity
  const sourceMeasurements = extractMeasurements(sourceEnvelope.normalizedText);
  const candMeasurements = extractMeasurements(candidateText);

  // Check if candidate introduced any conflicting currency representation
  for (const cm of candMeasurements) {
    if (cm.hasConflict) {
      const srcHasExactConflict = sourceMeasurements.some((sm) => sm.normalizedValue === cm.normalizedValue && sm.hasConflict && sm.normalizedUnit === cm.normalizedUnit);
      if (!srcHasExactConflict) {
        violations.push({
          type: 'CURRENCY_REPRESENTATION_CONFLICT',
          severity: 'CRITICAL',
          found: `${cm.value} (${cm.unit})`,
          problem: `Candidate contains conflicting currency representation: '${cm.unit}'.`,
          repairInstruction: `Resolve currency conflict: use a single unambiguous currency representation.`,
        });
      }
    }
  }

  for (const sMeas of sourceMeasurements) {
    // Find candidate measurement with matching normalized numeric value
    const matchingCandMeas = candMeasurements.find((cm) => cm.normalizedValue === sMeas.normalizedValue);
    if (matchingCandMeas) {
      if (sMeas.dimension === 'currency' || matchingCandMeas.dimension === 'currency') {
        if (matchingCandMeas.hasConflict && !sMeas.hasConflict) {
          violations.push({
            type: 'CURRENCY_REPRESENTATION_CONFLICT',
            severity: 'CRITICAL',
            expected: `${sMeas.value} ${sMeas.currency || sMeas.unit}`,
            found: `${matchingCandMeas.value} ${matchingCandMeas.unit}`,
            problem: `Candidate contains conflicting currency representation: '${matchingCandMeas.unit}'.`,
            repairInstruction: `Resolve currency conflict: use a single unambiguous currency representation.`,
          });
          continue;
        }

        if (sMeas.currency !== matchingCandMeas.currency || sMeas.normalizedUnit !== matchingCandMeas.normalizedUnit) {
          violations.push({
            type: 'CURRENCY_MUTATION',
            severity: 'CRITICAL',
            expected: `${sMeas.value} ${sMeas.currency || sMeas.unit}`,
            found: `${matchingCandMeas.value} ${matchingCandMeas.currency || matchingCandMeas.unit}`,
            problem: `Currency mutated from '${sMeas.currency || sMeas.unit}' to '${matchingCandMeas.currency || matchingCandMeas.unit}' for value '${sMeas.value}'.`,
            repairInstruction: `Preserve original currency: '${sMeas.currency || sMeas.unit}'.`,
          });
          continue;
        }
      } else if (sMeas.normalizedUnit !== matchingCandMeas.normalizedUnit) {
        if (sMeas.dimension !== matchingCandMeas.dimension) {
          violations.push({
            type: 'DIMENSION_MUTATION',
            severity: 'CRITICAL',
            expected: `${sMeas.value} ${sMeas.unit}`,
            found: `${matchingCandMeas.value} ${matchingCandMeas.unit}`,
            problem: `Measurement dimension mutated from '${sMeas.dimension}' (${sMeas.unit}) to '${matchingCandMeas.dimension}' (${matchingCandMeas.unit}).`,
            repairInstruction: `Preserve original measurement dimension: '${sMeas.unit}'.`,
          });
        } else {
          violations.push({
            type: 'UNIT_MUTATION',
            severity: 'CRITICAL',
            expected: `${sMeas.value} ${sMeas.unit}`,
            found: `${matchingCandMeas.value} ${matchingCandMeas.unit}`,
            problem: `Measurement unit mutated from '${sMeas.unit}' to '${matchingCandMeas.unit}' for value '${sMeas.value}'.`,
            repairInstruction: `Preserve original measurement unit: '${sMeas.unit}'.`,
          });
        }
      }
    }
  }

  // Check temporal dates
  for (const tClaim of sourceEnvelope.temporalClaims || []) {
    const rawVal = tClaim.value.toLowerCase();
    const normVal = tClaim.normalizedValue || rawVal;
    const candLower = candidateText.toLowerCase();

    if (!candLower.includes(rawVal) && !candLower.includes(normVal)) {
      violations.push({
        type: 'TEMPORAL_MUTATION',
        severity: 'CRITICAL',
        expected: tClaim.value,
        problem: `Date or time invariant '${tClaim.value}' missing from rewrite.`,
        repairInstruction: `Preserve the exact chronological reference: '${tClaim.value}'.`,
      });
    }
  }

  return violations;
}

/**
 * Checks causal relationship direction.
 */
export function checkCausalityPreservation(sourceEnvelope, candidateText) {
  const violations = [];
  const relations = sourceEnvelope.causalRelations || [];
  const candidateLower = (candidateText || '').toLowerCase();

  for (const rel of relations) {
    const causeWords = rel.cause.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter((w) => w.length > 3);
    const effectWords = rel.effect.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter((w) => w.length > 3);

    const causeFound = causeWords.some((w) => candidateLower.includes(w));
    const effectFound = effectWords.some((w) => candidateLower.includes(w));

    if (causeFound && effectFound) {
      let inverted = false;
      for (const ew of effectWords) {
        for (const cw of causeWords) {
          const invRegex = new RegExp(`(?:because of|because|since|due to|as a result of)\\s+[^.?!]*?\\b${ew}\\b[^.?!]*?\\b${cw}\\b`, 'i');
          if (invRegex.test(candidateLower)) {
            inverted = true;
            break;
          }
        }
        if (inverted) break;
      }

      if (inverted) {
        violations.push({
          type: 'CAUSAL_INVERSION',
          severity: 'CRITICAL',
          sourceSpan: rel.sentence,
          problem: `Causal relationship was inverted: '${rel.effect}' was made the cause of '${rel.cause}'.`,
          repairInstruction: `Ensure '${rel.cause}' remains the cause and '${rel.effect}' remains the result.`,
        });
      }
    }
  }

  return violations;
}

/**
 * Checks for unsupported additions (hallucinations of devices, studies, certifications, credentials).
 */
export function checkUnsupportedAdditions(sourceEnvelope, candidateText) {
  const violations = [];
  const sourceLower = (sourceEnvelope.normalizedText || '').toLowerCase();
  const candLower = (candidateText || '').toLowerCase();

  // Hallmark unsupported phrases added by models to sound authoritative
  const SUSPICIOUS_ADDITIONS = [
    { pattern: /\bacross multiple devices\b/i, term: 'across multiple devices' },
    { pattern: /\baccording to (?:recent|new) (?:studies|research|reports)\b/i, term: 'unsupported study citation' },
    { pattern: /\bpeer-reviewed\b/i, term: 'peer-reviewed' },
    { pattern: /\bcertified by\b/i, term: 'certified by' },
    { pattern: /\bindependently verified\b/i, term: 'independently verified' },
    { pattern: /\bthousands of (?:users|customers|developers)\b/i, term: 'invented scale' },
  ];

  for (const { pattern, term } of SUSPICIOUS_ADDITIONS) {
    if (pattern.test(candLower) && !pattern.test(sourceLower)) {
      violations.push({
        type: 'UNSUPPORTED_ADDITION',
        severity: 'CRITICAL',
        problem: `Candidate introduced an unsubstantiated embellishment or claim: '${term}'.`,
        repairInstruction: `Remove the invented claim '${term}' and stay strictly grounded in source envelope.`,
      });
    }
  }

  // Check for introduced named entities, organizations, or locations
  const srcSentences = (sourceEnvelope.normalizedText || '').split(/(?<=[.?!])\s+/);
  const candSentences = (candidateText || '').split(/(?<=[.?!])\s+/);

  const getCapitalizedEntities = (s) => {
    const tokens = s.trim().split(/\s+/);
    // Ignore first token of sentence (capitalized by grammar)
    return tokens.slice(1).map((w) => w.replace(/[^a-zA-Z]/g, '')).filter((w) => w.length > 2 && /^[A-Z][a-z]+$/.test(w));
  };

  const srcEntities = new Set(srcSentences.flatMap(getCapitalizedEntities).map((w) => w.toLowerCase()));
  const candEntities = candSentences.flatMap(getCapitalizedEntities);
  const ungroundedEntities = candEntities.filter((e) => !srcEntities.has(e.toLowerCase()) && !sourceLower.includes(e.toLowerCase()));

  if (ungroundedEntities.length >= 2) {
    violations.push({
      type: 'UNSUPPORTED_ADDITION',
      severity: 'CRITICAL',
      problem: `Candidate introduced ungrounded named entities not present in source: '${ungroundedEntities.join(', ')}'.`,
      repairInstruction: 'Remove introduced entities and stick strictly to source facts.',
    });
  }

  // Check for ungrounded temporal claims / dates (e.g. "in 2024", "yesterday", "last week")
  const temporalRegex = /\b(?:in\s+)?(19\d\d|20\d\d)\b|\b(?:yesterday|last\s+(?:week|month|year))\b/gi;
  const srcDates = new Set((sourceLower.match(temporalRegex) || []).map((d) => d.toLowerCase().trim()));
  const candDates = (candLower.match(temporalRegex) || []).map((d) => d.toLowerCase().trim());
  const ungroundedDates = candDates.filter((d) => !srcDates.has(d));
  if (ungroundedDates.length > 0) {
    violations.push({
      type: 'UNSUPPORTED_ADDITION',
      severity: 'CRITICAL',
      problem: `Candidate introduced ungrounded temporal assertions: '${ungroundedDates.join(', ')}'.`,
      repairInstruction: 'Remove ungrounded dates and time assertions.',
    });
  }

  // Factual content ungrounded addition detection with synonym awareness
  const FUNCTION_WORDS = new Set([
    'this', 'that', 'these', 'those', 'with', 'from', 'into', 'during', 'including',
    'until', 'against', 'among', 'throughout', 'despite', 'towards', 'upon', 'concerning',
    'been', 'being', 'have', 'has', 'had', 'does', 'doing', 'done', 'were', 'would',
    'could', 'should', 'might', 'must', 'will', 'shall', 'very', 'more', 'most',
    'such', 'only', 'same', 'than', 'then', 'also', 'further', 'moreover', 'observed',
    'about', 'above', 'after', 'before', 'between', 'under', 'while', 'where'
  ]);

  // Common synonym / paraphrase stem equivalence groups
  const SYNONYM_GROUPS = [
    new Set(['develop', 'creat', 'build', 'form', 'produc']),
    new Set(['durabl', 'long', 'last', 'reliabl', 'resili']),
    new Set(['solut', 'fix', 'resolut', 'remedi']),
    new Set(['substanti', 'signific', 'consider', 'notabl', 'mark']),
    new Set(['progress', 'advanc', 'improv', 'growth']),
    new Set(['goal', 'target', 'object', 'aim']),
    new Set(['observ', 'note', 'wit', 'see', 'found', 'detect']),
    new Set(['correl', 'link', 'connect', 'associ', 'relat']),
    new Set(['cognit', 'mental', 'mind', 'intellect']),
    new Set(['initi', 'begin', 'start', 'launch']),
    new Set(['swift', 'rapid', 'quick', 'fast', 'speedi']),
    new Set(['investig', 'inquiri', 'examin', 'probe', 'inspect']),
  ];

  const stem = (w) => w.replace(/(?:ing|ed|ly|es|s|tion|ment)$/, '');
  const areSynonyms = (w1, w2) => {
    const s1 = stem(w1);
    const s2 = stem(w2);
    if (s1 === s2) return true;
    for (const group of SYNONYM_GROUPS) {
      if (group.has(s1) && group.has(s2)) return true;
    }
    return false;
  };

  const srcTokens = sourceLower.replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !FUNCTION_WORDS.has(w));
  const candTokens = candLower.replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !FUNCTION_WORDS.has(w));
  const ungrounded = candTokens.filter((cw) => !srcTokens.some((sw) => areSynonyms(sw, cw)));

  // If candidate has very high ungrounded ratio and multiple ungrounded content words, flag as addition
  const ungroundedRatio = candTokens.length > 0 ? (ungrounded.length / candTokens.length) : 0;
  if ((candTokens.length >= 6 && ungrounded.length >= 3 && ungroundedRatio >= 0.45) ||
      (candTokens.length >= 8 && ungrounded.length >= 4 && ungroundedRatio >= 0.40)) {
    violations.push({
      type: 'UNSUPPORTED_ADDITION',
      severity: 'CRITICAL',
      problem: `Candidate introduced substantial ungrounded information not present in the source: '${ungrounded.slice(0, 5).join(', ')}'.`,
      repairInstruction: 'Remove extraneous ungrounded claims and stick strictly to source facts.',
    });
  }

  return violations;
}

/**
 * Executes full semantic validation of rewrite candidate against source envelope.
 * Returns comprehensive audit report and PASS/FAIL verdict using the V2 Semantic Verification Engine.
 */
export function validateSemanticFidelity(sourceEnvelope, candidateText, options = {}) {
  if (!sourceEnvelope || !candidateText) {
    return {
      valid: false,
      score: 0,
      verdict: 'FAIL',
      criticalCount: 1,
      highCount: 0,
      violations: [{ type: 'EMPTY_INPUT', severity: 'CRITICAL', problem: 'Missing source envelope or candidate text.' }],
      audit: {},
      adjudication: null,
      forwardResult: null,
      reverseResult: null,
    };
  }

  const sourceText = sourceEnvelope.normalizedText || sourceEnvelope.originalText || '';
  const result = evaluateSemanticFidelitySync(sourceText, candidateText, sourceEnvelope.claimGraph, {
    protectedSpans: sourceEnvelope.protectedSpans || [],
    riskScore: options.riskScore || 0.0,
    isHighRisk: options.isHighRisk || false,
    ...options,
  });

  return {
    valid: result.accepted,
    verdict: result.status,
    score: result.score,
    criticalCount: result.criticalCount,
    highCount: result.highCount,
    violations: result.violations,
    audit: {
      ...result.audit,
      scopePreserved: result.claimChecks?.scopePreserved ?? true,
      quantifiersPreserved: result.claimChecks?.quantifiersPreserved ?? true,
      conditionsPreserved: result.claimChecks?.conditionsPreserved ?? true,
      comparisonsPreserved: result.claimChecks?.comparisonsPreserved ?? true,
      temporalPreserved: result.claimChecks?.temporalPreserved ?? true,
      attributionsPreserved: result.claimChecks?.attributionsPreserved ?? true,
      predicatesPreserved: result.claimChecks?.predicatesPreserved ?? true,
    },
    metrics: result.metrics,
    verifierMetadata: result.verifierMetadata,
    adjudication: result.adjudication || null,
    forwardResult: result.entailmentChecks?.forwardResult || null,
    reverseResult: result.entailmentChecks?.reverseResult || null,
  };
}

/**
 * Asynchronous semantic validation executing independent model verification when configured.
 */
export async function validateSemanticFidelityAsync(sourceEnvelope, candidateText, options = {}) {
  if (!sourceEnvelope || !candidateText) {
    return {
      valid: false,
      score: 0,
      verdict: 'FAIL',
      criticalCount: 1,
      highCount: 0,
      violations: [{ type: 'EMPTY_INPUT', severity: 'CRITICAL', problem: 'Missing source envelope or candidate text.' }],
      audit: {},
      adjudication: null,
      forwardResult: null,
      reverseResult: null,
      verifierMetadata: null,
    };
  }

  const sourceText = sourceEnvelope.normalizedText || sourceEnvelope.originalText || '';
  const result = await evaluateSemanticFidelity(sourceText, candidateText, sourceEnvelope.claimGraph, {
    protectedSpans: sourceEnvelope.protectedSpans || [],
    riskScore: options.riskScore || 0.0,
    isHighRisk: options.isHighRisk || false,
    ...options,
  });

  return {
    valid: result.accepted,
    verdict: result.status,
    score: result.score,
    criticalCount: result.criticalCount,
    highCount: result.highCount,
    violations: result.violations,
    audit: {
      ...result.audit,
      scopePreserved: result.claimChecks?.scopePreserved ?? true,
      quantifiersPreserved: result.claimChecks?.quantifiersPreserved ?? true,
      conditionsPreserved: result.claimChecks?.conditionsPreserved ?? true,
      comparisonsPreserved: result.claimChecks?.comparisonsPreserved ?? true,
      temporalPreserved: result.claimChecks?.temporalPreserved ?? true,
      attributionsPreserved: result.claimChecks?.attributionsPreserved ?? true,
      predicatesPreserved: result.claimChecks?.predicatesPreserved ?? true,
    },
    metrics: result.metrics,
    verifierMetadata: result.verifierMetadata,
    adjudication: result.adjudication || null,
    forwardResult: result.entailmentChecks?.forwardResult || null,
    reverseResult: result.entailmentChecks?.reverseResult || null,
  };
}
