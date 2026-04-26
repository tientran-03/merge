export const FORM_CONSTANTS = {
  MAX_LENGTH: {
    SHORT: 50,
    MEDIUM: 100,
    LONG: 255,
    TEXT: 500,
  },
  TEXTAREA: {
    MIN_ROWS: 3,
    MAX_ROWS: 6,
  },

  DATE: {
    MIN_AGE_YEARS: 0,
    MAX_AGE_YEARS: 150,
  },
} as const;
export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^[0-9+\-\s()]{10,20}$/,
  NUMERIC: /^[0-9]*$/,
} as const;
export const VALIDATION_ERRORS = {
  REQUIRED: 'This field is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_PHONE: 'Please enter a valid phone number',
  MIN_LENGTH: (min: number) => `Must be at least ${min} characters`,
  MAX_LENGTH: (max: number) => `Must not exceed ${max} characters`,
} as const;
