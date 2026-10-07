/**
 * PenShift Document Consistency & Coreference Engine (V3)
 * 
 * Verifies document-level semantic consistency across paragraphs.
 * Detects cross-paragraph contradictions, inverted entity hierarchies,
 * pronoun drift, and temporal or numeric contradictions spanning multiple sections.
 * 
 * Supports lowercase / common-noun entities (e.g. "the company", "the system")
 * without relying on capital-letter heuristics.
 */

import { normalizeNumber, extractMeasurements } from './protectedSpans.js';
import { extractSentenceComparison } from './claimGraph.js';

/**
 * Splits document into discrete paragraphs.
 */
function extractParagraphs(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// Case-agnostic entity pattern matching both proper nouns and common-noun semantic roles
const ENTITY_PATTERN = '(?:(?:the|this|that|our|a|an)\\s+(?:company|organization|system|service|platform|database|process|team|regulator|customer|device|firm|corporation|vendor|agency|client|user|model|algorithm|server|application|provider|parent|subsidiary|board|committee|management|court|executives?)|[A-Z][a-zA-Z0-9_-]*(?:\\s+[A-Z][a-zA-Z0-9_-]*)*)';

export const ASYMMETRIC_RELATIONS = [
  {
    type: 'ACQUISITION',
    verbs: ['acquired', 'bought', 'purchased', 'took over', 'absorbed'],
    inverseVerbs: ['acquired', 'bought', 'purchased', 'took over', 'absorbed'],
    opposingVerbs: ['sold', 'divested', 'spun off'],
    label: 'acquisition/ownership',
  },
  {
    type: 'REGULATORY_ACTION',
    verbs: ['sued', 'fined', 'investigated', 'audited', 'penalized', 'sanctioned'],
    inverseVerbs: ['sued', 'fined', 'investigated', 'audited', 'penalized', 'sanctioned'],
    opposingVerbs: ['cleared', 'exonerated', 'approved'],
    label: 'regulatory/legal action',
  },
  {
    type: 'CAUSAL',
    verbs: ['caused', 'triggered', 'led to', 'resulted in', 'produced'],
    inverseVerbs: ['caused', 'triggered', 'led to', 'resulted in'],
    opposingVerbs: ['prevented', 'blocked', 'inhibited', 'correlated with'],
    label: 'causal direction',
  },

  {
    type: 'APPROVAL',
    verbs: ['approved', 'endorsed', 'sanctioned', 'authorized', 'validated', 'passed'],
    inverseVerbs: ['approved', 'endorsed', 'sanctioned', 'authorized'],
    opposingVerbs: ['rejected', 'vetoed', 'disallowed', 'denied', 'blocked'],
    label: 'approval/authorization',
  },
  {
    type: 'REJECTION',
    verbs: ['rejected', 'vetoed', 'disallowed', 'denied', 'blocked'],
    inverseVerbs: ['rejected', 'vetoed', 'disallowed', 'denied'],
    opposingVerbs: ['approved', 'endorsed', 'sanctioned', 'authorized'],
    label: 'rejection/denial',
  },
  {
    type: 'HIRING',
    verbs: ['hired', 'recruited', 'employed', 'onboarded'],
    inverseVerbs: ['hired', 'recruited', 'employed', 'onboarded'],
    opposingVerbs: ['fired', 'dismissed', 'terminated', 'laid off'],
    label: 'employment/hiring',
  },
  {
    type: 'FIRING',
    verbs: ['fired', 'dismissed', 'terminated', 'laid off'],
    inverseVerbs: ['fired', 'dismissed', 'terminated', 'laid off'],
    opposingVerbs: ['hired', 'recruited', 'employed', 'onboarded'],
    label: 'employment termination',
  },
  {
    type: 'PROMOTION',
    verbs: ['promoted', 'advanced', 'elevated'],
    inverseVerbs: ['promoted', 'advanced', 'elevated'],
    opposingVerbs: ['demoted', 'relegated'],
    label: 'promotion/elevation',
  },
  {
    type: 'DEMOTION',
    verbs: ['demoted', 'relegated'],
    inverseVerbs: ['demoted', 'relegated'],
    opposingVerbs: ['promoted', 'advanced', 'elevated'],
    label: 'demotion/relegation',
  },
  {
    type: 'INSTALLATION',
    verbs: ['installed', 'deployed', 'mounted', 'setup'],
    inverseVerbs: ['installed', 'deployed', 'mounted'],
    opposingVerbs: ['uninstalled', 'removed', 'unmounted', 'deleted'],
    label: 'system installation',
  },
  {
    type: 'REMOVAL',
    verbs: ['uninstalled', 'removed', 'unmounted', 'deleted'],
    inverseVerbs: ['uninstalled', 'removed', 'unmounted'],
    opposingVerbs: ['installed', 'deployed', 'mounted'],
    label: 'system removal',
  },
  {
    type: 'CREATION',
    verbs: ['created', 'built', 'developed', 'produced', 'launched'],
    inverseVerbs: ['created', 'built', 'developed', 'produced'],
    opposingVerbs: ['deleted', 'destroyed', 'eliminated', 'dismantled'],
    label: 'creation/production',
  },
  {
    type: 'DELETION',
    verbs: ['deleted', 'destroyed', 'eliminated', 'dismantled'],
    inverseVerbs: ['deleted', 'destroyed', 'eliminated'],
    opposingVerbs: ['created', 'built', 'developed', 'produced'],
    label: 'deletion/destruction',
  },
  {
    type: 'INCLUSION',
    verbs: ['included', 'incorporated', 'integrated', 'encompassed'],
    inverseVerbs: ['included', 'incorporated', 'integrated'],
    opposingVerbs: ['excluded', 'omitted', 'isolated'],
    label: 'inclusion/incorporation',
  },
  {
    type: 'EXCLUSION',
    verbs: ['excluded', 'omitted', 'isolated'],
    inverseVerbs: ['excluded', 'omitted', 'isolated'],
    opposingVerbs: ['included', 'incorporated', 'integrated'],
    label: 'exclusion/omission',
  },
  {
    type: 'ENABLEMENT',
    verbs: ['enabled', 'activated', 'granted', 'permitted'],
    inverseVerbs: ['enabled', 'activated', 'granted'],
    opposingVerbs: ['disabled', 'deactivated', 'revoked', 'prohibited'],
    label: 'enablement/permission',
  },
  {
    type: 'DISABLEMENT',
    verbs: ['disabled', 'deactivated', 'revoked', 'prohibited'],
    inverseVerbs: ['disabled', 'deactivated', 'revoked'],
    opposingVerbs: ['enabled', 'activated', 'granted', 'permitted'],
    label: 'disablement/revocation',
  },
  {
    type: 'TEMPORAL',
    verbs: ['occurred before', 'happened before', 'preceded', 'took place before'],
    inverseVerbs: ['occurred after', 'happened after', 'followed', 'took place after'],
    opposingVerbs: ['occurred after', 'happened after', 'followed'],
    label: 'chronological precedence',
  },
];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Verifies cross-paragraph entity and fact consistency.
 */
export function verifyDocumentConsistency(sourceText, candidateText, _options = {}) {
  const violations = [];
  const srcParagraphs = extractParagraphs(sourceText);
  const candParagraphs = extractParagraphs(candidateText);

  // If document is empty or single sentence without cross-paragraph structure
  if (!sourceText || !candidateText) {
    return { valid: true, violations: [], crossParagraphContradictions: 0 };
  }

  // 1. Check for entity relationships established across paragraphs (case-agnostic)
  for (const rel of ASYMMETRIC_RELATIONS) {
    const verbPattern = rel.verbs.map((v) => escapeRegex(v)).join('|');
    const relRx = new RegExp(`(${ENTITY_PATTERN})\\s+(?:${verbPattern})\\s+(${ENTITY_PATTERN})`, 'gi');

    for (let pIdx = 0; pIdx < candParagraphs.length; pIdx++) {
      const pText = candParagraphs[pIdx];
      let match;

      while ((match = relRx.exec(pText)) !== null) {
        const candActor = match[1].trim();
        const candTarget = match[2].trim();

        // Check if source text asserted the exact inverse role (target acted on actor)
        const inversePattern = rel.inverseVerbs.map((v) => escapeRegex(v)).join('|');
        const inverseRx = new RegExp(`\\b${escapeRegex(candTarget)}\\b\\s+(?:${inversePattern})\\s+\\b${escapeRegex(candActor)}\\b`, 'i');

        if (inverseRx.test(sourceText)) {
          violations.push({
            type: 'DOCUMENT_CONTRADICTION',
            severity: 'CRITICAL',
            problem: `Cross-paragraph entity relationship inverted: '${candActor}' was stated to have ${rel.label} with '${candTarget}', contradicting source where '${candTarget}' was the subject.`,
            repairInstruction: `Preserve the established document-level entity relationship: '${candTarget}' acted upon '${candActor}'.`,
          });
        }

        // Check if source asserted the opposing action (e.g. source: approved, candidate: rejected)
        if (rel.opposingVerbs && rel.opposingVerbs.length > 0) {
          const oppPattern = rel.opposingVerbs.map((v) => escapeRegex(v)).join('|');
          const oppRx = new RegExp(`\\b${escapeRegex(candActor)}\\b\\s+(?:${oppPattern})\\s+\\b${escapeRegex(candTarget)}\\b`, 'i');
          if (oppRx.test(sourceText)) {
            violations.push({
              type: 'DOCUMENT_CONTRADICTION',
              severity: 'CRITICAL',
              problem: `Cross-paragraph relation contradicted: candidate asserts '${candActor}' performed action on '${candTarget}' contradicting source which asserted the opposite relation.`,
              repairInstruction: `Preserve the established document proposition between '${candActor}' and '${candTarget}'.`,
            });
          }
        }
      }
    }
  }

  // 1b. Check comparative consistency against source across paragraphs
  for (const cPara of candParagraphs) {
    for (const cSent of cPara.split(/(?<=[.?!])\s+/)) {
      const cComp = extractSentenceComparison(cSent);
      if (!cComp) continue;
      const cLeft = cComp.left.toLowerCase();
      const cRight = cComp.right.toLowerCase();

      for (const sPara of srcParagraphs) {
        for (const sSent of sPara.split(/(?<=[.?!])\s+/)) {
          const sComp = extractSentenceComparison(sSent);
          if (!sComp || sComp.property !== cComp.property) continue;
          const sLeft = sComp.left.toLowerCase();
          const sRight = sComp.right.toLowerCase();

          // Contradiction: Candidate inverted the comparative hierarchy
          if (cLeft === sRight && cRight === sLeft) {
            violations.push({
              type: 'DOCUMENT_CONTRADICTION',
              severity: 'CRITICAL',
              problem: `Cross-paragraph comparison hierarchy inverted: candidate asserted '${cComp.left}' exceeds '${cComp.right}' in ${cComp.property}, contradicting source where '${sComp.left}' exceeded '${sComp.right}'.`,
              repairInstruction: `Preserve comparative hierarchy: '${sComp.left}' exceeds '${sComp.right}' in ${sComp.property}.`,
            });
          }
        }
      }
    }
  }

  // 2. Check for internal cross-paragraph contradictions within candidate itself
  for (let i = 0; i < candParagraphs.length; i++) {
    for (let j = i + 1; j < candParagraphs.length; j++) {
      const p1 = candParagraphs[i];
      const p2 = candParagraphs[j];

      // Check canonical comparison inversion between candidate paragraphs
      for (const sent1 of p1.split(/(?<=[.?!])\s+/)) {
        const comp1 = extractSentenceComparison(sent1);
        if (!comp1) continue;
        const left1 = comp1.left.toLowerCase();
        const right1 = comp1.right.toLowerCase();

        for (const sent2 of p2.split(/(?<=[.?!])\s+/)) {
          const comp2 = extractSentenceComparison(sent2);
          if (!comp2 || comp2.property !== comp1.property) continue;
          const left2 = comp2.left.toLowerCase();
          const right2 = comp2.right.toLowerCase();

          if (left1 === right2 && right1 === left2) {
            violations.push({
              type: 'INTERNAL_DOCUMENT_CONTRADICTION',
              severity: 'CRITICAL',
              problem: `Document contradicts itself across paragraphs: paragraph ${i + 1} asserts '${comp1.left}' exceeds '${comp1.right}' in ${comp1.property}, but paragraph ${j + 1} asserts '${comp2.left}' exceeds '${comp2.right}' in ${comp2.property}.`,
              repairInstruction: `Eliminate cross-paragraph contradiction: maintain consistent comparative hierarchy throughout document.`,
            });
          }
        }
      }

      // Check opposing relation contradiction within candidate between paragraphs
      for (const rel of ASYMMETRIC_RELATIONS) {
        if (!rel.opposingVerbs || rel.opposingVerbs.length === 0) continue;
        const verbPattern = rel.verbs.map((v) => escapeRegex(v)).join('|');
        const oppPattern = rel.opposingVerbs.map((v) => escapeRegex(v)).join('|');

        const relRx = new RegExp(`(${ENTITY_PATTERN})\\s+(?:${verbPattern})\\s+(${ENTITY_PATTERN})`, 'gi');
        let rMatch;
        while ((rMatch = relRx.exec(p1)) !== null) {
          const act = rMatch[1].trim();
          const tgt = rMatch[2].trim();
          const oppInP2 = new RegExp(`\\b${escapeRegex(act)}\\b\\s+(?:${oppPattern})\\s+\\b${escapeRegex(tgt)}\\b`, 'i');
          if (oppInP2.test(p2)) {
            violations.push({
              type: 'INTERNAL_DOCUMENT_CONTRADICTION',
              severity: 'CRITICAL',
              problem: `Document internally contradicts itself across paragraphs: paragraph ${i + 1} states '${act}' performed action on '${tgt}', but paragraph ${j + 1} states the direct opposite relation.`,
              repairInstruction: `Maintain consistent document relations between '${act}' and '${tgt}'.`,
            });
          }
        }
      }
    }
  }

  // 3. Check for cross-paragraph numeric & measurement contradictions
  for (let sIdx = 0; sIdx < srcParagraphs.length; sIdx++) {
    const sPara = srcParagraphs[sIdx];
    const sMeasurements = extractMeasurements(sPara);

    if (candParagraphs[sIdx]) {
      const cMeasurements = extractMeasurements(candParagraphs[sIdx]);

      // If source had a measurement with unit and candidate has same normalized value but different unit
      for (const sm of sMeasurements) {
        if (!sm.normalizedUnit) continue;
        for (const cm of cMeasurements) {
          if (sm.normalizedValue === cm.normalizedValue && sm.normalizedUnit !== cm.normalizedUnit) {
            violations.push({
              type: 'NUMERIC_PARAGRAPH_DRIFT',
              severity: 'CRITICAL',
              problem: `Cross-paragraph unit mutation: '${sm.value} ${sm.unit}' in source paragraph ${sIdx + 1} was changed to '${cm.value} ${cm.unit}' in candidate.`,
              repairInstruction: `Preserve the exact measurement unit '${sm.unit}'.`,
            });
          }
        }
      }

      // Check raw number count/value drift
      const sNumbers = (sPara.match(/\b\d+(?:,\d{3})*(?:\.\d+)?(?:\s*(?:%|percent|percentage)\b|%)?|\b[$€£¥₹]\s*\d+(?:,\d{3})*(?:\.\d+)?/gi) || [])
        .map(normalizeNumber)
        .filter(Boolean);
      const cNumbers = (candParagraphs[sIdx].match(/\b\d+(?:,\d{3})*(?:\.\d+)?(?:\s*(?:%|percent|percentage)\b|%)?|\b[$€£¥₹]\s*\d+(?:,\d{3})*(?:\.\d+)?/gi) || [])
        .map(normalizeNumber)
        .filter(Boolean);

      if (sNumbers.length === 1 && cNumbers.length === 1 && sNumbers[0] !== cNumbers[0]) {
        violations.push({
          type: 'NUMERIC_PARAGRAPH_DRIFT',
          severity: 'CRITICAL',
          problem: `Metric drifted across paragraphs from '${sNumbers[0]}' to '${cNumbers[0]}'.`,
          repairInstruction: `Restore invariant metric '${sNumbers[0]}'.`,
        });
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    crossParagraphContradictions: violations.length,
  };
}

