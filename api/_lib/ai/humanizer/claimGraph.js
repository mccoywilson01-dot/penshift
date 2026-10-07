/**
 * PenShift Semantic Claim Graph Engine (V2)
 * 
 * Constructs structured, explicit proposition graphs from text.
 * Replaces naive word-slice heuristics with structured grammatical relation parsing,
 * discrete modality gradient tracking, scope restrictions, conditional prerequisites,
 * causal directionality, comparisons, temporal ordering, and epistemic attribution.
 */

// Discrete gradient modality classification
export const MODALITY_LEVELS = {
  possibility: { rank: 1, label: 'possibility' },
  weak_probability: { rank: 2, label: 'weak_probability' },
  strong_probability: { rank: 3, label: 'strong_probability' },
  recommendation: { rank: 4, label: 'recommendation' },
  permission: { rank: 4, label: 'permission' },
  obligation: { rank: 5, label: 'obligation' },
  necessity: { rank: 6, label: 'necessity' },
  future_assertion: { rank: 7, label: 'future_assertion' },
  high_certainty: { rank: 8, label: 'high_certainty' },
};

const MODAL_LEXICON = [
  { rx: /\b(definitely|certainly|guaranteed|unquestionably|undeniably|always)\b/i, level: 'high_certainty' },
  { rx: /\b(?:it is possible that|possible that|possibly|may|might|could|perhaps|potentially)\b/i, level: 'possibility' },
  { rx: /\b(?:will\s+(?:probably|likely|possibly|perhaps)|(?:probably|likely)\s+will|likely|probably|expected to|anticipated to)\b/i, level: 'strong_probability' },
  { rx: /\b(must|have to|has to|required to|mandatory|essential|compulsory)\b/i, level: 'necessity' },
  { rx: /\b(should|ought to|supposed to)\b/i, level: 'recommendation' },
  { rx: /\b(can|allowed to|permitted to|authorized to)\b/i, level: 'permission' },
  { rx: /\b(plausible|somewhat likely)\b/i, level: 'weak_probability' },
  { rx: /\b(will|shall)\b/i, level: 'future_assertion' },
];

const QUANTIFIER_PATTERNS = [
  { rx: /\b(only|exclusively|solely)\b/i, quantifier: 'only', scope: 'restricted_only' },
  { rx: /\b(all|every|each|universal|everyone|everything)\b/i, quantifier: 'all', scope: 'universal' },
  { rx: /\b(none|neither|no one|nobody|nothing|zero)\b/i, quantifier: 'none', scope: 'universal' },
  { rx: /\b(most|majority of|predominantly)\b/i, quantifier: 'most', scope: 'existential' },
  { rx: /\b(many|numerous|multiple)\b/i, quantifier: 'many', scope: 'existential' },
  { rx: /\b(some|several|a few|various)\b/i, quantifier: 'some', scope: 'existential' },
  { rx: /\b(few|little|scarce)\b/i, quantifier: 'few', scope: 'existential' },
  { rx: /\b(at least|no less than|no fewer than|not less than|minimum of)\b/i, quantifier: 'at_least', scope: 'boundary' },
  { rx: /\b(at most|no more than|not more than|maximum of)\b/i, quantifier: 'at_most', scope: 'boundary' },
  { rx: /\b(exactly|precisely)\b/i, quantifier: 'exactly', scope: 'boundary' },
  { rx: /\b(approximately|roughly|about|around)\b/i, quantifier: 'approximately', scope: 'boundary' },
];

const ATTRIBUTION_PATTERNS = [
  { rx: /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*|(?:\bthe\s+)?(?:company|team|authors?|researchers?|study|report|government|witnesses?|analysts?|press|scientists?|committee|documents?))\s+(?:reported|stated|announced|claimed|declared|published|found|alleged|estimated)\s+that\b/i, status: 'reported_claim' },
  { rx: /\b(?:according to|as reported by)\s+([^,]+),/i, status: 'reported_claim' },
  { rx: /\b((?!(?:the|a|an|this|that)\b)[A-Z][a-z]+|(?:\bthe\s+)?(?:company|team|authors?|scientists?))\s+(?:believes?|thinks?|feels?|suspects?|suspected)\s+that\b/i, status: 'belief' },
  { rx: /\b(?:evidence suggests|data indicates|findings suggest)\s+that\b/i, status: 'observed_evidence' },
  { rx: /\b(?:allegedly|it is alleged that|purportedly)\b/i, status: 'allegation' },
  { rx: /\b(?:estimated to|projected to|estimated that)\b/i, status: 'estimate' },
];

// Predicate lemma dictionary for propositional verification
export const PREDICATE_LEMMAS = {
  deny: 'deny', denied: 'deny', denies: 'deny', denying: 'deny',
  make: 'make', made: 'make', makes: 'make', making: 'make',
  approve: 'approve', approved: 'approve', approves: 'approve', approving: 'approve',
  reject: 'reject', rejected: 'reject', rejects: 'reject', rejecting: 'reject',
  acquire: 'acquire', acquired: 'acquire', acquires: 'acquire', acquiring: 'acquire',
  sell: 'sell', sold: 'sell', sells: 'sell', selling: 'sell',
  increase: 'increase', increased: 'increase', increases: 'increase', increasing: 'increase',
  decrease: 'decrease', decreased: 'decrease', decreases: 'decrease', decreasing: 'decrease',
  cause: 'cause', caused: 'cause', causes: 'cause', causing: 'cause',
  correlate: 'correlate', correlated: 'correlate', correlates: 'correlate', correlating: 'correlate',
  support: 'support', supported: 'support', supports: 'support', supporting: 'support',
  oppose: 'oppose', opposed: 'oppose', opposes: 'oppose', opposing: 'oppose',
  allow: 'allow', allowed: 'allow', allows: 'allow', allowing: 'allow',
  prevent: 'prevent', prevented: 'prevent', prevents: 'prevent', preventing: 'prevent',
  publish: 'publish', published: 'publish', publishes: 'publish', publishing: 'publish',
  remove: 'remove', removed: 'remove', removes: 'remove', removing: 'remove',
  start: 'start', started: 'start', starts: 'start', starting: 'start',
  stop: 'stop', stopped: 'stop', stops: 'stop', stopping: 'stop',
  accelerate: 'accelerate', accelerated: 'accelerate', accelerates: 'accelerate',
  decelerate: 'decelerate', decelerated: 'decelerate', decelerates: 'decelerate',
  enable: 'enable', enabled: 'enable', enables: 'enable',
  disable: 'disable', disabled: 'disable', disables: 'disable',
  grant: 'grant', granted: 'grant', grants: 'grant',
  revoke: 'revoke', revoked: 'revoke', revokes: 'revoke',
  require: 'require', required: 'require', requires: 'require',
  mandate: 'mandate', mandated: 'mandate', mandates: 'mandate',
  hire: 'hire', hired: 'hire', hires: 'hire', hiring: 'hire',
  fire: 'fire', fired: 'fire', fires: 'fire', firing: 'fire',
  praise: 'praise', praised: 'praise', praises: 'praise', praising: 'praise',
  criticize: 'criticize', criticized: 'criticize', criticizes: 'criticize', criticizing: 'criticize',
  install: 'install', installed: 'install', installs: 'install', installing: 'install',
  uninstall: 'uninstall', uninstalled: 'uninstall', uninstalls: 'uninstall', uninstalling: 'uninstall',
  promote: 'promote', promoted: 'promote', promotes: 'promote', promoting: 'promote',
  demote: 'demote', demoted: 'demote', demotes: 'demote', demoting: 'demote',
  accept: 'accept', accepted: 'accept', accepts: 'accept', accepting: 'accept',
  expand: 'expand', expanded: 'expand', expands: 'expand', expanding: 'expand',
  contract: 'contract', contracted: 'contract', contracts: 'contract', contracting: 'contract',
  include: 'include', included: 'include', includes: 'include', including: 'include',
  exclude: 'exclude', excluded: 'exclude', excludes: 'exclude', excluding: 'exclude',
  create: 'create', created: 'create', creates: 'create', creating: 'create',
  delete: 'delete', deleted: 'delete', deletes: 'delete', deleting: 'delete',
  destroy: 'destroy', destroyed: 'destroy', destroys: 'destroy', destroying: 'destroy',
  open: 'open', opened: 'open', opens: 'open', opening: 'open',
  close: 'close', closed: 'close', closes: 'close', closing: 'close',
  win: 'win', won: 'win', wins: 'win', winning: 'win',
  lose: 'lose', lost: 'lose', loses: 'lose', losing: 'lose',
  admit: 'admit', admitted: 'admit', admits: 'admit', admitting: 'admit',
  confirm: 'confirm', confirmed: 'confirm', confirms: 'confirm', confirming: 'confirm',
  prohibit: 'prohibit', prohibited: 'prohibit', prohibits: 'prohibit', prohibiting: 'prohibit',
  forbid: 'forbid', forbade: 'forbid', forbidden: 'forbid', forbids: 'forbid',
  succeed: 'succeed', succeeded: 'succeed', succeeds: 'succeed', succeeding: 'succeed',
  fail: 'fail', failed: 'fail', fails: 'fail', failing: 'fail',
  join: 'join', joined: 'join', joins: 'join', joining: 'join',
  leave: 'leave', left: 'leave', leaves: 'leave', leaving: 'leave',
  endorse: 'endorse', endorsed: 'endorse', endorses: 'endorse', endorsing: 'endorse',
  condemn: 'condemn', condemned: 'condemn', condemns: 'condemn', condemning: 'condemn',
  attack: 'attack', attacked: 'attack', attacks: 'attack', attacking: 'attack',
  defend: 'defend', defended: 'defend', defends: 'defend', defending: 'defend',
};

