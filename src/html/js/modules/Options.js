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

  #translator = new Translator();
  #listeners = {
    change: (e) => {
      browser.storage.sync.set({ [e.target.id]: e.target.checked });
    }
  }

  async run() {
    const storedOptions = await browser.storage.sync.get();
    for(const [key, value] of Object.entries(storedOptions)) {
      const checkbox = document.getElementById(key);
      if(checkbox) {
        checkbox.checked = value;
      }
    }

    if(storedOptions.justInstalled) {
      await browser.storage.sync.set({ justInstalled: false });
      const messageInstall = document.querySelector('#template-message-install').content.firstElementChild.cloneNode(true);
      document.body.prepend(messageInstall);
    }

    document.addEventListener('change', this.#listeners.change);

    this.#translator.translate(document);
  }
}