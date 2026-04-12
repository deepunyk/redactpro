/**
 * Global PII patterns (email, phone, SSN, etc.)
 */

import type { Pattern } from './types';

/**
 * Email validation
 */
function validateEmail(email: string): boolean {
  const cleaned = email.toLowerCase().trim();
  if (cleaned.length > 254) return false;

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(cleaned);
}

/**
 * Indian phone validation
 * Format: +91 XXXXX XXXXX or 10 digits starting with 6-9
 */
function validateIndianPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s+-]/g, '');
  if (cleaned.length === 10 && /^[6-9]\d{9}$/.test(cleaned)) return true;
  if (cleaned.length === 12 && cleaned.startsWith('91') && /^[6-9]\d{10}$/.test(cleaned.substring(2))) return true;
  return false;
}

/**
 * SSN validation (US)
 */
function validateSSN(ssn: string): boolean {
  const cleaned = ssn.replace(/[-\s]/g, '');
  if (!/^\d{9}$/.test(cleaned)) return false;

  // SSN cannot have 000 in any group
  if (/^000/.test(cleaned)) return false;
  if (cleaned.substring(3, 6) === '000') return false;
  if (cleaned.substring(6) === '0000') return false;

  // SSN cannot start with 666
  if (/^666/.test(cleaned)) return false;

  // SSN cannot start with 9 (ITIN)
  if (/^9/.test(cleaned)) return false;

  return true;
}

/**
 * Global patterns
 */
export const globalPatterns: Pattern[] = [
  {
    id: 'email',
    name: 'Email Address',
    description: 'Email addresses',
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    validator: validateEmail,
    category: 'global',
    enabled: false,
    icon: '📧',
  },
  {
    id: 'phone-india',
    name: 'Phone (India)',
    description: 'Indian mobile number (+91 or 10 digits)',
    regex: [
      /\+91[-\s]?[6-9]\d{4}[-\s]?\d{5}/,
      /\+91[-\s]?[6-9]\d{9}/,
      /[6-9]\d{4}[-\s]?\d{5}/,
      /[6-9]\d{9}/,
    ],
    validator: validateIndianPhone,
    category: 'global',
    enabled: false,
    icon: '📱',
  },
  {
    id: 'phone-intl',
    name: 'Phone (International)',
    description: 'International phone numbers',
    regex: [
      /\+\d{1,3}[-\s]?\(?\d{1,4}\)?[-\s]?\d{1,4}[-\s]?\d{1,4}[-\s]?\d{1,9}/,
      /\d{3}[-\s]?\d{3}[-\s]?\d{4}/,
    ],
    category: 'global',
    enabled: false,
    icon: '🌍',
  },
  {
    id: 'ssn',
    name: 'SSN (US)',
    description: 'Social Security Number (US)',
    regex: [
      /\d{3}-\d{2}-\d{4}/,
      /\d{3}\s\d{2}\s\d{4}/,
    ],
    validator: validateSSN,
    category: 'global',
    enabled: false,
    icon: '🔐',
  },
  {
    id: 'date-of-birth',
    name: 'Date of Birth',
    description: 'Dates in various formats',
    regex: [
      /\b(?:DOB|D\.O\.B\.|Date of Birth|Birth Date)[:\s]*(\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4}|\d{2,4}[-/\.]\d{1,2}[-/\.]\d{1,2})\b/i,
      /\b(?:Born|Birth)[:\s]*(\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4}|\d{2,4}[-/\.]\d{1,2}[-/\.]\d{1,2})\b/i,
      /\b\d{1,2}[-/\.](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-/\.]\d{2,4}\b/i,
    ],
    category: 'global',
    enabled: false,
    icon: '📅',
  },
  {
    id: 'ip-address',
    name: 'IP Address',
    description: 'IPv4 addresses',
    regex: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/,
    category: 'global',
    enabled: false,
    icon: '🌐',
  },
  {
    id: 'url',
    name: 'URL / Website',
    description: 'Web addresses and URLs',
    regex: /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/i,
    category: 'global',
    enabled: false,
    icon: '🔗',
  },
];
