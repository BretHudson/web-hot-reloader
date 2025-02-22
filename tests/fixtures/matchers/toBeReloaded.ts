import { expect as baseExpect } from '@playwright/test';

import type { ReloadableAsset } from '../../helpers/pages';

export const expect = baseExpect.extend({
	async WHR_toNotBeReloaded(received: ReloadableAsset) {
		const { locator, attr } = received.locator;
		try {
			await locator.waitFor({ state: 'attached' });
		} catch (e) {
			return {
				message: () => 'element not on page',
				pass: false,
			};
		}
		const link = await locator.getAttribute(attr);
		if (!link) {
			return {
				message: () => `attribute "${attr}" not present on element`,
				pass: false,
			};
		}
		const pass = !link.includes('?');
		return {
			message: () => (pass ? 'passed' : `element has already been reloaded`),
			pass,
		};
	},

	async WHR_toBeReloaded(received: ReloadableAsset) {
		const { page, locator, attr } = received.locator;
		try {
			await locator.waitFor({ state: 'attached' });
		} catch (e) {
			return {
				message: () => 'element not on page',
				pass: false,
			};
		}

		let handle: Awaited<ReturnType<typeof locator.elementHandle>>;
		try {
			handle = await locator.elementHandle();
		} catch (e) {
			return {
				message: () => 'could not retrieve element handle',
				pass: false,
			};
		}

		try {
			const good = await page.waitForFunction(
				({ el, attr }) => {
					return el?.getAttribute(attr)?.includes('?');
				},
				{ el: handle, attr },
			);

			return {
				message: () => 'passed',
				pass: Boolean(good),
			};
		} catch (e) {
			console.log(e);
			return {
				message: () => 'element has not been reloaded via WHR',
				pass: false,
			};
		}
	},
});