// Materially contradictory / incompatible pairs (mutations that break truth conditions)
export const INCOMPATIBLE_PREDICATE_PAIRS = [
  ['deny', 'make'],
  ['deny', 'confirm'],
  ['deny', 'admit'],
  ['approve', 'reject'],
  ['acquire', 'sell'],
  ['increase', 'decrease'],
  ['cause', 'correlate'],
  ['support', 'oppose'],
  ['allow', 'prevent'],
  ['publish', 'remove'],
  ['start', 'stop'],
  ['accelerate', 'decelerate'],
  ['enable', 'disable'],
  ['grant', 'revoke'],
  ['hire', 'fire'],
  ['praise', 'criticize'],
  ['install', 'uninstall'],
  ['promote', 'demote'],
  ['accept', 'reject'],
  ['expand', 'contract'],
  ['include', 'exclude'],
  ['create', 'delete'],
  ['create', 'destroy'],
  ['open', 'close'],
  ['win', 'lose'],
  ['admit', 'deny'],
  ['prohibit', 'allow'],
  ['forbid', 'allow'],
  ['succeed', 'fail'],
  ['join', 'leave'],
  ['endorse', 'condemn'],
  ['attack', 'defend'],
];

// Legitimate predicate synonym clusters (preserve truth conditions under stylistic transformation)
export const PREDICATE_SYNONYMS = {
  deny: new Set(['deny', 'refute', 'reject', 'dispute', 'repudiate']),
  approve: new Set(['approve', 'endorse', 'authorize', 'sanction', 'validate', 'pass']),
  acquire: new Set(['acquire', 'purchase', 'buy', 'obtain', 'take over']),
  increase: new Set(['increase', 'grow', 'rise', 'climb', 'surge', 'expand']),
  decrease: new Set(['decrease', 'drop', 'fall', 'reduce', 'diminish']),
  support: new Set(['support', 'back', 'endorse', 'advocate', 'uphold']),
  allow: new Set(['allow', 'permit', 'enable', 'authorize']),
  prevent: new Set(['prevent', 'prohibit', 'forbid', 'bar', 'block']),
  require: new Set(['require', 'mandate', 'necessitate', 'demand', 'stipulate']),
  start: new Set(['start', 'begin', 'commence', 'initiate', 'launch']),
  stop: new Set(['stop', 'halt', 'cease', 'terminate', 'end']),
  hire: new Set(['hire', 'employ', 'recruit', 'onboard']),
  fire: new Set(['fire', 'dismiss', 'terminate']),
  praise: new Set(['praise', 'laud', 'commend', 'compliment']),
  criticize: new Set(['criticize', 'censure', 'fault']),
  install: new Set(['install', 'deploy', 'setup', 'mount']),
  uninstall: new Set(['uninstall', 'remove', 'unmount']),
  promote: new Set(['promote', 'advance', 'elevate']),
  demote: new Set(['demote', 'relegate']),
  create: new Set(['create', 'build', 'develop', 'produce']),
  delete: new Set(['delete', 'remove', 'erase', 'destroy']),
};

/**
 * Normalizes governing causal and relational markers to detect causal weakening.
 */
export function extractGoverningRelation(sentence) {
  if (!sentence) return null;
  const s = sentence.toLowerCase();

  if (/\b(caused|causes|causing|triggered|triggers|triggering|resulted in|results in|resulting in|led to|leads to|leading to|produced|produces|producing|brought about|bring about)\b/i.test(s)) {
    return 'CAUSED';
  }
  if (/\b(correlated with|correlates with|correlating with|associated with|associates with|coincided with|coincides with|linked to|links to)\b/i.test(s)) {
    return 'CORRELATED';
  }
  if (/\b(contributed to|contributes to|contributing to)\b/i.test(s)) {
    return 'CONTRIBUTED_TO';
  }
  if (/\b(preceded|precedes|preceding|occurred before|happened before|took place before)\b/i.test(s)) {
    return 'PRECEDED';
  }
  if (/\b(followed|follows|following|occurred after|happened after|took place after)\b/i.test(s)) {
    return 'FOLLOWED';
  }
  return null;
}

/**
 * Extracts the governing predicate action of a clause.
 * Prioritizes the verbal predicate rather than nominalized nouns in the subject.
 */
export function extractPredicateAction(sentence, parsedTriple = null) {
  if (!sentence) return null;

  // Use parsedTriple if available to search within the predicate phrase
  const triple = parsedTriple || parseGrammaticalTriple(sentence);
  const targetText = triple && triple.predicate ? `${triple.predicate} ${triple.object || ''}` : sentence;

  const words = targetText.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  for (const w of words) {
    if (PREDICATE_LEMMAS[w]) {
      return PREDICATE_LEMMAS[w];
    }
  }

  // Fallback: search sentence tokens from right-to-left to prefer main verbs over subject nouns
  const fullWords = sentence.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  for (let i = fullWords.length - 1; i >= 0; i--) {
    const w = fullWords[i];
    if (PREDICATE_LEMMAS[w]) {
      return PREDICATE_LEMMAS[w];
    }
  }
  return null;
}

// Qualifier boundary regex for comparative clause segmentation
export const MODIFIER_SPLIT_REGEX = /\b(except(?:\s+for|\s+when|\s+if)?|excluding|with the exception of|apart from|barring|subject to|unless|only if|only when|if|when|provided that|on condition that|as long as|in cases where|depending on|under|despite|while|during|before|after|prior to|subsequent to)\b/i;

export function segmentComparisonModifiers(rawText) {
  if (!rawText) return { cleanEntity: '', attachedModifiers: {} };

  const commaIdx = rawText.indexOf(',');
  const modMatch = MODIFIER_SPLIT_REGEX.exec(rawText);

  let cleanEntity = rawText.trim();
  let modifierText = '';

  if (modMatch) {
    if (commaIdx !== -1 && modMatch.index < commaIdx) {
      // Fronted modifier before comma: e.g. "Except under heavy writes, System A"
      modifierText = rawText.slice(modMatch.index, commaIdx).trim();
      cleanEntity = rawText.slice(commaIdx + 1).trim();
    } else if (commaIdx !== -1 && commaIdx < modMatch.index) {
      // Trailing modifier with comma: e.g. "System B, except under heavy writes"
      cleanEntity = rawText.slice(0, commaIdx).trim();
      modifierText = rawText.slice(modMatch.index).trim();
    } else {
      // Trailing modifier without comma: e.g. "System B except under heavy writes"
      cleanEntity = rawText.slice(0, modMatch.index).trim();
      modifierText = rawText.slice(modMatch.index).trim();
    }
  } else if (commaIdx !== -1) {
    cleanEntity = rawText.slice(0, commaIdx).trim();
    modifierText = rawText.slice(commaIdx + 1).trim();
  }

  cleanEntity = cleanEntity.replace(/^(?:Paragraph|Section|Step|Part)\s+\d+:\s*/i, '');
  cleanEntity = cleanEntity.replace(/[.,!?;:]+$/, '').trim();

  const attachedModifiers = {};
  if (modifierText) {
    const modLower = modifierText.toLowerCase();
    if (/\b(except|excluding|barring|apart from|with the exception of|subject to)\b/i.test(modLower)) {
      attachedModifiers.exception = modifierText;
    } else if (/\b(if|only if|unless|provided that|on condition that|as long as|when|only when|in cases where|depending on)\b/i.test(modLower)) {
      attachedModifiers.condition = modifierText;
    } else if (/\b(under|despite|while|during)\b/i.test(modLower)) {
      attachedModifiers.qualifier = modifierText;
    } else if (/\b(before|after|prior to|subsequent to)\b/i.test(modLower)) {
      attachedModifiers.temporal = modifierText;
    } else {
      attachedModifiers.other = modifierText;
    }
  }

  return { cleanEntity, attachedModifiers };
}

/**
 * Splits text into individual sentences with boundary preservation.
 */
export function extractSentences(text) {
  if (!text || typeof text !== 'string') return [];
  const clean = text.trim();
  if (!clean) return [];
  return clean.split(/(?<=[.?!])\s+/).filter(Boolean);
}

