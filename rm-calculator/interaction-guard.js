const editableSelector = 'input, textarea, select, [contenteditable="true"]';

document.documentElement.classList.add('interaction-guard-enabled');

document.addEventListener('selectstart', (event) => {
  if (!(event.target instanceof Element) || !event.target.closest(editableSelector)) event.preventDefault();
}, { passive: false });

document.addEventListener('contextmenu', (event) => {
  if (event.target instanceof Element && event.target.closest('img, svg, .brand-logo, .footer-logo')) event.preventDefault();
}, { passive: false });

document.addEventListener('dragstart', (event) => {
  if (event.target instanceof Element && event.target.closest('img, svg')) event.preventDefault();
}, { passive: false });
