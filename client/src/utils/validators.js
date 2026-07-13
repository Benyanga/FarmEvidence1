export function required(value) {
  if (value === undefined || value === null || value === '') return 'This field is required.';
  return null;
}

export function isPositiveNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  return Number(value) > 0 ? null : 'Must be a positive number.';
}

export function isInRange(value, min, max) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return n >= min && n <= max ? null : `Must be between ${min} and ${max}.`;
}

export function validateForm(values, rules) {
  const errors = {};
  for (const [field, validators] of Object.entries(rules)) {
    for (const validate of validators) {
      const error = validate(values[field]);
      if (error) {
        errors[field] = error;
        break;
      }
    }
  }
  return errors;
}
