import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const VALID_DURATIONS = [60, 90, 120, 150, 180, 210, 240];
const FUZZY_NONE = /^(idk|none|no|\?)$/i;

function calculateAge(dateStr: string): number {
  const dob = new Date(dateStr);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

export function dateOfBirthAgeValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value as string;
  if (!value) return null;
  const age = calculateAge(value);
  if (age < 5) return { ageTooYoung: true };
  if (age > 100) return { ageTooOld: true };
  return null;
}

export function yearsPlayingValidator(dobControl: AbstractControl): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const years = control.value as number;
    const dob = dobControl.value as string;
    if (years == null || !dob) return null;
    const age = calculateAge(dob);
    return years > age - 4 ? { yearsExceedsAge: true } : null;
  };
}

export function sessionDurationValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value as number;
  if (value == null) return null;
  return VALID_DURATIONS.includes(value) ? null : { invalidDuration: true };
}

export function mainGoalsValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value as unknown[];
  if (!value || value.length === 0) return { goalsEmpty: true };
  if (value.length > 16) return { goalsTooMany: true };
  return null;
}

export function notFuzzyNoneValidator(control: AbstractControl): ValidationErrors | null {
  const value = (control.value as string)?.trim();
  if (!value) return null;
  return FUZZY_NONE.test(value) ? { fuzzyNone: true } : null;
}

export function atLeastOneValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value as unknown[];
  return !value || value.length === 0 ? { atLeastOne: true } : null;
}

export function wholeNumberValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value as number;
  if (value == null) return null;
  return Number.isInteger(value) ? null : { wholeNumber: true };
}
