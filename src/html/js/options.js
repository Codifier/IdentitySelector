import { Options } from './modules/Options.js';

document.addEventListener('DOMContentLoaded', async function(e) {
  new Options().run();
}, { once: true });