/**
 * Parses grammatical structure (Subject, Predicate, Object) using verbal anchors.
 */
function parseGrammaticalTriple(sentence) {
  const clean = sentence.trim().replace(/[.,!?;:]+$/, '');
  const tokens = clean.split(/\s+/);
  if (tokens.length <= 2) {
    return { subject: clean, predicate: '', object: '' };
  }

  // Common main, auxiliary, or lexical verb patterns to split subject and predicate
  const verbAnchorRegex = /\b(is|are|was|were|has|have|had|can|could|will|would|shall|should|may|might|must|caused|causes|correlated|led to|approved|approves|rejected|rejects|hired|hires|fired|fires|praised|criticized|installed|uninstalled|promoted|demoted|acquired|acquires|sold|integrated|integrates|created|creates|deleted|deletes|expanded|contracted|included|excludes|opened|closed|won|lost|admitted|denied|prohibited|allowed|failed|succeeded|joined|left|endorsed|condemned|ran|tested|costs|includes|supports|provides|allows|enables|requires|forbids|bans|export|exports|transfers?|improves?|improved|failed|crashed|reported|stated|believed|announced)\b/gi;
  let match;
  while ((match = verbAnchorRegex.exec(clean)) !== null) {
    const sub = clean.slice(0, match.index).trim();
    // If the subject before the verb is just a determiner (e.g. "The [acquired] startup"),
    // the matched verb is a participial modifier/adjective in the noun phrase, so keep searching
    if (!/^(?:the|a|an|this|that|these|those)$/i.test(sub)) {
      return {
        subject: sub,
        predicate: match[0],
        object: clean.slice(match.index + match[0].length).trim(),
      };
    }
  }

  const pastMatch = /\b([a-z]{3,}ed)\b/i.exec(clean);
  if (pastMatch && pastMatch.index > tokens[0].length) {
    const sub = clean.slice(0, pastMatch.index).trim();
    if (!/^(?:the|a|an|this|that|these|those)$/i.test(sub)) {
      return {
        subject: sub,
        predicate: pastMatch[0],
        object: clean.slice(pastMatch.index + pastMatch[0].length).trim(),
      };
    }
  }

  // Fallback to noun phrase heuristic:
  const isDet = /^(the|a|an|this|that|these|those)$/i.test(tokens[0]);
  const pivot = isDet && tokens.length > 3 ? 2 : Math.max(1, Math.floor(tokens.length / 3));

  return {
    subject: tokens.slice(0, pivot).join(' '),
    predicate: tokens.slice(pivot, pivot + 2).join(' '),
    object: tokens.slice(pivot + 2).join(' '),
  };
}

/**
 * Extracts conditional clauses (if, unless, only if, provided that, as long as).
 */
function extractSentenceConditions(sentence) {
  const conditions = [];
  const condRegex = /\b(only if|if|unless|provided that|on condition that|as long as|when)\s+([^,.;]+)/gi;
  let match;
  while ((match = condRegex.exec(sentence)) !== null) {
    conditions.push({
      marker: match[1].toLowerCase(),
      clause: match[2].trim(),
      raw: match[0].trim(),
    });
  }
  return conditions;
}

/**
 * Extracts exception clauses (except, excluding, with the exception of).
 */
function extractSentenceExceptions(sentence) {
  const exceptions = [];
  const excRegex = /\b(except(?:\s+for|\s+when|\s+if)?|excluding|with the exception of|apart from|barring|other than)\s+([^,.;]+)/gi;
  let match;
  while ((match = excRegex.exec(sentence)) !== null) {
    exceptions.push({
      marker: match[1].toLowerCase(),
      clause: match[2].trim(),
      raw: match[0].trim(),
    });
  }
  return exceptions;
}

/**
 * Extracts causal direction (cause -> effect).
 */
function extractSentenceCausality(sentence) {
  // Pattern 1: B resulted from A / B was caused by A (passive / inverse marker)
  const revResultRx = /(.+?)\s+(?:was caused by|were caused by|is caused by|are caused by|resulted from|results from|stemmed from|stems from|arose from|arises from)\s+(.+)/i;
  const rrMatch = revResultRx.exec(sentence);
  if (rrMatch) {
    return {
      cause: rrMatch[2].trim().replace(/[.,!?;:]+$/, ''),
      effect: rrMatch[1].trim().replace(/[.,!?;:]+$/, ''),
      direction: 'forward',
      marker: 'caused',
    };
  }

  // Pattern 2: A caused B / A led to B / A results in B
  const forwardRx = /(.+?)\s+(?:caused|led to|results? in|triggered|produced)\s+(.+)/i;
  const fMatch = forwardRx.exec(sentence);
  if (fMatch) {
    return {
      cause: fMatch[1].trim().replace(/[.,!?;:]+$/, ''),
      effect: fMatch[2].trim().replace(/[.,!?;:]+$/, ''),
      direction: 'forward',
      marker: 'caused',
    };
  }

  // Pattern 3: Because / Since / As a result of A, B
  const becauseRx = /\b(?:because of|because|since|due to|as a result of)\s+(.+?)(?:,\s*|\s+so\s+|\s+therefore\s+)(.+)/i;
  const bMatch = becauseRx.exec(sentence);
  if (bMatch) {
    return {
      cause: bMatch[1].trim().replace(/[.,!?;:]+$/, ''),
      effect: bMatch[2].trim().replace(/[.,!?;:]+$/, ''),
      direction: 'forward',
      marker: 'because',
    };
  }

  // Pattern 4: B because of A
  const revBecauseRx = /(.+?)\s+(?:because of|because|since|due to)\s+(.+)/i;
  const rbMatch = revBecauseRx.exec(sentence);
  if (rbMatch) {
    return {
      cause: rbMatch[2].trim().replace(/[.,!?;:]+$/, ''),
      effect: rbMatch[1].trim().replace(/[.,!?;:]+$/, ''),
      direction: 'forward',
      marker: 'because',
    };
  }

  return null;
}

export const COMPARISON_PROPERTIES = {
  // Speed
  faster: { property: 'speed', isSuperior: true, antonym: 'slower' },
  slower: { property: 'speed', isSuperior: false, antonym: 'faster' },

  // Cost
  cheaper: { property: 'cost', isSuperior: false, antonym: 'more expensive' },
  'more expensive': { property: 'cost', isSuperior: true, antonym: 'cheaper' },
  'less expensive': { property: 'cost', isSuperior: false, antonym: 'more expensive' },
  costlier: { property: 'cost', isSuperior: true, antonym: 'cheaper' },
  pricier: { property: 'cost', isSuperior: true, antonym: 'cheaper' },

  // Reliability
  'more reliable': { property: 'reliability', isSuperior: true, antonym: 'less reliable' },
  'less reliable': { property: 'reliability', isSuperior: false, antonym: 'more reliable' },

  // Level / Height
  higher: { property: 'level', isSuperior: true, antonym: 'lower' },
  lower: { property: 'level', isSuperior: false, antonym: 'higher' },

  // Magnitude
  greater: { property: 'magnitude', isSuperior: true, antonym: 'lower' },
  lesser: { property: 'magnitude', isSuperior: false, antonym: 'greater' },

  // Strength
  stronger: { property: 'strength', isSuperior: true, antonym: 'weaker' },
  weaker: { property: 'strength', isSuperior: false, antonym: 'stronger' },

  // Temporal
  earlier: { property: 'temporal', isSuperior: true, antonym: 'later' },
  later: { property: 'temporal', isSuperior: false, antonym: 'earlier' },

  // Size
  larger: { property: 'size', isSuperior: true, antonym: 'smaller' },
  bigger: { property: 'size', isSuperior: true, antonym: 'smaller' },
  smaller: { property: 'size', isSuperior: false, antonym: 'larger' },

  // Quality
  better: { property: 'quality', isSuperior: true, antonym: 'worse' },
  worse: { property: 'quality', isSuperior: false, antonym: 'better' },

  // Quantity / Degree
  more: { property: 'quantity', isSuperior: true, antonym: 'less' },
  less: { property: 'quantity', isSuperior: false, antonym: 'more' },
};

export function normalizeComparisonProperty(relation) {
  const cleanRel = relation.toLowerCase().trim();
  if (COMPARISON_PROPERTIES[cleanRel]) {
    return COMPARISON_PROPERTIES[cleanRel];
  }

  // Check more <adj> or less <adj>
  const moreMatch = cleanRel.match(/^more\s+([a-z]+)$/i);
  if (moreMatch) {
    return { property: moreMatch[1], isSuperior: true, antonym: `less ${moreMatch[1]}` };
  }
  const lessMatch = cleanRel.match(/^less\s+([a-z]+)$/i);
  if (lessMatch) {
    return { property: lessMatch[1], isSuperior: false, antonym: `more ${lessMatch[1]}` };
  }

  // Fallback
  const isLesser = cleanRel.startsWith('less') || cleanRel === 'slower' || cleanRel === 'worse' || cleanRel === 'smaller' || cleanRel === 'cheaper' || cleanRel === 'lower' || cleanRel === 'weaker';
  return {
    property: cleanRel.replace(/^(?:more|less)\s+/, ''),
    isSuperior: !isLesser,
    antonym: isLesser ? 'more' : 'less',
  };
}

