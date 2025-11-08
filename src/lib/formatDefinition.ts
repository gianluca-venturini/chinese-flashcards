/**
 * Extracts the short version of a definition for display.
 * Returns the part before the first semicolon (;) or period (.).
 * If neither is found, returns the full definition.
 */
export function getShortDefinition(definition: string): string {
  if (!definition) return definition;
  
  // Find the first semicolon or period
  const semicolonIndex = definition.indexOf(';');
  const periodIndex = definition.indexOf('.');
  
  let endIndex = -1;
  if (semicolonIndex !== -1 && periodIndex !== -1) {
    // Use whichever comes first
    endIndex = Math.min(semicolonIndex, periodIndex);
  } else if (semicolonIndex !== -1) {
    endIndex = semicolonIndex;
  } else if (periodIndex !== -1) {
    endIndex = periodIndex;
  }
  
  if (endIndex !== -1) {
    return definition.slice(0, endIndex).trim();
  }
  
  return definition.trim();
}

