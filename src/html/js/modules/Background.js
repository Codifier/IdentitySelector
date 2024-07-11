import { Options } from './Options.js';
import { IdentityMediator } from './IdentityMediator.js';
import { Migrator } from './Migration.js';
import { migrations } from './../migrations.js';

export class Background
{
  #mediatorMap = {};
  #storedOptions = Options.DEFAULT_OPTIONS;
  #listeners = {
    handleStorageChanged: async (changes, areaName) => { // areaName appears to always be undefined; Thunderbird bug?
      const storedOptions = await browser.storage.sync.get();
      this.#storedOptions = { ...Options.DEFAULT_OPTIONS, ...storedOptions };
      for(const mediator of Object.values(this.#mediatorMap)) {
        mediator.setOptions(this.#storedOptions);
      }
    },
    handleTabCreated: async (tab) => {
      if(tab.type == 'messageCompose') {
        const composeDetails = await browser.compose.getComposeDetails(tab.id);
        this.#maybeCreateMediatorForTab(tab, IdentityMediator.INITIATOR.BEFORE_COMPOSE, composeDetails);
      }
    },
    handleComposeActionClicked: async (tab, clickData) => {
      if(tab.type == 'messageCompose') {
        const composeDetails = await browser.compose.getComposeDetails(tab.id);
        this.#maybeCreateMediatorForTab(tab, IdentityMediator.INITIATOR.COMPOSE_ACTION, composeDetails);
      }
    },
    handleComposeBeforeSend: (tab, composeDetails) => {
      return {
        cancel: this.#maybeCreateMediatorForTab(tab, IdentityMediator.INITIATOR.BEFORE_SEND, composeDetails)
      };
    }
  };

  constructor() {
    browser.runtime.onInstalled.addListener(async function(details) {
      switch(details.reason) {
        case 'install':
          await browser.storage.sync.set({ justInstalled: true, justUpdated: false });
          browser.runtime.openOptionsPage();
          break;
        case 'update':
          const migrator = new Migrator(migrations);
          const currentVersion = (await browser.runtime.getManifest()).version;
          const openOptionsPage = await migrator.migrate(details.previousVersion, currentVersion);
          if(openOptionsPage) {
            await browser.storage.sync.set({ justInstalled: false, justUpdated: true });
            browser.runtime.openOptionsPage();
          }
          break;
      }
    });
  }

  async run() {
    browser.storage.sync.onChanged.addListener(this.#listeners.handleStorageChanged);
    browser.tabs.onCreated.addListener(this.#listeners.handleTabCreated);
    browser.compose.onBeforeSend.addListener(this.#listeners.handleComposeBeforeSend);
    browser.composeAction.onClicked.addListener(this.#listeners.handleComposeActionClicked);

    const storedOptions = await browser.storage.sync.get();
    const options = { ...Options.DEFAULT_OPTIONS, ...storedOptions };
    browser.storage.sync.set(options);
  }

  removeMediator(composeTabId) {
    delete this.#mediatorMap[composeTabId];
  }

  #maybeCreateMediatorForTab(tab, initiator, composeDetails) {
    if(tab.type != 'messageCompose') {
      return false;
    }

    this.#mediatorMap[tab.id] = this.#mediatorMap[tab.id] ?? new IdentityMediator(this, tab);
    return this.#mediatorMap[tab.id]
      .setOptions(this.#storedOptions)
      .maybeOpenPopup(initiator, composeDetails);
  }
}
