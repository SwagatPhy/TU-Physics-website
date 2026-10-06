#!/usr/bin/env node

/**
 * Contrast ratio calculator for the TU website color palette.
 * Computes WCAG AA compliance (4.5:1 for normal text, 3:1 for large text)
 */

// Color palette from src/styles/global.css
// Keep in sync with the tokens at the top of global.css.
const palette = {
	'--navy': '#00254E',
	'--slate': '#4E6D93',
	'--ice': '#C7DCE5',
	'--graphite': '#565651',
	'--mint': '#7BD9B0',
	'--amber': '#FFBF3E',
	'--color-bg': '#FFFFFF',
	'--color-bg-soft': '#EEF5F7',
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
// (Mint is only used decoratively on light backgrounds — rules, dots — never as text.)
const combinations = [
	// Body and muted text
	{ text: '--graphite', bg: '--color-bg', name: 'Body text on white' },
	{ text: '--graphite', bg: '--color-bg-soft', name: 'Body text on soft section' },
	{ text: '--slate', bg: '--color-bg', name: 'Muted text / eyebrows on white' },
	{ text: '--slate', bg: '--color-bg-soft', name: 'Muted text / eyebrows on soft section' },

	// Headings, links, chips, badges
	{ text: '--navy', bg: '--color-bg', name: 'Headings and links on white' },
	{ text: '--navy', bg: '--color-bg-soft', name: 'Headings and chips on soft section' },
	{ text: '--navy', bg: '--ice', name: 'Badge text (navy on ice)' },
	{ text: '--navy', bg: '--mint', name: 'Mint badge / active tab count' },

	// Buttons
	{ text: '--navy', bg: '--amber', name: 'Primary button (navy on amber)' },
	{ text: '--color-bg', bg: '--navy', name: 'Navy button, active tab, footer links, header Register' },
	{ text: '--navy', bg: '--color-bg', name: 'Header Login button text and border, focus ring on white' },

	// Navy sections and footer
	{ text: '--ice', bg: '--navy', name: 'Body text on navy sections/footer' },
	{ text: '--mint', bg: '--navy', name: 'Footer headings (mint on navy)' },
	{ text: '--amber', bg: '--navy', name: 'Focus ring on navy (non-text, needs 3:1)' },
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
