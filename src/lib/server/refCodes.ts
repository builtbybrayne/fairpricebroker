declare const refCodeBrand: unique symbol;
export type RefCode = string & { readonly [refCodeBrand]: 'RefCode' };
export const REF_CODE_REGEX = /^[a-z2-7]{10}$/;
export function isRefCode(x: unknown): x is RefCode {
	return typeof x === 'string' && REF_CODE_REGEX.test(x);
}
