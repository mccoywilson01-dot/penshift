/**
 * PenShift Terminology Map Engine
 * Detects domain-critical terms, establishes consistency rules, and protects against distortion through synonym substitution.
 */

// Common high-risk domain terminology mappings
const KNOWN_DOMAIN_TAXONOMY = [
  {
    canonicalTerm: 'machine learning model',
    allowedVariants: ['ml model', 'machine learning system'],
    forbiddenVariants: ['ai engine', 'prediction system', 'neural tool', 'modeling framework'],
    reason: 'technical precision: model architecture must not be conflated with broad tooling',
  },
  {
    canonicalTerm: 'authentication',
    allowedVariants: ['user authentication', 'auth'],
    forbiddenVariants: ['authorization', 'login permission', 'verification portal'],
    reason: 'security precision: authentication (who you are) is distinct from authorization (what you can do)',
  },
  {
    canonicalTerm: 'authorization',
    allowedVariants: ['access control', 'permissions'],
    forbiddenVariants: ['authentication', 'sign-in credentials'],
    reason: 'security precision: permissions are distinct from identity verification',
  },
  {
    canonicalTerm: 'encryption',
    allowedVariants: ['cryptographic encryption', 'end-to-end encryption'],
    forbiddenVariants: ['hashing', 'encoding', 'obfuscation', 'data masking'],
    reason: 'cryptographic precision: encryption is reversible with key; hashing and encoding are not',
  },
  {
    canonicalTerm: 'latency',
    allowedVariants: ['response time', 'round-trip time'],
    forbiddenVariants: ['bandwidth', 'throughput', 'speed limit'],
    reason: 'networking precision: latency is delay, throughput is capacity',
  },
  {
    canonicalTerm: 'statute of limitations',
    allowedVariants: ['legal filing deadline'],
    forbiddenVariants: ['statute of liberty', 'grace period', 'probation time'],
    reason: 'legal precision: statutory cutoff differs from discretionary grace period',
  },
  {
    canonicalTerm: 'clinical trial',
    allowedVariants: ['clinical study'],
    forbiddenVariants: ['laboratory experiment', 'survey', 'medical demonstration'],
    reason: 'medical precision: clinical trial requires human protocol approval',
  },
];

/**
 * Builds a document-specific terminology map from source text.
 */
export function buildTerminologyMap(sourceText, customMappings = []) {
  if (!sourceText || typeof sourceText !== 'string') return [];
  const lower = sourceText.toLowerCase();
  const map = [];

  // Match known taxonomy terms
  for (const item of KNOWN_DOMAIN_TAXONOMY) {
    if (lower.includes(item.canonicalTerm.toLowerCase())) {
      map.push({ ...item });
    }
  }

  // Detect capitalized multi-word technical compounds: e.g. "OAuth 2.0", "Fast Fourier Transform", "Zero-Knowledge Proof"
  const technicalCompounds = sourceText.match(/\b([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)+)\b/g) || [];
  for (const compound of technicalCompounds) {
    const canonical = compound.trim();
    if (!map.some((m) => m.canonicalTerm.toLowerCase() === canonical.toLowerCase())) {
      map.push({
        canonicalTerm: canonical,
        allowedVariants: [canonical],
        forbiddenVariants: [],
        reason: 'capitalized domain term preservation',
      });
    }
  }

  // Add custom mappings
  for (const custom of customMappings) {
    if (custom && custom.canonicalTerm) {
      map.push(custom);
    }
  }

  return map;
}

/**
 * Validates candidate rewrite against the terminology map.
 * Returns { valid: boolean, violations: [] }
 */
export function verifyTerminologyConsistency(terminologyMap, candidateText) {
  if (!Array.isArray(terminologyMap) || terminologyMap.length === 0) {
    return { valid: true, violations: [] };
  }

  const candidateLower = (candidateText || '').toLowerCase();
  const violations = [];

  for (const item of terminologyMap) {
    const canonicalLower = item.canonicalTerm.toLowerCase();
    
    // Check for presence of forbidden variants
    for (const forbidden of item.forbiddenVariants || []) {
      if (candidateLower.includes(forbidden.toLowerCase())) {
        violations.push({
          canonicalTerm: item.canonicalTerm,
          foundForbidden: forbidden,
          reason: item.reason,
          problem: `Forbidden synonym substitution: '${item.canonicalTerm}' was replaced with '${forbidden}', altering technical meaning.`,
        });
      }
    }

    // Check that either canonical or an allowed variant exists if term is critical
    const hasCanonical = candidateLower.includes(canonicalLower);
    const hasAllowed = (item.allowedVariants || []).some((v) => candidateLower.includes(v.toLowerCase()));

    if (!hasCanonical && !hasAllowed && item.forbiddenVariants?.length > 0) {
      violations.push({
        canonicalTerm: item.canonicalTerm,
        problem: `Critical domain term '${item.canonicalTerm}' completely vanished from rewrite without allowed equivalent.`,
        reason: item.reason,
      });
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
