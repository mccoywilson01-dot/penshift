/**
 * PenShift Protected Span Engine
 * Detects, classifies, normalizes, and verifies semantically immutable text spans.
 */

// Number word to digit mapping for deterministic invariant checks
const NUMBER_WORD_MAP = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000,
  million: 1000000, billion: 1000000000,
};

export const LITERAL_PROTECTION_TYPES = new Set([
  'url',
  'email',
  'code',
  'identifier',
  'numeric',
  'percentage',
  'equation',
  'file_path',
  'version',
  'citation',
]);

/**
 * Normalizes numbers from strings or words.
 */
export function normalizeNumber(valStr) {
  if (typeof valStr !== 'string') return null;
  const cleaned = valStr.trim().toLowerCase().replace(/,/g, '');

  // Check if it represents a percentage
  const isPercent = cleaned.endsWith('%') || /\b(percent|percentage)\b/.test(cleaned);
  const strippedPercent = cleaned.replace(/%|\b(percent|percentage)\b/g, '').trim();

  // If percentage: normalize base number and append %
  if (isPercent) {
    const numDigits = parseFloat(strippedPercent);
    if (!Number.isNaN(numDigits) && /^-?\d+(?:\.\d+)?$/.test(strippedPercent)) {
      return `${numDigits}%`;
    }
    const words = strippedPercent.split(/[\s-]+/);
    let total = 0;
    let current = 0;
    let matchedWord = false;
    for (const w of words) {
      const numD = parseFloat(w);
      const val = (!Number.isNaN(numD) && /^-?\d+(?:\.\d+)?$/.test(w)) ? numD : NUMBER_WORD_MAP[w];
      if (val !== undefined) {
        matchedWord = true;
        if (val === 100) {
          current = (current || 1) * 100;
        } else if (val >= 1000) {
          total += (current || 1) * val;
          current = 0;
        } else {
          current += val;
        }
      }
    }
    if (matchedWord) {
      total += current;
      return `${total}%`;
    }
    return `${strippedPercent}%`;
  }

  // Currency check: short prefix like $500k, $10m, $10b
  const currMatch = cleaned.match(/^([$€£¥₹])\s*([0-9.]+)([kKmMbB])?$/);
  if (currMatch) {
    let mult = 1;
    if (currMatch[3]?.toLowerCase() === 'k') mult = 1e3;
    if (currMatch[3]?.toLowerCase() === 'm') mult = 1e6;
    if (currMatch[3]?.toLowerCase() === 'b') mult = 1e9;
    return `${currMatch[1]}${parseFloat(currMatch[2]) * mult}`;
  }

  // Optional currency prefix extraction
  const prefixMatch = cleaned.match(/^([$€£¥₹])\s*/);
  const prefix = prefixMatch ? prefixMatch[1] : '';
  const core = prefixMatch ? cleaned.slice(prefixMatch[0].length).trim() : cleaned;

  // Plain numeric digits
  const num = parseFloat(core);
  if (!Number.isNaN(num) && /^-?\d+(?:\.\d+)?$/.test(core)) {
    return prefix ? `${prefix}${num}` : String(num);
  }

  // Compound number words or digit + magnitude words (e.g. "twenty five", "10 billion", "three hundred")
  const withoutCurrencyWord = core.replace(/\s*(?:dollars?|euros?|pounds?|yen|rupees?|usd|eur|gbp|jpy|inr)\b/gi, '').trim();
  const words = withoutCurrencyWord.split(/[\s-]+/);
  let total = 0;
  let current = 0;
  let matchedWord = false;

  for (const w of words) {
    const numD = parseFloat(w);
    const val = (!Number.isNaN(numD) && /^-?\d+(?:\.\d+)?$/.test(w)) ? numD : NUMBER_WORD_MAP[w];
    if (val !== undefined) {
      matchedWord = true;
      if (val === 100) {
        current = (current || 1) * 100;
      } else if (val >= 1000) {
        total += (current || 1) * val;
        current = 0;
      } else {
        current += val;
      }
    }
  }
  if (matchedWord) {
    total += current;
    return prefix ? `${prefix}${total}` : String(total);
  }

  return cleaned;
}

