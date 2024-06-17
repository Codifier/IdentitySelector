import { Translator } from './Translator.js';

export class Options
{
  static DEFAULT_OPTIONS = Object.freeze({
    justInstalled: true,
    showForReply: true,
    showForForward: true,
    showForNew: true,
    showForDraft: false,
    closeComposeWindowOnCancel: false,
    showComposeWindowAction: true
  });

  constructor() {
    this.translator = new Translator();
  }

  async run() {
    const storedOptions = await browser.storage.sync.get();
    for(const [key, value] of Object.entries(storedOptions)) {
      const checkbox = document.getElementById(key);
      if(checkbox) {
        checkbox.checked = value;
      }
    }

    this.messageInstall = document.querySelector('#template-message-install').content.firstElementChild.cloneNode(true);
    if(storedOptions.justInstalled) {
      await browser.storage.sync.set({ justInstalled: false });
      document.body.prepend(this.messageInstall);
    }

    const change = (e) => {
      browser.storage.sync.set({ [e.target.id]: e.target.checked });
    }

    document.addEventListener('change', change);

    this.translator.translate(document);
  }
}