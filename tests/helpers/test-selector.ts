import type { Page } from '@playwright/test';

export type CSSProperty = Exclude<keyof CSSStyleDeclaration, number | Symbol>;

const getProperty = async (
	page: Page,
	selector: string,
	property: CSSProperty,
) => {
	return await page.locator(selector).evaluate((b, property) => {
		return window.getComputedStyle(b)[property];
	}, property);
};

export const testSelectorPropertyMatch = async (
	page: Page,
	selector: string,
	property: CSSProperty,
	expected: string,
) => {
	const value = await getProperty(page, selector, property);
	if (value === expected) {
		return {
			message: () => 'passed',
			pass: true,
		};
	}

	return {
		// TODO(bret): Better error message
		message: () => `"${property}" did not match`,
		pass: false,
	};
};