export const UNIT_NORMALIZATION_MAP = {
  // Time units
  ms: { normalized: 'millisecond', dimension: 'time' },
  millisecond: { normalized: 'millisecond', dimension: 'time' },
  milliseconds: { normalized: 'millisecond', dimension: 'time' },
  s: { normalized: 'second', dimension: 'time' },
  sec: { normalized: 'second', dimension: 'time' },
  secs: { normalized: 'second', dimension: 'time' },
  second: { normalized: 'second', dimension: 'time' },
  seconds: { normalized: 'second', dimension: 'time' },
  min: { normalized: 'minute', dimension: 'time' },
  mins: { normalized: 'minute', dimension: 'time' },
  minute: { normalized: 'minute', dimension: 'time' },
  minutes: { normalized: 'minute', dimension: 'time' },
  h: { normalized: 'hour', dimension: 'time' },
  hr: { normalized: 'hour', dimension: 'time' },
  hrs: { normalized: 'hour', dimension: 'time' },
  hour: { normalized: 'hour', dimension: 'time' },
  hours: { normalized: 'hour', dimension: 'time' },
  day: { normalized: 'day', dimension: 'time' },
  days: { normalized: 'day', dimension: 'time' },
  week: { normalized: 'week', dimension: 'time' },
  weeks: { normalized: 'week', dimension: 'time' },
  month: { normalized: 'month', dimension: 'time' },
  months: { normalized: 'month', dimension: 'time' },
  year: { normalized: 'year', dimension: 'time' },
  years: { normalized: 'year', dimension: 'time' },

  // Distance units
  mm: { normalized: 'millimeter', dimension: 'length' },
  millimeter: { normalized: 'millimeter', dimension: 'length' },
  millimeters: { normalized: 'millimeter', dimension: 'length' },
  cm: { normalized: 'centimeter', dimension: 'length' },
  centimeter: { normalized: 'centimeter', dimension: 'length' },
  centimeters: { normalized: 'centimeter', dimension: 'length' },
  m: { normalized: 'meter', dimension: 'length' },
  meter: { normalized: 'meter', dimension: 'length' },
  meters: { normalized: 'meter', dimension: 'length' },
  km: { normalized: 'kilometer', dimension: 'length' },
  kilometer: { normalized: 'kilometer', dimension: 'length' },
  kilometers: { normalized: 'kilometer', dimension: 'length' },
  in: { normalized: 'inch', dimension: 'length' },
  inch: { normalized: 'inch', dimension: 'length' },
  inches: { normalized: 'inch', dimension: 'length' },
  ft: { normalized: 'foot', dimension: 'length' },
  foot: { normalized: 'foot', dimension: 'length' },
  feet: { normalized: 'foot', dimension: 'length' },
  yd: { normalized: 'yard', dimension: 'length' },
  yard: { normalized: 'yard', dimension: 'length' },
  yards: { normalized: 'yard', dimension: 'length' },
  mi: { normalized: 'mile', dimension: 'length' },
  mile: { normalized: 'mile', dimension: 'length' },
  miles: { normalized: 'mile', dimension: 'length' },

  // Mass units
  mg: { normalized: 'milligram', dimension: 'mass' },
  milligram: { normalized: 'milligram', dimension: 'mass' },
  milligrams: { normalized: 'milligram', dimension: 'mass' },
  g: { normalized: 'gram', dimension: 'mass' },
  gram: { normalized: 'gram', dimension: 'mass' },
  grams: { normalized: 'gram', dimension: 'mass' },
  kg: { normalized: 'kilogram', dimension: 'mass' },
  kilogram: { normalized: 'kilogram', dimension: 'mass' },
  kilograms: { normalized: 'kilogram', dimension: 'mass' },
  oz: { normalized: 'ounce', dimension: 'mass' },
  ounce: { normalized: 'ounce', dimension: 'mass' },
  ounces: { normalized: 'ounce', dimension: 'mass' },
  lb: { normalized: 'pound', dimension: 'mass' },
  lbs: { normalized: 'pound', dimension: 'mass' },
  pound: { normalized: 'pound', dimension: 'mass' },
  pounds: { normalized: 'pound', dimension: 'mass' },

  // Digital Storage / Data units
  b: { normalized: 'byte', dimension: 'data' },
  byte: { normalized: 'byte', dimension: 'data' },
  bytes: { normalized: 'byte', dimension: 'data' },
  kb: { normalized: 'kilobyte', dimension: 'data' },
  kilobyte: { normalized: 'kilobyte', dimension: 'data' },
  kilobytes: { normalized: 'kilobyte', dimension: 'data' },
  mb: { normalized: 'megabyte', dimension: 'data' },
  'mb/s': { normalized: 'megabytes_per_second', dimension: 'bandwidth' },
  'megabytes per second': { normalized: 'megabytes_per_second', dimension: 'bandwidth' },
  megabyte: { normalized: 'megabyte', dimension: 'data' },
  megabytes: { normalized: 'megabyte', dimension: 'data' },
  gb: { normalized: 'gigabyte', dimension: 'data' },
  gigabyte: { normalized: 'gigabyte', dimension: 'data' },
  gigabytes: { normalized: 'gigabyte', dimension: 'data' },
  tb: { normalized: 'terabyte', dimension: 'data' },
  terabyte: { normalized: 'terabyte', dimension: 'data' },
  terabytes: { normalized: 'terabyte', dimension: 'data' },

  // Temperature units
  c: { normalized: 'celsius', dimension: 'temperature' },
  '°c': { normalized: 'celsius', dimension: 'temperature' },
  celsius: { normalized: 'celsius', dimension: 'temperature' },
  'degrees celsius': { normalized: 'celsius', dimension: 'temperature' },
  f: { normalized: 'fahrenheit', dimension: 'temperature' },
  '°f': { normalized: 'fahrenheit', dimension: 'temperature' },
  fahrenheit: { normalized: 'fahrenheit', dimension: 'temperature' },
  'degrees fahrenheit': { normalized: 'fahrenheit', dimension: 'temperature' },

  // Currency
  $: { normalized: 'USD', dimension: 'currency' },
  usd: { normalized: 'USD', dimension: 'currency' },
  dollar: { normalized: 'USD', dimension: 'currency' },
  dollars: { normalized: 'USD', dimension: 'currency' },
  '€': { normalized: 'EUR', dimension: 'currency' },
  eur: { normalized: 'EUR', dimension: 'currency' },
  euro: { normalized: 'EUR', dimension: 'currency' },
  euros: { normalized: 'EUR', dimension: 'currency' },
  '£': { normalized: 'GBP', dimension: 'currency' },
  gbp: { normalized: 'GBP', dimension: 'currency' },
  '¥': { normalized: 'JPY', dimension: 'currency' },
  jpy: { normalized: 'JPY', dimension: 'currency' },
  yen: { normalized: 'JPY', dimension: 'currency' },
  '₹': { normalized: 'INR', dimension: 'currency' },
  inr: { normalized: 'INR', dimension: 'currency' },
  rupee: { normalized: 'INR', dimension: 'currency' },
  rupees: { normalized: 'INR', dimension: 'currency' },

  // Percent / Ratio
  '%': { normalized: 'percent', dimension: 'ratio' },
  percent: { normalized: 'percent', dimension: 'ratio' },
  percentage: { normalized: 'percent', dimension: 'ratio' },
  'percentage point': { normalized: 'percentage_point', dimension: 'difference' },
  'percentage points': { normalized: 'percentage_point', dimension: 'difference' },
  'percentage pt': { normalized: 'percentage_point', dimension: 'difference' },
  'percentage pts': { normalized: 'percentage_point', dimension: 'difference' },
  'basis point': { normalized: 'basis_point', dimension: 'difference' },
  'basis points': { normalized: 'basis_point', dimension: 'difference' },
  bps: { normalized: 'basis_point', dimension: 'difference' },

  // Rate / Frequency
  '/s': { normalized: 'per_second', dimension: 'rate' },
  'per second': { normalized: 'per_second', dimension: 'rate' },
  '/min': { normalized: 'per_minute', dimension: 'rate' },
  'per minute': { normalized: 'per_minute', dimension: 'rate' },
  '/hr': { normalized: 'per_hour', dimension: 'rate' },
  'per hour': { normalized: 'per_hour', dimension: 'rate' },
  '/day': { normalized: 'per_day', dimension: 'rate' },
  'per day': { normalized: 'per_day', dimension: 'rate' },
  '/week': { normalized: 'per_week', dimension: 'rate' },
  'per week': { normalized: 'per_week', dimension: 'rate' },
  '/month': { normalized: 'per_month', dimension: 'rate' },
  'per month': { normalized: 'per_month', dimension: 'rate' },
  '/year': { normalized: 'per_year', dimension: 'rate' },
  'per year': { normalized: 'per_year', dimension: 'rate' },
  'transactions per second': { normalized: 'per_second', dimension: 'rate' },
  'transactions per minute': { normalized: 'per_minute', dimension: 'rate' },
  'transactions per hour': { normalized: 'per_hour', dimension: 'rate' },
  'transactions per day': { normalized: 'per_day', dimension: 'rate' },
  'items per second': { normalized: 'per_second', dimension: 'rate' },
  'items per minute': { normalized: 'per_minute', dimension: 'rate' },
  'items per hour': { normalized: 'per_hour', dimension: 'rate' },
  'items per day': { normalized: 'per_day', dimension: 'rate' },
  'requests per second': { normalized: 'per_second', dimension: 'rate' },
  'requests per minute': { normalized: 'per_minute', dimension: 'rate' },
  'requests per hour': { normalized: 'per_hour', dimension: 'rate' },
  'requests per day': { normalized: 'per_day', dimension: 'rate' },
  rps: { normalized: 'per_second', dimension: 'rate' },
  qps: { normalized: 'per_second', dimension: 'rate' },
};