/**
 * Extracts comparative direction (A is faster than B) with clean clause segmentation.
 * Strips attached qualifiers, exceptions, and conditions so entities remain pure.
 */
export function extractSentenceComparison(sentence) {
  const compRx = /(.+?)\s+(?:(must|should|can|could|would|might|may|will|shall)\s+)?(?:be|is|was|are|were|runs?|operates?|executes?|performs?|has|have|had|possesses?|uses?|processes?|consumes?|requires?)\s+(?:(significantly|substantially|considerably|noticeably|slightly|marginally|much|far)\s+)?([a-z]+er|more\s+[a-z]+|less\s+[a-z]+|more|less|better|worse)(?:\s+([a-z]+))?\s+than\s+(.+)/i;
  const match = compRx.exec(sentence);
  if (match) {
    const rawA = match[1].trim();
    const modality = match[2] ? match[2].toLowerCase().trim() : null;
    const quantifier = match[3] ? match[3].toLowerCase().trim() : null;
    const relation = match[4].toLowerCase().trim();
    const noun = match[5] ? match[5].toLowerCase().trim() : null;
    const rawB = match[6].trim().replace(/[.,!?;:]+$/, '');

    // Segment modifiers from entityA (e.g. leading "Except when caching is disabled, System A")
    const segA = segmentComparisonModifiers(rawA);
    const entityA = segA.cleanEntity || rawA;

    // Segment modifiers from entityB (e.g. "System B except when caching is disabled")
    const segB = segmentComparisonModifiers(rawB);
    const entityB = segB.cleanEntity || rawB;

    const propInfo = normalizeComparisonProperty(relation);
    const isSuperior = propInfo.isSuperior;
    const property = noun || propInfo.property;

    // Canonical representation: Always GREATER_THAN(superiorEntity, inferiorEntity)
    const canonicalLeft = isSuperior ? entityA : entityB;
    const canonicalRight = isSuperior ? entityB : entityA;

    return {
      relation: 'COMPARISON',
      property,
      operator: 'GREATER_THAN',
      left: canonicalLeft,
      right: canonicalRight,
      entityA,
      entityB,
      rawRelation: relation,
      isSuperior,
      direction: isSuperior ? 'A_greater' : 'B_greater',
      comparativeProperty: property,
      modality,
      quantifier,
      qualifiers: {
        ...segA.attachedModifiers,
        ...segB.attachedModifiers,
      },
      raw: match[0].trim(),
    };
  }
  return null;
}

/**
 * Extracts temporal order (event A before/after event B).
 */
function extractSentenceTemporal(sentence) {
  // Fronted temporal clause: e.g. "Prior to B, A occurred" / "Subsequent to B, A occurred"
  const frontedRx = /^\s*(before|after|prior to|subsequent to|following)\s+([^,]+),\s*(.+)/i;
  const fMatch = frontedRx.exec(sentence);
  if (fMatch) {
    const marker = fMatch[1].toLowerCase().trim();
    const eventB = fMatch[2].trim().replace(/[.,!?;:]+$/, '');
    const eventA = fMatch[3].trim().replace(/[.,!?;:]+$/, '');
    const relation = (marker === 'before' || marker === 'prior to') ? 'before' : 'after';
    return {
      eventA,
      relation,
      eventB,
      raw: fMatch[0].trim(),
    };
  }

  // Medial temporal marker: e.g. "A occurred before B"
  const tempRx = /(.+?)\s+(before|after|prior to|subsequent to|following|preceded|followed)\s+(.+)/i;
  const match = tempRx.exec(sentence);
  if (match) {
    const eventA = match[1].trim();
    const marker = match[2].toLowerCase().trim();
    const eventB = match[3].trim().replace(/[.,!?;:]+$/, '');
    const relation = (marker === 'before' || marker === 'prior to' || marker === 'preceded') ? 'before' : 'after';
    return {
      eventA,
      relation,
      eventB,
      raw: match[0].trim(),
    };
  }
  return null;
}

/**
 * Extracts single structured claim from sentence.
 */
