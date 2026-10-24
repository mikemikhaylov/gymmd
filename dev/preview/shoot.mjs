/**
 * Screenshots every GymMD screen in a phone-sized browser and flags layout
 * problems (elements overflowing the screen horizontally).
 *   node dev/preview/shoot.mjs [filter] [--light] [--small] [--desktop]
 * Output: dev/preview/out/<theme>[-small]/<scenario>.png
 */
import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const filter = args.find((a) => !a.startsWith('--'));
const theme = args.includes('--light') ? 'light' : 'dark';
const small = args.includes('--small');
const desktop = args.includes('--desktop');
// iPhone 13/14 by default; --small = iPhone SE; --desktop = a desktop pane.
const viewport = desktop
	? { width: 900, height: 700 }
	: small
		? { width: 375, height: 667 }
		: { width: 390, height: 844 };
const variant = desktop ? 'desktop' : small ? 'small' : '';
const out = join(here, 'out', `${theme}${variant ? `-${variant}` : ''}`);

const click = (text) => async (page) => page.getByRole('button', { name: text, exact: true }).first().click();
const clickIn = (selector, text) => async (page) =>
	page.locator(selector).filter({ hasText: text }).first().getByRole('button', { name: 'Yes', exact: true }).click();
const scrollView = (y) => async (page) =>
	page.evaluate((y) => document.querySelector('.gymmd-view')?.scrollBy(0, y), y);

/** [name, url params, ...steps] */
const SCENARIOS = [
	['home', 'route=home'],
	['home-active', 'route=home&active=1'],
	['journal', 'route=journal'],
	['journal-yesterday', 'route=journal', click('Previous day')],
	['journal-yesterday-scrolled', 'route=journal', click('Previous day'), scrollView(700)],
	['journal-yes-caffeine', 'route=journal', clickIn('.gymmd-journal-card', 'Caffeine')],
	['journal-yes-headache', 'route=journal', clickIn('.gymmd-journal-card', 'Headache'), async (p) =>
		p.locator('.gymmd-journal-card', { hasText: 'Headache' }).scrollIntoViewIfNeeded()],
	['journal-yes-magnesium', 'route=journal', clickIn('.gymmd-journal-card', 'Magnesium'), async (p) =>
		p.locator('.gymmd-journal-card', { hasText: 'Magnesium' }).scrollIntoViewIfNeeded()],
	['journal-empty', 'route=journal&seed=empty'],
	['journal-items', 'route=journal-items'],
	['journal-item-new', 'route=journal-items', click('Add')],
	['journal-item-edit', 'route=journal-items', async (p) =>
		p.locator('.gymmd-row-main', { hasText: 'Headache' }).click()],
	['journal-item-edit-scrolled', 'route=journal-items', async (p) =>
		p.locator('.gymmd-row-main', { hasText: 'Headache' }).click(), async (p) =>
		p.evaluate(() => document.querySelector('.modal .gymmd-editor')?.scrollBy(0, 1000))],
	['active-set-menu', 'route=active&active=1', click('All sets'), async (p) =>
		p.locator('.gymmd-set-menu').first().click()],
	['finish-confirm', 'route=active&active=1', click('Finish')],
	['templates', 'route=templates'],
	['template-editor', 'route=templates', click('Edit')],
	['exercises', 'route=exercises'],
	['history', 'route=history'],
	['bodyweight', 'route=bodyweight'],
	['bodyweight-add', 'route=bodyweight', click('Add')],
	['reports', 'route=reports'],
	['active', 'route=active&active=1'],
	['active-allsets', 'route=active&active=1', click('All sets')],
	['empty-home', 'route=home&seed=empty'],
	['home-no-strength', 'route=home&active=1&disable=strength'],
	['home-strength-only', 'route=home&active=1&disable=journal,bodyWeight'],
	['home-none', 'route=home&disable=strength,journal,bodyWeight'],
	['settings', 'settings=1'],
	// Toggling a module in settings re-renders an already-open Home live.
	['home-live-toggle', 'route=home', async (p) =>
		p.evaluate(async () => {
			const { plugin } = window.gymmd;
			plugin.settings.modules = { ...plugin.settings.modules, journal: false };
			await plugin.saveSettings();
		})],
];

async function overflowReport(page) {
	return page.evaluate((vw) => {
		const bad = [];
		for (const el of document.querySelectorAll('.workspace-leaf-content *, .modal *')) {
			const r = el.getBoundingClientRect();
			if (r.width === 0 || r.height === 0) continue;
			// Ignore content inside an intentionally scrollable wrapper.
			if (el.closest('.gymmd-table-wrap')) continue;
			if (r.right > vw + 1 || r.left < -1) {
				const cls = typeof el.className === 'string' ? el.className.split(' ')[0] : '';
				bad.push(`${el.tagName.toLowerCase()}${cls ? '.' + cls : ''} [${Math.round(r.left)}→${Math.round(r.right)}] "${(el.textContent ?? '').trim().slice(0, 30)}"`);
			}
		}
		return [...new Set(bad)].slice(0, 8);
	}, viewport.width);
}

// A filtered run only refreshes its own screenshots.
if (!filter) rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext(
	desktop
		? { viewport, deviceScaleFactor: 1 }
		: { viewport, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
);
const index = pathToFileURL(join(here, 'index.html')).href;
let problems = 0;

for (const [name, query, ...steps] of SCENARIOS) {
	if (filter && !name.includes(filter)) continue;
	const page = await ctx.newPage();
	page.setDefaultTimeout(5000);
	const errors = [];
	page.on('pageerror', (e) => errors.push(e.message));
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
	await page.goto(`${index}?${query}&theme=${theme}${desktop ? '&desktop=1' : ''}`);
	await page.waitForFunction(() => document.body.dataset.ready === '1');
	await page.waitForTimeout(150);
	try {
		for (const step of steps) {
			await step(page);
			await page.waitForTimeout(200);
		}
	} catch (e) {
		errors.push(`step failed: ${e.message.split('\n')[0]}`);
	}
	await page.screenshot({ path: join(out, `${name}.png`) });
	const overflow = await overflowReport(page);
	const status = errors.length || overflow.length ? '✗' : '✓';
	if (status === '✗') problems++;
	console.log(`${status} ${name}`);
	for (const e of errors) console.log(`    error: ${e}`);
	for (const o of overflow) console.log(`    overflow: ${o}`);
	await page.close();
}

await browser.close();
console.log(`\n${problems} scenario(s) with problems — screenshots in ${out}`);