export function normalizeMeasurementUnit(unitStr) {
  if (!unitStr) return null;
  const clean = unitStr.trim().toLowerCase();
  return UNIT_NORMALIZATION_MAP[clean] || null;
}

export const CURRENCY_MAP = {
  $: 'USD',
  usd: 'USD',
  dollar: 'USD',
  dollars: 'USD',
  '€': 'EUR',
  eur: 'EUR',
  euro: 'EUR',
  euros: 'EUR',
  '£': 'GBP',
  gbp: 'GBP',
  pound: 'GBP',
  pounds: 'GBP',
  '¥': 'JPY',
  jpy: 'JPY',
  yen: 'JPY',
  '₹': 'INR',
  inr: 'INR',
  rupee: 'INR',
  rupees: 'INR',
};

export function normalizeCurrencyCode(token) {
  if (!token) return null;
  const clean = token.toLowerCase().trim();
  return CURRENCY_MAP[clean] || null;
}

/**
 * Extracts measurements binding numerical quantity to its measurement unit and currency.
 * Handles currency prefix/suffix validation and detects conflicting representations.
 */
export function extractMeasurements(text) {
  if (!text || typeof text !== 'string') return [];
  const measurements = [];

  // Match optional currency prefix, then compound number phrase or digits with scale
  const wordUnitsList = Object.keys(NUMBER_WORD_MAP);
  const numRegex = new RegExp(
    `(?:([$€£¥₹])\\s*)?(\\b\\d+(?:,\\d{3})*(?:\\.\\d+)?(?:\\s*(?:billion|million|thousand|hundred)\\b)?|\\b(?:${wordUnitsList.join('|')})(?:[\\s-]+(?:${wordUnitsList.join('|')}))*\\b)`,
    'gi'
  );

  let match;
  while ((match = numRegex.exec(text)) !== null) {
    const prefixCurr = match[1];
    const valRaw = match[2];
    const numEndIndex = match.index + match[0].length;

    const normVal = normalizeNumber(valRaw);
    if (!normVal) continue;

    const pureNumericValue = normVal.replace(/^[$€£¥₹]/, '');
    const prefixIso = normalizeCurrencyCode(prefixCurr);

    const remainingText = text.slice(numEndIndex).trimStart();
    const wordsMatch = remainingText.match(/^([%$€£¥₹°]|[a-zA-Z°/]+(?:\s+[a-zA-Z°/]+){0,2})/);

    let suffixInfo = null;
    let matchedSuffixRaw = null;

    if (wordsMatch) {
      const candidateWords = wordsMatch[1].trim().split(/\s+/);
      for (let len = candidateWords.length; len >= 1; len--) {
        const phrase = candidateWords.slice(0, len).join(' ');
        const info = normalizeMeasurementUnit(phrase);
        if (info) {
          matchedSuffixRaw = phrase;
          suffixInfo = info;
          break;
        }
      }
    }

    const suffixIso = suffixInfo?.dimension === 'currency' ? suffixInfo.normalized : normalizeCurrencyCode(matchedSuffixRaw);

    // Case 1: Both prefix and suffix present
    if (prefixIso && suffixIso) {
      if (prefixIso === suffixIso) {
        // Both agree: e.g. "$500 USD" or "€500 EUR"
        measurements.push({
          value: valRaw,
          normalizedValue: pureNumericValue,
          unit: `${prefixCurr} ... ${matchedSuffixRaw}`,
          normalizedUnit: prefixIso,
          currency: prefixIso,
          currencySource: 'both',
          hasConflict: false,
          conflictType: null,
          dimension: 'currency',
        });
      } else {
        // Conflicting representations: e.g. "$500 EUR" or "€500 USD"
        measurements.push({
          value: valRaw,
          normalizedValue: pureNumericValue,
          unit: `${prefixCurr} ... ${matchedSuffixRaw}`,
          normalizedUnit: `CONFLICT_${prefixIso}_${suffixIso}`,
          currency: `CONFLICT:${prefixIso}_vs_${suffixIso}`,
          currencySource: 'conflicting',
          hasConflict: true,
          conflictType: 'CURRENCY_REPRESENTATION_CONFLICT',
          dimension: 'currency',
        });
      }
      continue;
    }

    // Case 2: Currency prefix only: e.g. "$500"
    if (prefixIso && (!suffixInfo || suffixInfo.dimension !== 'currency')) {
      measurements.push({
        value: valRaw,
        normalizedValue: pureNumericValue,
        unit: prefixCurr,
        normalizedUnit: prefixIso,
        currency: prefixIso,
        currencySource: 'prefix',
        hasConflict: false,
        conflictType: null,
        dimension: 'currency',
      });
      continue;
    }

    // Case 3: Currency suffix only: e.g. "500 USD" or "500 EUR"
    if (!prefixIso && suffixIso) {
      measurements.push({
        value: valRaw,
        normalizedValue: pureNumericValue,
        unit: matchedSuffixRaw,
        normalizedUnit: suffixIso,
        currency: suffixIso,
        currencySource: 'suffix',
        hasConflict: false,
        conflictType: null,
        dimension: 'currency',
      });
      continue;
    }

    // Case 4: Non-currency unit measurement (time, length, mass, data, rate, ratio, etc.)
    if (suffixInfo && matchedSuffixRaw) {
      measurements.push({
        value: valRaw,
        normalizedValue: pureNumericValue,
        unit: matchedSuffixRaw,
        normalizedUnit: suffixInfo.normalized,
        dimension: suffixInfo.dimension,
        hasConflict: false,
        conflictType: null,
      });
    }
  }

  return measurements;
}

