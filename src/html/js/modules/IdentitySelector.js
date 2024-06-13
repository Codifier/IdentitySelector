import { IdentityMediator } from './IdentityMediator.js';

export class IdentitySelector
{
  static DEFAULT_OPTIONS = Object.freeze({
    justInstalled: true,
    showForReply: true,
    showForForward: true,
    showForNew: true,
    showForDraft: false,
    closeComposeWindowOnCancel: false
  });
  
  constructor() {
    browser.runtime.onInstalled.addListener(async function(details) {
      switch(details.reason) {
        case 'install':
          await browser.storage.sync.set({ justInstalled: true });
          browser.runtime.openOptionsPage();
          break;
      }
    });
    
    this.handleTabCreated = this.handleTabCreated.bind(this);
  }
  
  async run() {
    const storedOptions = await browser.storage.sync.get();
    const options = { ...IdentitySelector.DEFAULT_OPTIONS, ...storedOptions };
    browser.storage.sync.set(options);
    
    browser.tabs.onCreated.addListener(this.handleTabCreated);
  }

  async handleTabCreated(tab) {
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
    
    new IdentityMediator(tab).run();
  }
}