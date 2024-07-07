import { Options } from './Options.js';
import { IdentityMediator } from './IdentityMediator.js';

export class Background
{
  #mediatorMap = {};
  #listeners = {
    handleTabCreated: (tab) => {
      this.#listeners.maybeCreateMediatorForTab(tab);
    },
    handleComposeActionClicked: async (tab, clickData) => {
      this.#listeners.maybeCreateMediatorForTab(tab, { closeComposeWindowOnCancel: false });
    },
    maybeCreateMediatorForTab: async (tab, options = {}) => {
      if(tab.type != 'messageCompose') {
        return;
      }

      const storedOptions = await browser.storage.sync.get();
      const composeDetails = await browser.compose.getComposeDetails(tab.id);
      switch(composeDetails.type) {
        case 'new':
        case 'draft':
        case 'reply':
        case 'forward':
          const optionName = 'showFor' + composeDetails.type.charAt(0).toUpperCase() + composeDetails.type.slice(1);
          if(!storedOptions[optionName]) {
            return;
          }
          break;
        default:
          return;
      }

      this.#mediatorMap[tab.id] = this.#mediatorMap[tab.id] ?? new IdentityMediator(this, tab);
      this.#mediatorMap[tab.id]
        .setOptions(options)
        .run();
    }
  };

  constructor() {
    browser.runtime.onInstalled.addListener(async function(details) {
      switch(details.reason) {
        case 'install':
          await browser.storage.sync.set({ justInstalled: true });
          browser.runtime.openOptionsPage();
          break;
      }
    });
  }

  async run() {
    const storedOptions = await browser.storage.sync.get();
    const options = { ...Options.DEFAULT_OPTIONS, ...storedOptions };
    browser.storage.sync.set(options);

    browser.tabs.onCreated.addListener(this.#listeners.handleTabCreated);
    browser.composeAction.onClicked.addListener(this.#listeners.handleComposeActionClicked);
  }

  removeMediator(composeTabId) {
    delete this.#mediatorMap[composeTabId];
  }
}