/**
 * Normalizes dates to standard comparable format where possible.
 */
export function normalizeDate(dateStr) {
  if (!dateStr) return '';
  const cleaned = dateStr.trim().replace(/(\d+)(st|nd|rd|th)/gi, '$1');
  const d = new Date(cleaned);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return cleaned.toLowerCase();
}

/**
 * Extracts protected spans from text.
 * Each span: { type, value, normalizedValue, start, end, criticality }
 */
export function extractProtectedSpans(text) {
  if (!text || typeof text !== 'string') return [];
  const spans = [];
  const spanOverlap = new Array(text.length).fill(false);

  function addSpan(type, value, start, end, criticality = 'high') {
    if (start < 0 || end > text.length || start >= end) return;
    for (let i = start; i < end; i++) {
      if (spanOverlap[i]) return; // Avoid duplicate overlapping spans
    }
    for (let i = start; i < end; i++) {
      spanOverlap[i] = true;
    }

    let normalizedValue = value.trim();
    if (type === 'numeric' || type === 'percentage' || type === 'currency') {
      normalizedValue = normalizeNumber(value);
    } else if (type === 'date') {
      normalizedValue = normalizeDate(value);
    } else if (type === 'url' || type === 'email') {
      normalizedValue = value.trim().toLowerCase();
    }

    spans.push({
      type,
      value: value.trim(),
      normalizedValue,
      start,
      end,
      criticality,
    });
  }

  // 1. Code blocks (```...```) and inline code (`...`)
  const codeBlockRegex = /```[\s\S]*?```|`[^`\n]+`/g;
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    addSpan('code', match[0], match.index, match.index + match[0].length, 'literal');
  }

  // 2. URLs
  const urlRegex = /\bhttps?:\/\/[^\s)\]>"'’`]+/gi;
  while ((match = urlRegex.exec(text)) !== null) {
    addSpan('url', match[0], match.index, match.index + match[0].length, 'literal');
  }

  // 3. Email addresses
  const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
  while ((match = emailRegex.exec(text)) !== null) {
    addSpan('email', match[0], match.index, match.index + match[0].length, 'literal');
  }

  // 4. File paths
  const filePathRegex = /(?:^|\s)((\/[a-zA-Z0-9_.-]+){2,}|[a-zA-Z]:\\[a-zA-Z0-9_.\\]+|\.\/[a-zA-Z0-9_.-]+)/g;
  while ((match = filePathRegex.exec(text)) !== null) {
    const raw = match[1];
    const idx = match.index + (match[0].length - raw.length);
    addSpan('file_path', raw, idx, idx + raw.length, 'literal');
  }

  // 5. Version numbers & Git commit hashes
  const versionRegex = /\bv?(?:[0-9]+\.){1,3}[0-9]+(?:-[a-zA-Z0-9.]+)?\b|\bcommit\s+[0-9a-f]{7,40}\b/gi;
  while ((match = versionRegex.exec(text)) !== null) {
    addSpan('version', match[0], match.index, match.index + match[0].length, 'literal');
  }

  // 6. Citations: [1], [Source 2], (Smith, 2024), doi:...
  const citationRegex = /\[(?:\d+|Source\s+\d+|[A-Z][a-z]+(?:\s+et\s+al\.)?,\s*\d{4})\]|\bdoi:10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+\b|\barXiv:\d{4}\.\d{4,5}\b/g;
  while ((match = citationRegex.exec(text)) !== null) {
    addSpan('citation', match[0], match.index, match.index + match[0].length, 'literal');
  }

  // 7. Equations / Math formulas
  const equationRegex = /\$[^$\n]+\$|\b[a-zA-Z]\s*=\s*mc\^?2\b|\b\d+\s*[+\-*/]\s*\d+\s*=\s*\d+\b/g;
  while ((match = equationRegex.exec(text)) !== null) {
    addSpan('equation', match[0], match.index, match.index + match[0].length, 'literal');
  }

  // 8. Quoted text
  const quotedRegex = /"[^"\n]{2,100}"|“[^”\n]{2,100}”/g;
  while ((match = quotedRegex.exec(text)) !== null) {
    addSpan('quoted', match[0], match.index, match.index + match[0].length, 'high');
  }

  // 9. Currencies: $100, $45.50, €50M, £10,000, 50 USD, $10 billion
  const currencyRegex = /(?:[$€£¥₹]\s*\d+(?:,\d{3})*(?:\.\d+)?(?:\s*(?:billion|million|thousand|hundred|trillion)|[kKmMbBtT])?|\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:(?:billion|million|thousand|hundred|trillion)\s+)?(?:USD|EUR|GBP|JPY|INR|dollars?|cents?|euros?|pounds?)\b)/gi;
  while ((match = currencyRegex.exec(text)) !== null) {
    addSpan('currency', match[0], match.index, match.index + match[0].length, 'high');
  }

  // 10. Percentages: 10%, 99.9%, 15 percent
  const percentRegex = /\b\d+(?:\.\d+)?\s*(?:%|percent)\b/gi;
  while ((match = percentRegex.exec(text)) !== null) {
    addSpan('percentage', match[0], match.index, match.index + match[0].length, 'high');
  }

  // 11. Dates: "March 14", "14 March 2026", "2026-03-14", "03/14/2026"
  // Note: For 'May', require ordinal (1st May) or year (1 May 2026) to avoid false-matching 'node 1 may experience'
  const dateRegex = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember))\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b|\b\d{1,2}(?:st|nd|rd|th)\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember))(?:,?\s+\d{4})?\b|\b\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember))\b|\b\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember))\s+\d{4}\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/gi;
  while ((match = dateRegex.exec(text)) !== null) {
    addSpan('date', match[0], match.index, match.index + match[0].length, 'high');
  }

  // 12. Times: "10:30 AM", "14:00", "5 pm"
  const timeRegex = /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\b|\b\d{1,2}\s*(?:AM|PM|am|pm)\b/g;
  while ((match = timeRegex.exec(text)) !== null) {
    addSpan('time', match[0], match.index, match.index + match[0].length, 'high');
  }

  // 13. Measurements and scientific units: "25 kg", "100 km/h", "3 weeks", "5 minutes"
  const unitRegex = /\b\d+(?:\.\d+)?\s*(?:kg|g|mg|lbs?|oz|km|m|cm|mm|mi|miles?|ft|feet|in|inches|mph|km\/h|ms|s|sec|seconds?|min|minutes?|hrs?|hours?|days?|weeks?|months?|years?|GB|MB|KB|TB|kW|MW|kWh|Hz|kHz|MHz|GHz|V|A|°C|°F|K|ppm)\b/gi;
  while ((match = unitRegex.exec(text)) !== null) {
    addSpan('unit', match[0], match.index, match.index + match[0].length, 'high');
  }

  // 14. Plain numbers & quantities (decimals, integers)
  const plainNumRegex = /\b\d+(?:,\d{3})*(?:\.\d+)?\b/g;
  while ((match = plainNumRegex.exec(text)) !== null) {
    addSpan('numeric', match[0], match.index, match.index + match[0].length, 'literal');
  }

  // 15. Hashtags and @mentions
  const socialRegex = /(?:^|\s)([@#][a-zA-Z0-9_]{2,30})\b/g;
  while ((match = socialRegex.exec(text)) !== null) {
    const raw = match[1];
    const idx = match.index + (match[0].length - raw.length);
    addSpan(raw.startsWith('@') ? 'mention' : 'hashtag', raw, idx, idx + raw.length, 'high');
  }

  // 16. Named entities / Proper nouns (capitalized multi-word titles or recognized entities)
  const entityRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
  while ((match = entityRegex.exec(text)) !== null) {
    // Exclude if at sentence beginning followed by common words
    addSpan('entity', match[0], match.index, match.index + match[0].length, 'normal');
  }

  // Sort by starting position
  spans.sort((a, b) => a.start - b.start);
  return spans;
}

/**
 * Extracts candidate normalized numbers and percentages for equivalence testing.
 */
export function extractCandidateNumbers(candidateText) {
  if (!candidateText) return new Set();
  const nums = new Set();

  // Digits, percentages, currencies
  const rawMatches = candidateText.match(/\b\d+(?:,\d{3})*(?:\.\d+)?(?:\s*(?:%|percent|percentage)\b|%)?|\b[$€£¥₹]\s*\d+(?:,\d{3})*(?:\.\d+)?/gi) || [];
  for (const m of rawMatches) {
    const norm = normalizeNumber(m);
    if (norm) {
      nums.add(norm);
      const pure = norm.replace(/^[$€£¥₹]/, '');
      if (pure) nums.add(pure);
    }
  }

  const wordUnits = Object.keys(NUMBER_WORD_MAP);

  // Match word percentages e.g. "ten percent" or "twenty five percent"
  const wordPctRegex = new RegExp(`\\b(?:${wordUnits.join('|')})(?:[\\s-]+(?:${wordUnits.join('|')}))*\\s*(?:%|percent|percentage)\\b`, 'gi');
  let match;
  while ((match = wordPctRegex.exec(candidateText)) !== null) {
    const norm = normalizeNumber(match[0]);
    if (norm) nums.add(norm);
  }

  // Compound number words
  const compoundRegex = new RegExp(`\\b(?:${wordUnits.join('|')})(?:[\\s-]+(?:${wordUnits.join('|')}))*\\b`, 'gi');
  let cMatch;
  while ((cMatch = compoundRegex.exec(candidateText)) !== null) {
    const norm = normalizeNumber(cMatch[0]);
    if (norm) nums.add(norm);
  }

  return nums;
}

/**
 * Checks whether a candidate rewrite preserves all protected spans.
 * Returns { valid: boolean, violations: Array<{ type, expected, found, problem }> }
 */
export function verifyProtectedSpans(sourceSpans, candidateText) {
  if (!Array.isArray(sourceSpans) || sourceSpans.length === 0) {
    return { valid: true, violations: [], preservedCount: 0 };
  }

  const candidateNorm = (candidateText || '').toLowerCase();
  const candidateOriginal = candidateText || '';
  const candidateNums = extractCandidateNumbers(candidateText);
  const violations = [];
  let preservedCount = 0;

  for (const span of sourceSpans) {
    const originalVal = span.value;
    const normalizedVal = span.normalizedValue || originalVal;

    // Check literal types (must match exactly or normalized)
    if (LITERAL_PROTECTION_TYPES.has(span.type) || span.criticality === 'literal') {
      const exactMatch = candidateOriginal.includes(originalVal);
      const normMatch = candidateNorm.includes(normalizedVal.toLowerCase());

      // If it's numeric or percentage, check normalized set
      let numMatch = false;
      if (span.type === 'numeric' || span.type === 'percentage') {
        const numVal = normalizeNumber(originalVal);
        if (numVal && (candidateNorm.includes(numVal) || candidateNums.has(numVal))) {
          numMatch = true;
        }
      }

      if (!exactMatch && !normMatch && !numMatch) {
        violations.push({
          type: span.type,
          expected: originalVal,
          criticality: span.criticality,
          problem: `Protected ${span.type} '${originalVal}' was corrupted, altered, or omitted in candidate.`,
        });
      } else {
        preservedCount++;
      }
      continue;
    }

    // For dates, times, currencies, units
    if (span.type === 'date' || span.type === 'time' || span.type === 'currency' || span.type === 'unit') {
      const rawMatch = candidateNorm.includes(originalVal.toLowerCase());
      const normMatch = normalizedVal && candidateNorm.includes(normalizedVal.toLowerCase());
      let dateMatch = false;
      let currencyMatch = false;
      if (span.type === 'date') {
        const normD = normalizeDate(originalVal);
        if (normD && candidateNorm.includes(normD)) {
          dateMatch = true;
        }
      }
      if (span.type === 'currency') {
        const candMeasurements = extractMeasurements(candidateText);
        const srcMeasurements = extractMeasurements(originalVal);
        if (srcMeasurements.length > 0) {
          const sm = srcMeasurements[0];
          currencyMatch = candMeasurements.some(
            (cm) => cm.normalizedValue === sm.normalizedValue && cm.currency === sm.currency && !cm.hasConflict
          );
        }
      }

      if (!rawMatch && !normMatch && !dateMatch && !currencyMatch) {
        violations.push({
          type: span.type,
          expected: originalVal,
          criticality: span.criticality,
          problem: `Temporal or measurement invariant '${originalVal}' missing from rewrite.`,
        });
      } else {
        preservedCount++;
      }
      continue;
    }

    // For entities and other spans
    const entityMatch = candidateNorm.includes(originalVal.toLowerCase());
    if (!entityMatch) {
      // Check partial words (e.g. surname or acronym)
      const parts = originalVal.split(/\s+/).filter((p) => p.length > 2);
      const allPartsPresent = parts.length > 0 && parts.every((p) => candidateNorm.includes(p.toLowerCase()));
      if (!allPartsPresent) {
        violations.push({
          type: span.type,
          expected: originalVal,
          criticality: span.criticality,
          problem: `Entity '${originalVal}' was not preserved in rewrite.`,
        });
      } else {
        preservedCount++;
      }
    } else {
      preservedCount++;
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    preservedCount,
    totalCount: sourceSpans.length,
  };
}
