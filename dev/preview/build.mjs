/**
 * Builds the browser preview of GymMD (see dev/preview/README.md).
 *   node dev/preview/build.mjs          build once
 *   node dev/preview/build.mjs --watch  rebuild on change
 *
 * Obsidian's own app.css + fonts are extracted from the locally installed app
 * (never committed) so the preview is styled exactly like the real thing.
 */
import esbuild from 'esbuild';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const vendor = join(here, 'vendor');
const ASAR_CANDIDATES = [
	process.env.OBSIDIAN_ASAR,
	'/Applications/Obsidian.app/Contents/Resources/obsidian.asar',
	`${process.env.LOCALAPPDATA}/Programs/Obsidian/resources/obsidian.asar`,
	'/opt/Obsidian/resources/obsidian.asar',
].filter(Boolean);

/** Minimal asar reader: header is a pickled JSON index, file data follows it. */
function readAsar(path) {
	const buf = readFileSync(path);
	const headerSize = buf.readUInt32LE(4);
	const jsonSize = buf.readUInt32LE(12);
	const index = JSON.parse(buf.subarray(16, 16 + jsonSize).toString('utf8'));
	const base = 8 + headerSize;
	const entry = (p) => p.split('/').reduce((node, part) => node.files[part], index);
	return {
		read: (p) => {
			const e = entry(p);
			const off = base + Number(e.offset);
			return buf.subarray(off, off + e.size);
		},
		list: (dir) => Object.keys(entry(dir).files),
	};
}

function extractObsidianCss() {
	if (existsSync(join(vendor, 'app.css'))) return;
	const asarPath = ASAR_CANDIDATES.find((p) => existsSync(p));
	if (!asarPath) {
		console.warn('Obsidian not found — set OBSIDIAN_ASAR=/path/to/obsidian.asar. Building without its CSS.');
		mkdirSync(vendor, { recursive: true });
		writeFileSync(join(vendor, 'app.css'), '');
		return;
	}
	const asar = readAsar(asarPath);
	mkdirSync(join(vendor, 'public/fonts'), { recursive: true });
	writeFileSync(join(vendor, 'app.css'), asar.read('app.css'));
	for (const f of asar.list('public/fonts')) {
		writeFileSync(join(vendor, 'public/fonts', f), asar.read(`public/fonts/${f}`));
	}
	console.log(`Extracted Obsidian CSS from ${asarPath}`);
}

extractObsidianCss();

const ctx = await esbuild.context({
	entryPoints: [join(here, 'boot.ts')],
	bundle: true,
	format: 'iife',
	target: 'es2021',
	jsx: 'automatic',
	sourcemap: 'inline',
	alias: { obsidian: join(here, 'obsidian-stub.ts') },
	outfile: join(here, 'dist/boot.js'),
	logLevel: 'info',
});

if (process.argv.includes('--watch')) {
	await ctx.watch();
} else {
	await ctx.rebuild();
	await ctx.dispose();
}
