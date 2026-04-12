/**
 * Pattern detection module - Auto-redaction patterns
 * Exports all patterns and registry
 */

import { patternRegistry } from './patternRegistry';
import { indiaPatterns, financialPatterns } from './indiaPatterns';
import { globalPatterns } from './globalPatterns';

/**
 * Initialize all patterns in the registry
 */
export function initializePatterns() {
  // Register India-specific patterns
  indiaPatterns.forEach(pattern => patternRegistry.register(pattern));

  // Register financial patterns
  financialPatterns.forEach(pattern => patternRegistry.register(pattern));

  // Register global patterns
  globalPatterns.forEach(pattern => patternRegistry.register(pattern));
}

// Auto-initialize
initializePatterns();

export { patternRegistry };
export * from './types';
export * from './patternRegistry';
export { indiaPatterns, financialPatterns } from './indiaPatterns';
export { globalPatterns } from './globalPatterns';
