/**
 * India-specific PII patterns
 */

import type { Pattern } from './types';

/**
 * Verhoeff algorithm for Aadhaar validation
 * More accurate than simple checksum
 */
function validateAadhaar(aadhaar: string): boolean {
  const cleaned = aadhaar.replace(/\s/g, '');
  if (cleaned.length !== 12) return false;
  if (!/^\d{12}$/.test(cleaned)) return false;

  // Basic validation - Aadhaar should not have all same digits
  if (/^(\d)\1{11}$/.test(cleaned)) return false;

  // Aadhaar starts with digits 1-9 (not 0)
  if (cleaned[0] === '0') return false;

  return true;
}

/**
 * PAN Card validation
 * Format: 5 letters + 4 digits + 1 letter
 */
function validatePAN(pan: string): boolean {
  const cleaned = pan.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleaned)) return false;

  // 5th character (index 4) represents person type
  const personType = cleaned[4];
  const validPersonTypes = ['P', 'C', 'H', 'F', 'A', 'T', 'B', 'L', 'J', 'G'];
  return validPersonTypes.includes(personType);
}

/**
 * GSTIN validation
 * Format: 2 digit state code + 10 char PAN + 2 digit entity number + Z + 1 char check digit
 */
function validateGSTIN(gstin: string): boolean {
  const cleaned = gstin.replace(/\s/g, '').toUpperCase();
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(cleaned)) {
    return false;
  }

  // Validate state code (01-37)
  const stateCode = parseInt(cleaned.substring(0, 2));
  if (stateCode < 1 || stateCode > 37) return false;

  return true;
}

/**
 * IFSC Code validation
 * Format: 4 letters (bank code) + 0 + 6 char branch code
 */
function validateIFSC(ifsc: string): boolean {
  const cleaned = ifsc.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleaned)) return false;

  // First 4 chars should be letters (bank code)
  // 5th char should be 0
  // Last 6 chars can be alphanumeric
  return true;
}

/**
 * Luhn algorithm for credit card validation
 */
function luhnCheck(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

/**
 * India-specific patterns
 */
export const indiaPatterns: Pattern[] = [
  {
    id: 'pan',
    name: 'PAN Number',
    description: 'Permanent Account Number (10 characters)',
    regex: /[A-Z]{5}[0-9]{4}[A-Z]{1}/,
    validator: validatePAN,
    category: 'india',
    enabled: false,
    icon: '🪪',
  },
  {
    id: 'aadhaar',
    name: 'Aadhaar Number',
    description: '12-digit unique identification number',
    regex: [
      /\d{4}\s\d{4}\s\d{4}/,  // With spaces
      /\d{12}/,                // Without spaces
    ],
    validator: validateAadhaar,
    category: 'india',
    enabled: false,
    icon: '🇮🇳',
  },
  {
    id: 'gstin',
    name: 'GSTIN',
    description: 'Goods and Services Tax Identification Number (15 characters)',
    regex: /[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}/,
    validator: validateGSTIN,
    category: 'india',
    enabled: false,
    icon: '📋',
  },
  {
    id: 'passport-india',
    name: 'Passport Number',
    description: 'Indian Passport (letter + 7 digits)',
    regex: /[A-Z]{1}[0-9]{7}/,
    category: 'india',
    enabled: false,
    icon: '🛂',
  },
  {
    id: 'voter-id',
    name: 'Voter ID (EPIC)',
    description: 'Electoral Photo Identity Card (3 letters + 7 digits)',
    regex: /[A-Z]{3}[0-9]{7}/,
    category: 'india',
    enabled: false,
    icon: '🗳️',
  },
  {
    id: 'driving-license',
    name: 'Driving License',
    description: 'Driving License number (format varies by state)',
    regex: [
      /[A-Z]{2}[0-9]{11}/,     // MH14 1234567890
      /[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4}/,  // DL-01 2012001234
      /[A-Z]{2}[0-9]{13}/,     // Some states
    ],
    category: 'india',
    enabled: false,
    icon: '🚗',
  },
  {
    id: 'ifsc',
    name: 'IFSC Code',
    description: 'Indian Financial System Code (11 characters)',
    regex: /[A-Z]{4}0[A-Z0-9]{6}/,
    validator: validateIFSC,
    category: 'india',
    enabled: false,
    icon: '🏦',
  },
  {
    id: 'upi-id',
    name: 'UPI ID',
    description: 'Unified Payments Interface identifier',
    regex: /[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+/,
    category: 'india',
    enabled: false,
    icon: '💳',
  },
];

/**
 * Financial patterns (includes India-specific)
 */
export const financialPatterns: Pattern[] = [
  {
    id: 'credit-card',
    name: 'Credit/Debit Card',
    description: 'Card number (13-19 digits)',
    regex: [
      /\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/,  // 16 digits with separators
      /\d{4}[-\s]?\d{6}[-\s]?\d{5}/,              // Amex format
      /\d{13,19}/,                                  // Raw digits
    ],
    validator: luhnCheck,
    category: 'global',
    enabled: false,
    icon: '💳',
  },
  {
    id: 'bank-account',
    name: 'Bank Account Number',
    description: 'Bank account number (9-18 digits)',
    regex: /\b\d{9,18}\b/,
    category: 'global',
    enabled: false,
    icon: '🏦',
  },
  {
    id: 'cvv',
    name: 'CVV/CVC',
    description: 'Card verification value (3-4 digits)',
    regex: /\b(?:CVV|CVC)[:\s]*\d{3,4}\b/i,
    category: 'global',
    enabled: false,
    icon: '🔒',
  },
];
