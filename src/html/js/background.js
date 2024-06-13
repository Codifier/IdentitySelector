import { IdentitySelector } from './modules/IdentitySelector.js';

// instantiate before DOMContentLoaded, for browser.runtime.onInstalled listener in constructor
const identitySelector = new IdentitySelector();
document.addEventListener('DOMContentLoaded', async function(e) {
  identitySelector.run();
}, { once: true });
