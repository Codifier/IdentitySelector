import { Background } from './modules/Background.js';

// instantiate before DOMContentLoaded, for browser.runtime.onInstalled listener in constructor
const background = new Background();
document.addEventListener('DOMContentLoaded', async function(e) {
  background.run();
}, { once: true });
