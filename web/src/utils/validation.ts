/**
 * Validation utility functions
 * Common validation operations for different data types
 */

/**
 * Lightweight validation utility functions
 * Note: For complex form validation, use Zod schemas as defined in the workspace.
 */

/**
 * Validates an email address (Lightweight version)
 * @param email - Email to validate
 */
export function isValidEmail(email: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

/**
 * Validates a password against common security rules
 * @param password - Password to validate
 * @param options - Validation options
 */
export function isValidPassword(
  password: string,
  options = { 
    minLength: 8, 
    requireNumbers: true, 
    requireSpecialChars: true,
    requireUppercase: true,
    requireLowercase: true
  }
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < options.minLength) {
    errors.push(`Password must be at least ${options.minLength} characters long`);
  }
  
  if (options.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must include at least one number');
  }
  
  if (options.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must include at least one special character');
  }
  
  if (options.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must include at least one uppercase letter');
  }
  
  if (options.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must include at least one lowercase letter');
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validates a URL
 * @param url - URL to validate
 */
export function isValidUrl(url: string): boolean {
  try {
    return !!new URL(url);
  } catch {
    return false;
  }
}

/**
 * Validates a credit card number using the Luhn algorithm
 * @param cardNumber - Credit card number to validate
 */
export function isValidCreditCard(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  
  let sum = 0;
  let alternate = false;
  
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);
    if (alternate) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    alternate = !alternate;
  }
  
  return sum % 10 === 0;
}

/**
 * Validates a phone number
 * @param phoneNumber - Phone number to validate
 * @param countryCode - Country code (default: 'US')
 */
export function isValidPhoneNumber(phoneNumber: string, countryCode = 'US'): boolean {
  const digits = phoneNumber.replace(/\D/g, '');
  if (countryCode === 'US') return digits.length === 10;
  return digits.length >= 8;
}

/**
 * Checks if a value is a number
 * @param value - Value to check
 */
export function isNumber(value: unknown): boolean {
  if (typeof value === 'number') return !isNaN(value) && isFinite(value);
  if (typeof value === 'string' && value.trim() !== '') {
    return !isNaN(Number(value)) && isFinite(Number(value));
  }
  return false;
}

/**
 * Checks if a value is empty (null, undefined, empty string, empty array, or empty object)
 * @param value - Value to check
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}