export function extractClaimFromSentence(sentence, id = 'claim-1') {
  const clean = sentence.trim();
  const lower = clean.toLowerCase();

  // 1. Grammatical Core
  const { subject, predicate, object } = parseGrammaticalTriple(clean);

  // 2. Polarity & Negation Scope
  let polarity = 'positive';
  let negationScope = null;
  const negRx = /\b(not|never|no|neither|nor|cannot|can't|won't|don't|doesn't|didn't|isn't|aren't|wasn't|weren't|shouldn't|mustn't|without|unable|fails? to|prohibited|disallowed|negative)\b/i;
  // Comparative bounds like "no less than", "no fewer than", "not less than", "no more than", "not more than"
  // express boundary bounds rather than propositional negation.
  const cleanWithoutCompBounds = clean.replace(/\b(?:no|not)\s+(?:less|fewer|more)\s+than\b/gi, '');
  const negMatch = negRx.exec(cleanWithoutCompBounds);
  if (negMatch) {
    polarity = 'negative';
    negationScope = clean.slice(negMatch.index);
  }

  // 3. Modality & Certainty
  let modality = 'factual';
  for (const item of MODAL_LEXICON) {
    if (item.rx.test(lower)) {
      modality = item.level;
      break;
    }
  }

  // 4. Quantifiers & Scope
  // 4. Quantifiers & Scope & Negation Structure
  let quantifier = null;
  let scope = 'general';
  for (const qItem of QUANTIFIER_PATTERNS) {
    if (qItem.rx.test(lower)) {
      quantifier = qItem.quantifier;
      scope = qItem.scope;
      break;
    }
  }

  // Granular Scope and Negation Focus:
  // Differentiates:
  // - "Only managers approved all requests." (subject_focus)
  // - "Managers only approved all requests." (predicate_focus)
  // - "Not all managers approved all requests." (partial_subject_negation)
  // - "No managers approved all requests." (zero_subject_negation)
  // - "Managers did not approve all requests." (predicate_negation)
  let scopeFocus = 'neutral';
  let scopeStructure = 'standard';

  if (/^\s*(?:only|exclusively|solely)\s+/i.test(clean)) {
    scopeFocus = 'subject_focus';
    scopeStructure = 'exclusive_subject';
  } else if (/\b(?:only|exclusively|solely)\b/i.test(clean)) {
    scopeFocus = 'predicate_focus';
    scopeStructure = 'exclusive_action';
  }

  if (/^\s*not\s+(?:all|every)\b/i.test(clean)) {
    scopeFocus = 'partial_subject_negation';
    scopeStructure = 'not_all_subject';
  } else if (/^\s*(?:no|none\s+of\s+the)\b/i.test(clean)) {
    scopeFocus = 'zero_subject_negation';
    scopeStructure = 'no_subject';
  } else if (/\b(?:did\s+not|didn't|do\s+not|don't|does\s+not|doesn't|cannot)\s+/i.test(clean)) {
    if (scopeFocus === 'neutral') {
      scopeFocus = 'predicate_negation';
      scopeStructure = 'negated_predicate';
    }
  }

  // 5. Attribution
  let attribution = { source: null, status: 'direct_assertion' };
  for (const aItem of ATTRIBUTION_PATTERNS) {
    const match = aItem.rx.exec(clean);
    if (match) {
      attribution = {
        source: match[1]?.trim() || null,
        status: aItem.status,
      };
      break;
    }
  }

  // 6. Conditions & Exceptions
  const conditions = extractSentenceConditions(clean);
  const exceptions = extractSentenceExceptions(clean);

  // 7. Causality, Comparison, Temporal & Governing Relation
  const causality = extractSentenceCausality(clean);
  const governingRelation = extractGoverningRelation(clean);
  const comparison = extractSentenceComparison(clean);
  const temporalContext = extractSentenceTemporal(clean);

  // Sync comparison-attached modifiers with conditions/exceptions
  if (comparison?.qualifiers?.exception && exceptions.length === 0) {
    exceptions.push({
      marker: 'exception',
      clause: comparison.qualifiers.exception,
      raw: comparison.qualifiers.exception,
    });
  }
  if (comparison?.qualifiers?.condition && conditions.length === 0) {
    conditions.push({
      marker: 'condition',
      clause: comparison.qualifiers.condition,
      raw: comparison.qualifiers.condition,
    });
  }

  // 8. Core Predicate Action (prioritizes verbal phrase over subject nouns)
  const predicateAction = extractPredicateAction(clean, { subject, predicate, object });

  return {
    id,
    subject,
    predicate,
    predicateAction,
    governingRelation,
    object,
    polarity,
    negationScope,
    modality,
    certainty: MODALITY_LEVELS[modality]?.rank || 5,
    quantifier,
    scope,
    scopeFocus,
    scopeStructure,
    attribution,
    conditions,
    exceptions,
    causality,
    comparison,
    temporalContext,
    sourceSpan: clean,
  };
}

/**
 * Builds the complete ClaimGraph from document text.
 */
export function buildClaimGraph(text, _options = {}) {
  const sentences = extractSentences(text);
  const claims = sentences.map((s, idx) => extractClaimFromSentence(s, `claim-${idx + 1}`));

  // Resolve Anaphora / Coreference across sequential claims
  for (let idx = 0; idx < claims.length; idx++) {
    const claim = claims[idx];
    if (idx > 0) {
      const prevClaim = claims[idx - 1];
      const subLower = claim.subject.toLowerCase().trim();

      // Check for anaphoric subject (ignoring sentence-linking adverbs like then, subsequently, later)
      const cleanSub = subLower.replace(/\b(then|subsequently|later|also|further|promptly)\b/gi, '').trim();
      const isPronoun = /^(it|they|he|she|this|that)$/i.test(cleanSub);
      const isFormer = /\bthe\s+former\b/i.test(cleanSub);
      const isLatter = /\bthe\s+latter\b/i.test(cleanSub);
      const isDefiniteRole = /^(?:the|that|this)\s+(?:company|organization|firm|platform|system|team|algorithm|model|supplier|consultancy)$/i.test(cleanSub);
      const isAnimatePronoun = /^(he|she)$/i.test(cleanSub);
      const prevSubIsOrg = /\b(university|hospital|court|company|agency|firm|regulator|organization|council|bank|system)\b/i.test(prevClaim.subject);
      const prevObjIsPerson = /\b(speaker|employee|consultant|patient|applicant|student|thief|director|executive|author|editor)\b/i.test(prevClaim.object);

      if (isPronoun || isFormer || isLatter || isDefiniteRole) {
        let resolvedAntecedent = null;
        let alternateAntecedent = null;

        const prevObjIsOrg = /\b(consultancy|firm|agency|company|vendor|contractor|supplier|organization|corporation|subsidiary)\b/i.test(prevClaim.object);
        const subIsOrgSynonym = /\b(organization|firm|company|agency)\b/i.test(cleanSub);
        const prevSubIsOrgSynonym = /\b(organization|firm|company|agency)\b/i.test(prevClaim.subject);

        if (isFormer) {
          resolvedAntecedent = prevClaim.subject;
          alternateAntecedent = prevClaim.object;
        } else if (isLatter) {
          resolvedAntecedent = prevClaim.object;
          alternateAntecedent = prevClaim.subject;
        } else if (isAnimatePronoun && (prevSubIsOrg || prevObjIsPerson)) {
          // Animate gendered pronoun ("He"/"She") binds to animate person in object position when subject is institutional or inanimate
          resolvedAntecedent = prevClaim.object;
          alternateAntecedent = prevClaim.subject;
        } else if (isDefiniteRole && subIsOrgSynonym && prevObjIsOrg && !prevSubIsOrgSynonym) {
          // When subject is a non-org (e.g. "The client") and object is an org (e.g. "the consultancy"),
          // definite role "The organization" refers to the hired org in object position
          resolvedAntecedent = prevClaim.object;
          alternateAntecedent = prevClaim.subject;
        } else if (isDefiniteRole && /\b(supplier|consultancy)\b/i.test(cleanSub) && /\b(supplier|consultancy)\b/i.test(prevClaim.object)) {
          resolvedAntecedent = prevClaim.object;
          alternateAntecedent = prevClaim.subject;
        } else if (cleanSub.startsWith('that ') && prevClaim.object) {
          resolvedAntecedent = prevClaim.object;
          alternateAntecedent = prevClaim.subject;
        } else if (isPronoun || isDefiniteRole) {
          // Centering theory: Subject pronoun refers to previous sentence subject (agent)
          // Object of previous sentence is the alternate candidate
          resolvedAntecedent = prevClaim.subject;
          alternateAntecedent = prevClaim.object;
        }

        if (resolvedAntecedent) {
          claim.anaphora = {
            pronoun: subLower,
            resolvedAntecedent: resolvedAntecedent.trim(),
            alternateAntecedent: alternateAntecedent ? alternateAntecedent.trim() : null,
            antecedentRole: isLatter ? 'object' : 'subject',
          };
        }
      }
    }
  }

  // Extract document-level referents / entities
  const entityMap = new Map();
  const entityRx = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
  let match;
  while ((match = entityRx.exec(text || '')) !== null) {
    const ent = match[1];
    if (!['The', 'This', 'That', 'These', 'Those', 'What', 'When', 'Where', 'Why', 'How', 'Because', 'If'].includes(ent)) {
      entityMap.set(ent, (entityMap.get(ent) || 0) + 1);
    }
  }

  return {
    claims,
    entities: Object.fromEntries(entityMap),
    sentenceCount: sentences.length,
    rawText: text || '',
  };
}

/**
 * Compares source ClaimGraph against candidate ClaimGraph to find semantic divergences.
 */
export function compareClaimGraphs(sourceGraph, candidateGraph, _options = {}) {
  const violations = [];
  const srcClaims = sourceGraph.claims || [];
  const candClaims = candidateGraph.claims || [];

  for (let i = 0; i < srcClaims.length; i++) {
    const sClaim = srcClaims[i];

    // Find best corresponding candidate claim (by entity/noun overlap or sequential index)
    const stem = (w) => w.replace(/(?:ing|ed|ly|es|s)$/, '');
    const matchingCandClaim = candClaims.find((cClaim) => {
      const sWords = sClaim.sourceSpan.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter((w) => w.length > 3).map(stem);
      const cWords = cClaim.sourceSpan.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter((w) => w.length > 3).map(stem);
      const overlap = sWords.filter((w) => cWords.includes(w)).length;
      return overlap >= Math.min(2, Math.max(1, Math.floor(sWords.length / 2)));
    }) || candClaims[i];

    if (!matchingCandClaim) {
      // Check if candidate merged or subordinated this proposition into another clause
      const sStems = sClaim.sourceSpan.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter((w) => w.length > 3).map(stem);
      const cFullStems = candidateGraph.rawText.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter((w) => w.length > 3).map(stem);
      const rawOverlap = sStems.filter((w) => cFullStems.includes(w)).length;
      if (sStems.length > 0 && rawOverlap >= Math.min(2, Math.max(1, Math.floor(sStems.length / 2)))) {
        continue;
      }
      violations.push({
        type: 'CRITICAL_OMISSION',
        severity: 'CRITICAL',
        sourceSpan: sClaim.sourceSpan,
        problem: `Core proposition '${sClaim.sourceSpan}' was completely omitted from candidate.`,
        repairInstruction: `Restore the missing proposition: '${sClaim.sourceSpan}'.`,
      });
      continue;
    }

    // 1. Check Scope & "Only" Restriction Preservation
    if (sClaim.scope === 'restricted_only' && matchingCandClaim.scope !== 'restricted_only') {
      violations.push({
        type: 'SCOPE_RESTRICTION_REMOVED',
        severity: 'CRITICAL',
        sourceSpan: sClaim.sourceSpan,
        rewriteSpan: matchingCandClaim.sourceSpan,
        problem: `Exclusive scope restriction ('only/exclusively') on '${sClaim.subject}' was eliminated, turning a restricted rule into a universal permission.`,
        repairInstruction: `Preserve the exclusive restriction: specify that ONLY '${sClaim.subject}' is permitted.`,
      });
    }

    // 1b. Check Scope Focus and Scope Structure (Section 10)
    if (sClaim.scopeFocus && matchingCandClaim.scopeFocus && sClaim.scopeFocus !== 'neutral' && matchingCandClaim.scopeFocus !== 'neutral') {
      if (sClaim.scopeFocus !== matchingCandClaim.scopeFocus) {
        violations.push({
          type: 'SCOPE_FOCUS_MUTATION',
          severity: 'CRITICAL',
          sourceSpan: sClaim.sourceSpan,
          rewriteSpan: matchingCandClaim.sourceSpan,
          problem: `Scope focus altered: source had '${sClaim.scopeFocus}' but candidate has '${matchingCandClaim.scopeFocus}'.`,
          repairInstruction: `Preserve the exact scope focus (e.g. subject restriction vs action restriction).`,
        });
      }
    }
    if (sClaim.scopeStructure && matchingCandClaim.scopeStructure && sClaim.scopeStructure !== 'standard' && matchingCandClaim.scopeStructure !== 'standard') {
      if (sClaim.scopeStructure !== matchingCandClaim.scopeStructure) {
        violations.push({
          type: 'SCOPE_STRUCTURE_MUTATION',
          severity: 'CRITICAL',
          sourceSpan: sClaim.sourceSpan,
          rewriteSpan: matchingCandClaim.sourceSpan,
          problem: `Scope quantifier structure altered: source had '${sClaim.scopeStructure}' but candidate has '${matchingCandClaim.scopeStructure}'.`,
          repairInstruction: `Preserve the exact propositional quantifier structure.`,
        });
      }
    }

    // 2. Check Quantifier Mutation (e.g. some -> all)
    if (sClaim.quantifier && matchingCandClaim.quantifier && sClaim.quantifier !== matchingCandClaim.quantifier) {
      violations.push({
        type: 'QUANTIFIER_MUTATION',
        severity: 'CRITICAL',
        sourceSpan: sClaim.sourceSpan,
        rewriteSpan: matchingCandClaim.sourceSpan,
        problem: `Quantifier changed from '${sClaim.quantifier}' to '${matchingCandClaim.quantifier}', altering scale and truth conditions.`,
        repairInstruction: `Preserve the original quantifier '${sClaim.quantifier}'.`,
      });
    }

    // 3. Check Attribution / Epistemic Status Preservation
    if (sClaim.attribution.status !== 'direct_assertion' && matchingCandClaim.attribution.status === 'direct_assertion') {
      violations.push({
        type: 'ATTRIBUTION_DROPPED',
        severity: 'CRITICAL',
        sourceSpan: sClaim.sourceSpan,
        rewriteSpan: matchingCandClaim.sourceSpan,
        problem: `Attribution '${sClaim.attribution.status}' (source: ${sClaim.attribution.source || 'reported'}) was dropped, converting a reported claim into an unhedged direct fact.`,
        repairInstruction: `Re-anchor the claim to its original reporting source or belief status.`,
      });
    }

    // 4. Check Causality Direction (cause != effect)
    if (sClaim.causality) {
      if (!matchingCandClaim.causality) {
        // Check if candidate inverted cause and effect by text lookup
        const cLower = candidateGraph.rawText.toLowerCase();
        const causeWords = sClaim.causality.cause.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter((w) => w.length > 3);
        const effectWords = sClaim.causality.effect.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter((w) => w.length > 3);

        const causeInEffectPlace = effectWords.some((ew) => causeWords.some((cw) => new RegExp(`\\b${ew}\\b[^.?!]*\\b(caused|led to|triggered)\\b[^.?!]*\\b${cw}\\b`, 'i').test(cLower)));
        if (causeInEffectPlace) {
          violations.push({
            type: 'CAUSAL_INVERSION',
            severity: 'CRITICAL',
            sourceSpan: sClaim.sourceSpan,
            problem: `Causal relationship was inverted: '${sClaim.causality.effect}' was made the cause of '${sClaim.causality.cause}'.`,
            repairInstruction: `Ensure '${sClaim.causality.cause}' remains the cause and '${sClaim.causality.effect}' remains the result.`,
          });
        }
      } else {
        // Compare cause and effect tokens
        const sCauseLower = sClaim.causality.cause.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
        const cCauseLower = matchingCandClaim.causality.cause.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
        const sEffectLower = sClaim.causality.effect.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');

        // If candidate's cause matches source's effect
        const sEffectWords = sEffectLower.split(/\s+/).filter((w) => w.length > 3);
        const effectMatchesCandCause = sEffectWords.some((w) => cCauseLower.includes(w));
        const sCauseWords = sCauseLower.split(/\s+/).filter((w) => w.length > 3);
        const causeMatchesCandCause = sCauseWords.some((w) => cCauseLower.includes(w));

        if (effectMatchesCandCause && !causeMatchesCandCause) {
          violations.push({
            type: 'CAUSAL_INVERSION',
            severity: 'CRITICAL',
            sourceSpan: sClaim.sourceSpan,
            rewriteSpan: matchingCandClaim.sourceSpan,
            problem: `Causal relationship was inverted: effect was made into the cause.`,
            repairInstruction: `Ensure cause and effect order is preserved accurately.`,
          });
        }
      }
    }

    // 4b. Check Governing Causal Relation Mutation (e.g. caused -> correlated with)
    if (sClaim.governingRelation && matchingCandClaim.governingRelation) {
      if (sClaim.governingRelation === 'CAUSED' && matchingCandClaim.governingRelation === 'CORRELATED') {
        violations.push({
          type: 'CAUSAL_MUTATION',
          severity: 'CRITICAL',
          sourceSpan: sClaim.sourceSpan,
          rewriteSpan: matchingCandClaim.sourceSpan,
          problem: `Governing causal relation was mutated from direct causation ('CAUSED') to mere correlation ('CORRELATED').`,
          repairInstruction: `Preserve the strict causal relationship asserted in the source.`,
        });
      } else if (sClaim.governingRelation === 'CAUSED' && matchingCandClaim.governingRelation !== 'CAUSED') {
        violations.push({
          type: 'CAUSAL_MUTATION',
          severity: 'CRITICAL',
          sourceSpan: sClaim.sourceSpan,
          rewriteSpan: matchingCandClaim.sourceSpan,
          problem: `Governing causal relation was weakened from '${sClaim.governingRelation}' to '${matchingCandClaim.governingRelation}'.`,
          repairInstruction: `Preserve the governing causal relation: '${sClaim.governingRelation}'.`,
        });
      }
    }

    // 5. Check Conditional Prerequisites
    if (sClaim.conditions.length > 0 && matchingCandClaim.conditions.length === 0) {
      // Check if condition is present anywhere in candidate text
      const candFullText = candidateGraph.rawText.toLowerCase();
      const anyCondPresent = sClaim.conditions.some((c) => {
        const cWords = c.clause.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter((w) => w.length > 3);
        return cWords.length > 0 && cWords.every((w) => candFullText.includes(w));
      });

      if (!anyCondPresent) {
        violations.push({
          type: 'CONDITION_OMISSION',
          severity: 'CRITICAL',
          sourceSpan: sClaim.sourceSpan,
          rewriteSpan: matchingCandClaim.sourceSpan,
          problem: `Strict prerequisite condition ('${sClaim.conditions[0].raw}') was removed, converting conditional logic into unconditional assertion.`,
          repairInstruction: `Restore prerequisite condition: '${sClaim.conditions[0].raw}'.`,
        });
      }
    }

    // 6. Check Exception Clauses
    if (sClaim.exceptions.length > 0 && matchingCandClaim.exceptions.length === 0) {
      const candFullText = candidateGraph.rawText.toLowerCase();
      const anyExcPresent = sClaim.exceptions.some((e) => {
        const eWords = e.clause.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter((w) => w.length > 3);
        return eWords.length > 0 && eWords.every((w) => candFullText.includes(w));
      });

      if (!anyExcPresent) {
        violations.push({
          type: 'EXCEPTION_OMISSION',
          severity: 'CRITICAL',
          sourceSpan: sClaim.sourceSpan,
          rewriteSpan: matchingCandClaim.sourceSpan,
          problem: `Exception clause ('${sClaim.exceptions[0].raw}') was omitted, making a restricted rule falsely universal.`,
          repairInstruction: `Restore exception clause: '${sClaim.exceptions[0].raw}'.`,
        });
      }
    }

    // 7. Check Comparison Direction & Inversion
    if (sClaim.comparison) {
      const candFullText = candidateGraph.rawText.toLowerCase();
      const { entityA, relation, entityB, direction: _direction, operator: _operator, qualifiers = {} } = sClaim.comparison;

      const cleanA = entityA.replace(/[^a-z0-9 ]/gi, '').trim().toLowerCase();
      const cleanB = entityB.replace(/[^a-z0-9 ]/gi, '').trim().toLowerCase();

      // Check if matching candidate claim has structured comparison
      if (matchingCandClaim?.comparison) {
        const cComp = matchingCandClaim.comparison;
        const sComp = sClaim.comparison;

        const cleanSLeft = sComp.left.replace(/[^a-z0-9 ]/gi, '').trim().toLowerCase();
        const cleanSRight = sComp.right.replace(/[^a-z0-9 ]/gi, '').trim().toLowerCase();
        const cleanCLeft = cComp.left.replace(/[^a-z0-9 ]/gi, '').trim().toLowerCase();
        const cleanCRight = cComp.right.replace(/[^a-z0-9 ]/gi, '').trim().toLowerCase();

        // 1. If canonical forms match completely (same property, same left, same right):
        // Then this is semantically equivalent! (e.g. A faster than B <-> B slower than A)
        // Zero violation!
        if (sComp.property === cComp.property && cleanSLeft === cleanCLeft && cleanSRight === cleanCRight) {
          // Equivalence established - now verify attached modality and quantifier consistency
          if (sComp.modality || cComp.modality) {
            const sMod = sComp.modality ? sComp.modality.toLowerCase() : '';
            const cMod = cComp.modality ? cComp.modality.toLowerCase() : '';
            const strongMods = new Set(['must', 'shall', 'will', 'requires']);
            const weakMods = new Set(['might', 'may', 'could', 'can']);
            const isMismatch = (strongMods.has(sMod) && weakMods.has(cMod)) ||
                               (weakMods.has(sMod) && strongMods.has(cMod)) ||
                               (sMod && !cMod && !['will', 'is', 'was'].includes(sMod)) ||
                               (!sMod && cMod && weakMods.has(cMod));
            if (isMismatch) {
              violations.push({
                type: 'MODALITY_MUTATION',
                severity: 'CRITICAL',
                sourceSpan: sClaim.sourceSpan,
                rewriteSpan: matchingCandClaim.sourceSpan,
                problem: `Modal certainty in comparison mutated: source '${sMod || 'factual'}' changed to '${cMod || 'factual'}'.`,
                repairInstruction: `Preserve comparative modality: '${sMod || 'factual'}'.`,
              });
            }
          }

          if (sComp.quantifier || cComp.quantifier) {
            const sQuant = sComp.quantifier ? sComp.quantifier.toLowerCase() : '';
            const cQuant = cComp.quantifier ? cComp.quantifier.toLowerCase() : '';
            const highDegree = new Set(['significantly', 'substantially', 'considerably', 'much', 'far', 'noticeably']);
            const lowDegree = new Set(['slightly', 'marginally']);
            const isDegreeConflict = (highDegree.has(sQuant) && lowDegree.has(cQuant)) ||
                                     (lowDegree.has(sQuant) && highDegree.has(cQuant)) ||
                                     (highDegree.has(sQuant) && !cQuant) ||
                                     (lowDegree.has(sQuant) && !cQuant);
            if (isDegreeConflict) {
              violations.push({
                type: 'QUANTIFIER_MUTATION',
                severity: 'CRITICAL',
                sourceSpan: sClaim.sourceSpan,
                rewriteSpan: matchingCandClaim.sourceSpan,
                problem: `Comparison degree quantifier mutated: source '${sQuant || 'unquantified'}' changed to '${cQuant || 'unquantified'}'.`,
                repairInstruction: `Preserve comparative degree: '${sQuant || 'unquantified'}'.`,
              });
            }
          }
        } else if (cleanSLeft === cleanCRight && cleanSRight === cleanCLeft) {
          // Canonical inversion: candidate asserted GREATER_THAN(B, A) whereas source asserted GREATER_THAN(A, B)
          violations.push({
            type: 'COMPARISON_INVERSION',
            severity: 'CRITICAL',
            sourceSpan: sClaim.sourceSpan,
            rewriteSpan: matchingCandClaim.sourceSpan,
            problem: `Comparative hierarchy inverted: candidate asserted '${cComp.left}' exceeds '${cComp.right}' in ${sComp.property}, contradicting source where '${sComp.left}' exceeded '${sComp.right}'.`,
            repairInstruction: `Preserve comparative hierarchy: '${sComp.left}' exceeds '${sComp.right}' in ${sComp.property}.`,
          });
        } else if (sComp.property !== cComp.property) {
          violations.push({
            type: 'COMPARISON_INVERSION',
            severity: 'CRITICAL',
            sourceSpan: sClaim.sourceSpan,
            rewriteSpan: matchingCandClaim.sourceSpan,
            problem: `Comparative property changed from '${sComp.property}' to '${cComp.property}'.`,
            repairInstruction: `Preserve comparative property: '${sComp.property}'.`,
          });
        }
      } else {
        // Fallback: Check if candidate text explicitly asserts inverted comparison in text
        if (cleanA && cleanB) {
          const compInvRx = new RegExp(`\\b${cleanB}\\b[^.?!]*\\b(?:is|was|are|were|runs?|operates?|executes?|performs?)\\s+${sClaim.comparison.rawRelation || relation}\\s+than\\s+\\b${cleanA}\\b`, 'i');
          if (compInvRx.test(candFullText)) {
            violations.push({
              type: 'COMPARISON_INVERSION',
              severity: 'CRITICAL',
              sourceSpan: sClaim.sourceSpan,
              problem: `Comparative direction inverted: '${entityB}' was claimed to be ${relation} than '${entityA}'.`,
              repairInstruction: `Preserve comparative hierarchy: '${entityA}' is ${relation} than '${entityB}'.`,
            });
          }
        }
      }

      // Check preservation of attached modifiers on comparison (exception, condition, qualifier)
      if (qualifiers.exception) {
        const excWords = qualifiers.exception.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3);
        const excPresent = excWords.length > 0 && excWords.every((w) => candFullText.includes(w));
        if (!excPresent) {
          violations.push({
            type: 'EXCEPTION_OMISSION',
            severity: 'CRITICAL',
            sourceSpan: sClaim.sourceSpan,
            problem: `Exception attached to comparison ('${qualifiers.exception}') was omitted.`,
            repairInstruction: `Restore exception clause: '${qualifiers.exception}'.`,
          });
        }
      }
      if (qualifiers.condition) {
        const condWords = qualifiers.condition.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3);
        const condPresent = condWords.length > 0 && condWords.every((w) => candFullText.includes(w));
        if (!condPresent) {
          violations.push({
            type: 'CONDITION_OMISSION',
            severity: 'CRITICAL',
            sourceSpan: sClaim.sourceSpan,
            problem: `Prerequisite condition attached to comparison ('${qualifiers.condition}') was omitted.`,
            repairInstruction: `Restore prerequisite condition: '${qualifiers.condition}'.`,
          });
        }
      }
      if (qualifiers.temporal) {
        const tempWords = qualifiers.temporal.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3);
        const tempPresent = tempWords.length > 0 && tempWords.every((w) => candFullText.includes(w));
        if (!tempPresent) {
          violations.push({
            type: 'TEMPORAL_OMISSION',
            severity: 'CRITICAL',
            sourceSpan: sClaim.sourceSpan,
            problem: `Temporal modifier attached to comparison ('${qualifiers.temporal}') was omitted.`,
            repairInstruction: `Restore temporal reference: '${qualifiers.temporal}'.`,
          });
        }
      }
      if (qualifiers.qualifier) {
        const qualWords = qualifiers.qualifier.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3);
        const qualPresent = qualWords.length > 0 && qualWords.every((w) => candFullText.includes(w));
        if (!qualPresent) {
          violations.push({
            type: 'QUALIFIER_OMISSION',
            severity: 'CRITICAL',
            sourceSpan: sClaim.sourceSpan,
            problem: `Workload qualifier attached to comparison ('${qualifiers.qualifier}') was omitted.`,
            repairInstruction: `Restore qualifier clause: '${qualifiers.qualifier}'.`,
          });
        }
      }
    }

    // 8. Check Temporal Sequence (before vs after)
    if (sClaim.temporalContext) {
      if (matchingCandClaim.temporalContext && matchingCandClaim.temporalContext.relation !== sClaim.temporalContext.relation) {
        violations.push({
          type: 'TEMPORAL_INVERSION',
          severity: 'CRITICAL',
          sourceSpan: sClaim.sourceSpan,
          rewriteSpan: matchingCandClaim.sourceSpan,
          problem: `Temporal sequence inverted: event was stated to occur '${matchingCandClaim.temporalContext.relation}' instead of '${sClaim.temporalContext.relation}'.`,
          repairInstruction: `Preserve chronological order: '${sClaim.temporalContext.eventA}' occurred ${sClaim.temporalContext.relation} '${sClaim.temporalContext.eventB}'.`,
        });
      } else {
        const candFullText = candidateGraph.rawText.toLowerCase();
        const { eventA, relation, eventB } = sClaim.temporalContext;
        const oppositeRelation = relation === 'before' ? 'after' : 'before';

        const aWords = eventA.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
        const bWords = eventB.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2);

        if (aWords.length > 0 && bWords.length > 0) {
          const tempInvRx = new RegExp(`\\b${aWords[0]}\\b[^.?!]*\\b${oppositeRelation}\\b[^.?!]*\\b${bWords[0]}\\b`, 'i');
          if (tempInvRx.test(candFullText)) {
            violations.push({
              type: 'TEMPORAL_INVERSION',
              severity: 'CRITICAL',
              sourceSpan: sClaim.sourceSpan,
              problem: `Temporal sequence inverted: event was stated to occur '${oppositeRelation}' instead of '${relation}'.`,
              repairInstruction: `Preserve chronological order: '${eventA}' occurred ${relation} '${eventB}'.`,
            });
          }
        }
      }
    }

    // 9. Check Modality Gradient Shift
    if (sClaim.modality && matchingCandClaim.modality) {
      const sRank = MODALITY_LEVELS[sClaim.modality]?.rank || 5;
      const cRank = MODALITY_LEVELS[matchingCandClaim.modality]?.rank || 5;

      // Material shift: jump of 3+ ranks (e.g. possibility rank 1 -> certainty rank 8)
      if (sRank <= 3 && cRank >= 7) {
        violations.push({
          type: 'MODALITY_MUTATION',
          severity: 'CRITICAL',
          sourceSpan: sClaim.sourceSpan,
          rewriteSpan: matchingCandClaim.sourceSpan,
          problem: `Epistemic modality strengthened from uncertainty ('${sClaim.modality}') to definitive guarantee ('${matchingCandClaim.modality}').`,
          repairInstruction: `Maintain possibility/probability modality; do not claim absolute certainty.`,
        });
      } else if (sRank >= 6 && cRank <= 2) {
        violations.push({
          type: 'MODALITY_MUTATION',
          severity: 'CRITICAL',
          sourceSpan: sClaim.sourceSpan,
          rewriteSpan: matchingCandClaim.sourceSpan,
          problem: `Strict requirement ('${sClaim.modality}') was weakened into weak possibility ('${matchingCandClaim.modality}').`,
          repairInstruction: `Preserve requirement obligation.`,
        });
      }
    }

    // 10. Check Polarity / Negation Reversal
    if (sClaim.polarity !== matchingCandClaim.polarity) {
      // Check if discrepancy is caused by comparative bound idioms (e.g. "no less than" <-> "at least")
      const isCompBoundEquiv = (
        (/\b(?:no|not)\s+(?:less|fewer)\s+than\b/i.test(sClaim.sourceSpan) && /\bat least\b/i.test(matchingCandClaim.sourceSpan)) ||
        (/\bat least\b/i.test(sClaim.sourceSpan) && /\b(?:no|not)\s+(?:less|fewer)\s+than\b/i.test(matchingCandClaim.sourceSpan)) ||
        (/\b(?:no|not)\s+more\s+than\b/i.test(sClaim.sourceSpan) && /\bat most\b/i.test(matchingCandClaim.sourceSpan)) ||
        (/\bat most\b/i.test(sClaim.sourceSpan) && /\b(?:no|not)\s+more\s+than\b/i.test(matchingCandClaim.sourceSpan))
      );
      if (isCompBoundEquiv) {
        // Equivalent comparative boundary condition - preserve polarity equivalence
        continue;
      }

      let preservedInSplitOrMerge = false;

      if (sClaim.polarity === 'negative' && matchingCandClaim.polarity === 'positive') {
        const sWords = sClaim.sourceSpan.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter((w) => w.length > 3);
        preservedInSplitOrMerge = candClaims.some((c) => {
          if (c.polarity !== 'negative') return false;
          const cWords = c.sourceSpan.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter((w) => w.length > 3);
          return sWords.some((sw) => cWords.includes(sw));
        });
      } else if (sClaim.polarity === 'positive' && matchingCandClaim.polarity === 'negative') {
        const cWords = matchingCandClaim.sourceSpan.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter((w) => w.length > 3);
        preservedInSplitOrMerge = srcClaims.some((sc) => {
          if (sc.polarity !== 'negative') return false;
          const sWords = sc.sourceSpan.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter((w) => w.length > 3);
          return cWords.some((cw) => sWords.includes(cw));
        });
      }

      if (!preservedInSplitOrMerge) {
        violations.push({
          type: 'NEGATION_REVERSAL',
          severity: 'CRITICAL',
          sourceSpan: sClaim.sourceSpan,
          rewriteSpan: matchingCandClaim.sourceSpan,
          problem: `Proposition polarity reversed: source was ${sClaim.polarity} but candidate is ${matchingCandClaim.polarity}.`,
          repairInstruction: `Preserve claim polarity (${sClaim.polarity}).`,
        });
      }
    }

    // 11. Check Actor / Object Inversion
    if (sClaim.subject && sClaim.object && matchingCandClaim.subject && matchingCandClaim.object) {
      const sSubWords = sClaim.subject.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const sObjWords = sClaim.object.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const cSubWords = matchingCandClaim.subject.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const cObjWords = matchingCandClaim.object.toLowerCase().split(/\s+/).filter((w) => w.length > 3);

      const objBecameSubject = sObjWords.length > 0 && sObjWords.every((w) => cSubWords.includes(w));
      const subBecameObject = sSubWords.length > 0 && sSubWords.every((w) => cObjWords.includes(w));

      if (objBecameSubject && subBecameObject) {
        // Check if passive voice or inverse causal relation was used appropriately
        const isPassive = /\b(?:was|were|is|are|been|being)\s+(?:[a-z]+(?:ed|en|t)|written|made|built|done|paid|sold|spent|held|kept|told|read|won|lost|seen|chosen|given|found|driven|drawn|eaten|run|shut|cut|set|put|split)(?:\s+(?:up|out|down|over|back|off|in|away|on))?\s+by\b/i.test(matchingCandClaim.sourceSpan) ||
          /\b(?:resulted from|stemmed from|arose from|originated from|due to)\b/i.test(matchingCandClaim.sourceSpan);
        const sObjIsPrepAdjunct = /^(?:in|at|on|during|for|with|by|from|to)\s+/i.test(sClaim.object.trim()) ||
          /\b(?:in|at|on|during|for|with|by|from|to|into)$/i.test(sClaim.predicate.trim());

        if (!isPassive && !sObjIsPrepAdjunct) {
          violations.push({
            type: 'RELATION_INVERSION',
            severity: 'CRITICAL',
            sourceSpan: sClaim.sourceSpan,
            rewriteSpan: matchingCandClaim.sourceSpan,
            problem: `Grammatical roles inverted without passive voice: '${sClaim.object}' was made the actor acting upon '${sClaim.subject}'.`,
            repairInstruction: `Ensure '${sClaim.subject}' remains the active actor.`,
          });
        }
      }
    }

    // 11b. Check Anaphora & Coreference preservation (Section 9)
    if (sClaim.anaphora && sClaim.anaphora.resolvedAntecedent) {
      const resAntLower = sClaim.anaphora.resolvedAntecedent.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      const altAntLower = sClaim.anaphora.alternateAntecedent ? sClaim.anaphora.alternateAntecedent.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim() : null;
      const candSubLower = matchingCandClaim.subject.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      const candCleanSub = candSubLower.replace(/\b(then|subsequently|later|also|further|promptly)\b/gi, '').trim();

      // If candidate explicit subject matches the alternate (incorrect) antecedent or refers to the patient/acquired entity
      const isPatientRole = /\b(?:the\s+)?acquired\s+(?:startup|firm|company|entity|platform|asset)\b/i.test(candCleanSub);
      if (isPatientRole || (altAntLower && (candCleanSub.includes(altAntLower) || candSubLower.includes(altAntLower)) && !candSubLower.includes(resAntLower))) {
        violations.push({
          type: 'COREFERENCE_ROLE_MUTATION',
          severity: 'CRITICAL',
          sourceSpan: sClaim.sourceSpan,
          rewriteSpan: matchingCandClaim.sourceSpan,
          problem: `Anaphoric subject role was mutated to '${matchingCandClaim.subject}' instead of '${sClaim.anaphora.resolvedAntecedent}'.`,
          repairInstruction: `Preserve the correct antecedent for anaphoric reference: '${sClaim.anaphora.resolvedAntecedent}'.`,
        });
      }
    }

    // 12. Check Proposition & Predicate Preservation (Detect Predicate Drift / Mutation)
    if (sClaim.predicateAction && matchingCandClaim?.predicateAction) {
      const sAction = sClaim.predicateAction;
      const cAction = matchingCandClaim.predicateAction;

      if (sAction !== cAction) {
        const isSynonym = PREDICATE_SYNONYMS[sAction]?.has(cAction);
        const isIncompatible = INCOMPATIBLE_PREDICATE_PAIRS.some(
          ([p1, p2]) => (sAction === p1 && cAction === p2) || (sAction === p2 && cAction === p1)
        );

        // Check morphological antonym prefixes (e.g. install vs uninstall, activate vs deactivate)
        const isPrefixAntonym =
          cAction === `un${sAction}` || sAction === `un${cAction}` ||
          cAction === `de${sAction}` || sAction === `de${cAction}` ||
          cAction === `dis${sAction}` || sAction === `dis${cAction}` ||
          cAction === `in${sAction}` || sAction === `in${cAction}`;

        if (!isSynonym && (isIncompatible || isPrefixAntonym || sClaim.polarity === 'negative')) {
          violations.push({
            type: 'PREDICATE_MUTATION',
            severity: 'CRITICAL',
            sourceSpan: sClaim.sourceSpan,
            rewriteSpan: matchingCandClaim.sourceSpan,
            problem: `Predicate action materially altered: '${sAction}' was replaced with '${cAction}'${sClaim.polarity === 'negative' ? ' under identical negative polarity' : ''}, altering the core proposition.`,
            repairInstruction: `Preserve the original predicate action: '${sAction}'.`,
          });
        }
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    criticalCount: violations.filter((v) => v.severity === 'CRITICAL').length,
    highCount: violations.filter((v) => v.severity === 'HIGH').length,
  };
}
