import { AppError } from './errors.js';

export const MAX_LOAN_RUPEES = 10_000_000;

export function rupeesToPaise(amount: number): number {
  const paise = Math.round(amount * 100);
  if (!Number.isSafeInteger(paise) || paise <= 0 || paise > MAX_LOAN_RUPEES * 100) {
    throw new AppError(422, 'INVALID_AMOUNT', `Amount must be between ₹0.01 and ₹${MAX_LOAN_RUPEES.toLocaleString('en-IN')}.`);
  }
  if (Math.abs(amount * 100 - paise) > Number.EPSILON * 100) {
    throw new AppError(422, 'INVALID_AMOUNT', 'Amount can have at most two decimal places.');
  }
  return paise;
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

