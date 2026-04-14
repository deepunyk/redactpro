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

  const [localPart, domain] = cleaned.split('@');
  if (!localPart || !domain) return false;
  if (localPart.length > 64) return false;
  if (domain.length > 255) return false;

  // Local part must start and end with alphanumeric
  if (!/^[a-zA-Z0-9]/.test(localPart) || !/[a-zA-Z0-9]$/.test(localPart)) return false;
  // Domain must have at least one dot and valid TLD
  if (!/\.[a-zA-Z]{2,}$/.test(domain)) return false;

  return true;
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
 * Validate international phone number (basic checks)
 */
function validateIntlPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s()+\-]/g, '');
  // Must be 7-15 digits (ITU standard)
  if (!/^\d{7,15}$/.test(cleaned)) return false;
  return true;
}

/**
 * SSN validation (US)
 */
function validateSSN(ssn: string): boolean {
  const cleaned = ssn.replace(/[-\s]/g, '');
  if (!/^\d{9}$/.test(cleaned)) return false;

  // SSN cannot have 000 in any group
  if (cleaned.substring(0, 3) === '000') return false;
  if (cleaned.substring(3, 6) === '000') return false;
  if (cleaned.substring(6) === '0000') return false;

  // 078-05-1120 is the most misused SSN (Woolworth wallet)
  if (cleaned === '078051120') return false;

  // 666 area was previously excluded but is now valid since 2011 randomization
  // 9xx area numbers are now valid since randomization (since 2011)
  // Only exclude ITIN-like patterns (9xx-xx-xxxx where middle is 50-65, 70-88, 90-92, 94-99)
  // We don't exclude these here since the regex already catches the format

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
    regex: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/,
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
      /(?<!\w)\+91[-\s]?[6-9]\d{4}[-\s]?\d{5}\b/,
      /\b[6-9]\d{9}\b/,
    ],
    validator: validateIndianPhone,
    category: 'global',
    enabled: false,
    icon: '📱',
  },
  {
    id: 'phone-intl',
    name: 'Phone (International)',
    description: 'International phone numbers with country code',
    regex: [
      /(?<!\w)\+\d{1,3}[-\s]?\(?\d{1,4}\)?[-\s]?\d{1,4}[-\s]?\d{1,4}[-\s]?\d{1,4}\b/,
    ],
    validator: validateIntlPhone,
    category: 'global',
    enabled: false,
    icon: '🌍',
  },
  {
    id: 'ssn',
    name: 'SSN (US)',
    description: 'Social Security Number (US)',
    regex: [
      /\b\d{3}-\d{2}-\d{4}\b/,
      /\b\d{3}\s\d{2}\s\d{4}\b/,
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
      // Date preceded by DOB/Date of Birth/etc. - use lookbehind to only match the date
      /(?<=\b(?:DOB|D\.O\.B\.|Date\s+of\s+Birth|Birth\s+Date|Born)[:\s]*)\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4}\b/i,
      /(?<=\b(?:DOB|D\.O\.B\.|Date\s+of\s+Birth|Birth\s+Date|Born)[:\s]*)\d{2,4}[-/\.]\d{1,2}[-/\.]\d{1,2}\b/i,
      // Date with month name: 01-Jan-2020 or 01 January 2020
      /\b\d{1,2}[-/\s](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-/\s]\d{2,4}\b/i,
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
    regex: /\bhttps?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)/i,
    category: 'global',
    enabled: false,
    icon: '🔗',
  },
];
