import { Translator } from './Translator.js';

export class Options
{
  static SHOW_TYPE = Object.freeze({
    NEVER:          0,
    BEFORE_COMPOSE: 1,
    BEFORE_SEND:    2,
    BOTH:           3
  });

  static DEFAULT_OPTIONS = Object.freeze({
    justInstalled: true,
    justUpdated: false,
    showForReply: Options.SHOW_TYPE.BEFORE_COMPOSE,
    showForForward: Options.SHOW_TYPE.BEFORE_COMPOSE,
    showForNew: Options.SHOW_TYPE.BEFORE_COMPOSE,
    showForDraft: Options.SHOW_TYPE.NEVER,
    closeComposeWindowOnCancel: false,
    showComposeWindowAction: true
  });

  #translator = new Translator();
  #listeners = {
    handleChange: async (e) => {
      let value = null;
      switch(true) {
        case e.target instanceof HTMLInputElement && e.target.type == 'radio':
          value = +e.target.value;
          break;
        case e.target instanceof HTMLInputElement && e.target.type == 'checkbox':
          value = e.target.checked;
          break;
      }
      browser.storage.sync.set({ [e.target.name]: value });
    }
  }

  async run() {
    const storedOptions = await browser.storage.sync.get();
    for(const [key, value] of Object.entries(storedOptions)) {
      const element = document.forms['options'][key];
      if(element instanceof HTMLInputElement && element.type == 'checkbox') {
        element.checked = !!value;
      }
      else if(element instanceof RadioNodeList) {
        element.value = value;
      }
    }

    if(storedOptions.justInstalled) {
      await browser.storage.sync.set({ justInstalled: false, justUpdated: false });
      const messageInstall = document.querySelector('#template-message-install').content.firstElementChild.cloneNode(true);
      document.body.prepend(messageInstall);
    }
    else if(storedOptions.justUpdated) {
      await browser.storage.sync.set({ justInstalled: false, justUpdated: false });
      const messageUpdate = document.querySelector('#template-message-update').content.firstElementChild.cloneNode(true);
      document.body.prepend(messageUpdate);
    }

    document.addEventListener('change', this.#listeners.handleChange);

    this.#translator.translate(document);
  }
}