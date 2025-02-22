import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import {
	rootPath,
	SERVER_PORT,
	siteRootDir,
	tempDir,
	WHR_PORT,
} from './tests/shared';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

const setupServer = 'setup server';
const dependencies = [setupServer];

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	testDir: './tests',
	/* Run tests in files in parallel */
	// fullyParallel: !process.env.CI,
	fullyParallel: false,
	workers: 1,
	// forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	timeout: 5e3,
	reporter: 'html',
	use: {
		/* Base URL to use in actions like `await page.goto('/')`. */
		baseURL: `http://localhost:${SERVER_PORT}/${tempDir}/`,

		trace: 'on-first-retry',
	},

	globalSetup: 'tests/pre-global.setup.ts',

	projects: [
		{
			name: setupServer,
			testMatch: /global\.setup\.ts/,
		},
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				launchOptions: {
					args: ['--headless=new'],
				},
			},
			dependencies,
		},
		// {
		// 	name: 'firefox',
		// 	use: { ...devices['Desktop Firefox'] },
		// 	dependencies,
		// },
		// {
		// 	name: 'webkit',
		// 	use: { ...devices['Desktop Safari'] },
		// 	dependencies,
		// },

		/* Test against branded browsers. */
		// {
		//   name: 'Microsoft Edge',
		//   use: { ...devices['Desktop Edge'], channel: 'msedge' },
		// },
		// {
		//   name: 'Google Chrome',
		//   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
		// },
	],

	/* Run your local dev server before starting the tests */
	webServer: [
		{
			command: `npm run test:serve -- ${siteRootDir}/ -p ${SERVER_PORT}`,
			url: `http://127.0.0.1:${SERVER_PORT}/_template/index.html`,
			reuseExistingServer: !process.env.CI,
			// stdout: 'pipe',
			stderr: 'pipe',
			timeout: 16e3,
		},
		{
			command: `node ${path.join(rootPath, 'app')} ./${siteRootDir}`,
			url: `http://127.0.0.1:${WHR_PORT}/reloader.js`,
			reuseExistingServer: !process.env.CI,
			// stdout: 'pipe',
			stderr: 'pipe',
			env: {
				PORT: WHR_PORT.toString(),
			},
			timeout: 15e3,
		},
	],
});
