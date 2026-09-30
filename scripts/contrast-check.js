#!/usr/bin/env node

/**
 * Contrast ratio calculator for the TU website color palette.
 * Computes WCAG AA compliance (4.5:1 for normal text, 3:1 for large text)
 */

// Color palette from src/styles/global.css
const palette = {
	'--color-text': '#565651',
	'--color-text-muted': '#4E6D93',
	'--color-accent': '#00254E',
	'--color-accent-hover': '#4E6D93',
	'--color-border': '#8DB2D9',
	'--color-surface': '#C7DCE5',
	'--color-accent-secondary': '#7BD9B0',
	'--color-cta': '#FFBF3E',
	'--color-bg': '#ffffff',
};

// Convert hex to RGB
function hexToRgb(hex) {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result ? {
		r: parseInt(result[1], 16),
		g: parseInt(result[2], 16),
		b: parseInt(result[3], 16)
	} : null;
}

// Calculate relative luminance (WCAG formula)
function getLuminance(hex) {
	const rgb = hexToRgb(hex);
	if (!rgb) return 0;

	let r = rgb.r / 255;
	let g = rgb.g / 255;
	let b = rgb.b / 255;

	r = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
	g = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
	b = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Calculate contrast ratio
function getContrast(hex1, hex2) {
	const l1 = getLuminance(hex1);
	const l2 = getLuminance(hex2);

	const lighter = Math.max(l1, l2);
	const darker = Math.min(l1, l2);

	return ((lighter + 0.05) / (darker + 0.05)).toFixed(2);
}

// Text/background combinations actually used on the site
const combinations = [
	// Global text on backgrounds
	{ text: '--color-text', bg: '--color-bg', name: 'Body text on white' },
	{ text: '--color-text', bg: '--color-surface', name: 'Body text on light blue surface' },
	{ text: '--color-text-muted', bg: '--color-bg', name: 'Muted text on white' },
	{ text: '--color-text-muted', bg: '--color-surface', name: 'Muted text on light blue surface' },

	// Headers & accent text
	{ text: '--color-accent', bg: '--color-bg', name: 'Navy accent on white' },
	{ text: '--color-accent', bg: '--color-surface', name: 'Navy accent on light blue surface' },
	{ text: '--color-accent-secondary', bg: '--color-bg', name: 'Mint accent on white' },

	// On dark backgrounds (hero, footer)
	{ text: '#ffffff', bg: '--color-accent', name: 'White text on navy hero/footer' },

	// Card eyebrow (navy on light)
	{ text: '--color-accent', bg: '--color-surface', name: 'Card eyebrow (navy on surface)' },

	// Buttons
	{ text: '--color-accent', bg: '--color-bg', name: 'Primary button text (navy on white)' },
	{ text: '#ffffff', bg: '--color-cta', name: 'CTA button text (white on amber)' },
];

// Calculate and display
console.log('=== TU Website Contrast Ratio Audit ===\n');
console.log('WCAG AA Standard: 4.5:1 for normal text, 3:1 for large text\n');

const results = combinations.map(combo => {
	const textColor = palette[combo.text] || combo.text;
	const bgColor = palette[combo.bg];
	const ratio = getContrast(textColor, bgColor);
	const isCompliant = parseFloat(ratio) >= 4.5;
	const status = isCompliant ? '✓ PASS' : '✗ FAIL';

	return {
		name: combo.name,
		ratio,
		status,
		text: textColor,
		bg: bgColor
	};
});

results.forEach(r => {
	console.log(`${r.status} ${r.ratio}:1 - ${r.name}`);
	console.log(`      ${r.text} on ${r.bg}\n`);
});

// Summary
const failures = results.filter(r => parseFloat(r.ratio) < 4.5);
console.log(`\n=== Summary ===`);
console.log(`Total combinations checked: ${results.length}`);
console.log(`Passed WCAG AA: ${results.length - failures.length}`);
console.log(`Failed WCAG AA: ${failures.length}`);

if (failures.length > 0) {
	console.log(`\nFailing combinations:`);
	failures.forEach(f => {
		console.log(`  - ${f.name}: ${f.ratio}:1`);
	});
}
