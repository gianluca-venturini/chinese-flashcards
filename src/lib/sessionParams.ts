export const CUSTOM_SIZE_PARAM = "customSize";
export const SESSION_ORDER_PARAM = "order";

export type SessionOrder = 'chronological' | 'difficult';

export function parseSessionOrder(value: string | null): SessionOrder {
  return value === 'difficult' ? 'difficult' : 'chronological';
}
