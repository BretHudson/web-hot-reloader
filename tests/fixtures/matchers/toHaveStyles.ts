import { expect as baseExpect, type Page } from '@playwright/test';

import { camelCaseToKebabCase } from '../../helpers/case-converters';

export const expect = baseExpect.extend({
	async toHaveStyles(received: Page, expected: Record<string, string>) {
		const body = received.locator('body');

		const errors: any[] = [];

		const res = await Promise.all([
			...Object.entries(expected).map(([k, v]) =>
				baseExpect(body)
					.toHaveCSS(camelCaseToKebabCase(k), v)
					.then(() => !this.isNot)
					.catch((e) => {
						errors.push(e.matcherResult);
						return this.isNot;
					}),
			),
		]);

		const pass = res.every(Boolean);

		return {
			pass,
			message: () => {
				const hint = this.utils.matcherHint(
					'toHaveStyles',
					undefined,
					undefined,
					{
						isNot: this.isNot,
					},
				);

				return (
					hint + '\n\n' + errors.map((error) => error.message).join('\n\n')
				);
			},
		};
	},
});
