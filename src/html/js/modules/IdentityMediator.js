import { Popup } from './Popup.js';
import { MailIdentity } from './MailIdentity.js';

export class IdentityMediator
{
  constructor(identitySelector, tab, options = {}) {
    if(tab.type != 'messageCompose') {
      throw new Error('Invalid Tab.type; should be messageCompose, but got: ' + tab.type);
    }

    this.composeIdentitySet = false;
    this.running = false;
    this.identitySelector = identitySelector;
    this.options = options;
    this.composeWindowId = tab.windowId;
    this.composeTabId = tab.id;
    this.popupWindowId = null;
    this.popupTabId = null;

    this.handleMessage = this.handleMessage.bind(this);
    this.handleTabRemoved = this.handleTabRemoved.bind(this);
    this.handleWindowFocusChanged = this.handleWindowFocusChanged.bind(this);
  }

  setOptions(options = {}) {
    this.options = options;

    return this;
  }

  createPopupBounds(composeWindow, preferredWidth, preferredHeight) {
    const width = Math.max(Popup.MIN_WIDTH, Math.min(Popup.MAX_WIDTH, preferredWidth, composeWindow.width - 100));
    const height = Math.max(Popup.MIN_HEIGHT, Math.min(Popup.MAX_HEIGHT, preferredHeight, composeWindow.height - 100));
    const left = Math.round(composeWindow.left + composeWindow.width / 2 - width / 2);
    const top = Math.round(composeWindow.top + composeWindow.height / 2 - height / 2);

    return { width, height, left, top };
  }

  async run() {
    if(this.running || this.composeTabId == null || this.popupTabId != null) {
      return;
    }

    try {
      this.running = true;

      await this.refresh();

      browser.runtime.onMessage.addListener(this.handleMessage);
      browser.tabs.onRemoved.addListener(this.handleTabRemoved);
      browser.windows.onFocusChanged.addListener(this.handleWindowFocusChanged);

      const composeWindow = await browser.windows.get(this.composeWindowId);
      const popupInfo = this.createPopupBounds(composeWindow, Popup.MAX_WIDTH, Popup.MIN_HEIGHT);
      popupInfo.url = browser.runtime.getURL('/html/popup.html');
      popupInfo.type = 'popup';
      popupInfo.allowScriptsToClose = true;
      const popupWindow = await browser.windows.create(popupInfo);
      browser.composeAction.disable(this.composeTabId);

      this.popupWindowId = popupWindow.id;
      this.popupTabId = popupWindow.tabs[0].id;
    }
    finally {
      this.running = false;
    }
  }

  async handleMessage(message, sender, sendResponse) {
    if(this.popupTabId == null || sender.tab.id != this.popupTabId) {
      return;
    }

    const response = {
      action: 'unknown',
      success: true,
      error: null
    };

    switch(message.action) {
      case 'parameters-request':
        response.action = 'parameters-response';
        response.parameters = null;
        try {
          if(message.refresh) {
            await this.refresh();
          }

          response.parameters = this.parameters;
        }
        catch(error) {
          response.success = false;
          response.error = error;
        }
        browser.tabs.sendMessage(this.popupTabId, response);
        break;

      case 'resize-popup-request':
        response.action = 'resize-popup-response';
        try {
          const composeWindow = await browser.windows.get(this.composeWindowId);
          const popupInfo = this.createPopupBounds(composeWindow, Popup.MAX_WIDTH, message.height);
          await browser.windows.update(this.popupWindowId, popupInfo);
        }
        catch(error) {
          response.success = false;
          response.error = error;
        }
        browser.tabs.sendMessage(this.popupTabId, response);
        break;

      case 'create-identity-request':
        response.action = 'create-identity-response';
        try {
          const identity = await browser.identities.create(message.accountId, { email: message.identityEmail });
          response.identity = identity;
        }
        catch(error) {
          response.success = false;
          response.error = error;
        }
        browser.tabs.sendMessage(this.popupTabId, response);
        break;

      case 'recreate-compose-window-request':
        response.action = 'recreate-compose-window-response';
        try {
          const composeDetails = await browser.compose.getComposeDetails(this.composeTabId);
          await browser.tabs.remove(this.composeTabId);

          composeDetails.from = null;
          composeDetails.identityId = message.identity.id;

          switch(composeDetails.type) {
            case 'new':
            case 'draft':
              await browser.compose.beginNew(null, composeDetails);
              break;
            case 'reply':
              await browser.compose.beginReply(composeDetails.relatedMessageId, null, composeDetails);
              break;
            case 'forward':
              await browser.compose.beginForward(composeDetails.relatedMessageId, null, composeDetails);
              break;
          }
        }
        catch(error) {
          response.success = false;
          response.error = error;
          browser.tabs.sendMessage(this.popupTabId, response);
        }
        // can't send to popup anymore after successful close
        break;

      case 'set-compose-identity-request':
        response.action = 'set-compose-identity-response';
        try {
          await browser.compose.setComposeDetails(this.composeTabId, { identityId: message.identityId });
          this.composeIdentitySet = true;
        }
        catch(error) {
          response.success = false;
          response.error = error;
        }
        browser.tabs.sendMessage(this.popupTabId, response);
        break;
    }
  }

  async refresh() {
    const accounts = (await browser.accounts.list()).filter(account => account.type != 'none');
    const composeDetails = await browser.compose.getComposeDetails(this.composeTabId);
    const composeIdentity = await browser.identities.get(composeDetails.identityId);
    const composeAccount = await browser.accounts.get(composeIdentity.accountId);
    let originalIdentity = {};
    let originalAccount = {};

    const composeAccountIdentityEmail = (composeAccount.identities[0] || { email: null }).email;
    const composeAccountIdentityEmailSet = new Set(composeAccount.identities.map(identity => identity.email));
    const allAccountsIdentityEmailSet = new Set(accounts.flatMap(account => account.identities.map(identity => identity.email)));

    let isMismatchedIdentity = false;
    let isMissingIdentity = false;
    let potentialIdentityEmails = [];

    switch(composeDetails.type) {
      case 'new':
        break;
      case 'draft':
        break;
      case 'reply':
      case 'forward':
        const relatedMessageId = composeDetails.relatedMessageId;
        if(relatedMessageId != null) {
          const relatedMessageHeader = await browser.messages.get(relatedMessageId);
          if(relatedMessageHeader != null) {
            const tos = relatedMessageHeader.recipients.map(identifier => MailIdentity.fromString(identifier).email);
            const ccs = relatedMessageHeader.ccList.map(identifier => MailIdentity.fromString(identifier).email);
            const bccs = relatedMessageHeader.bccList.map(identifier => MailIdentity.fromString(identifier).email);
            const relatedMessageEmailSet = new Set([...tos, ...ccs, ...bccs]);

            const allAccountsMatchedIdentityEmails = [...relatedMessageEmailSet].filter(email => allAccountsIdentityEmailSet.has(email));
            const composeAccountMatchedIdentityEmails = [...relatedMessageEmailSet].filter(email => composeAccountIdentityEmailSet.has(email));

            isMissingIdentity = allAccountsMatchedIdentityEmails.length < 1;
            if(composeAccountIdentityEmail != null) {
              const composeAccountIdentityDomain = MailIdentity.extractDomain(composeAccountIdentityEmail);
              potentialIdentityEmails = [...relatedMessageEmailSet].filter(email => MailIdentity.extractDomain(email) === composeAccountIdentityDomain);
            }
            isMismatchedIdentity = !isMissingIdentity && composeAccountMatchedIdentityEmails.length < 1;
            if(isMismatchedIdentity) {
              outerLoop:
              for(const account of accounts) {
                for(const identity of account.identities) {
                  if(allAccountsMatchedIdentityEmails.includes(identity.email)) {
                    originalIdentity = identity;
                    originalAccount = account;
                    break outerLoop;
                  }
                }
              }
            }
          }
        }
        break;
      default:
        throw new Error('Unsupported ComposeDetails.type: ' + composeDetails.type);
        break;
    }

    this.parameters = {
      composeType: composeDetails.type,
      composeAccountId: composeAccount.id,
      composeIdentityId: composeIdentity.id,
      originalAccountId: originalAccount.id || null,
      originalIdentityId: originalIdentity.id || null,
      isMismatchedIdentity,
      isMissingIdentity,
      potentialIdentityEmails
    };
  }

  async handleTabRemoved(tabId) {
    if(tabId == this.composeTabId) {
      this.composeWindowId = this.composeTabId = null;
      this.identitySelector.removeMediator(this.composeTabId);
      if(this.popupTabId != null) {
        browser.tabs.remove(this.popupTabId);
      }
    }
    else if(tabId == this.popupTabId) {
      this.popupWindowId = this.popupTabId = null;
      browser.windows.onFocusChanged.removeListener(this.handleWindowFocusChanged);
      browser.tabs.onRemoved.removeListener(this.handleTabRemoved);
      browser.runtime.onMessage.removeListener(this.handleMessage);
      browser.composeAction.enable(this.composeTabId);

      if(this.composeTabId != null && !this.composeIdentitySet) {
        const storedOptions = await browser.storage.sync.get();
        const options = { ...storedOptions, ...this.options };
        if(options.closeComposeWindowOnCancel) {
          browser.tabs.remove(this.composeTabId);
        }
      }
    }
  }

  async handleWindowFocusChanged(windowId) {
    if(this.popupWindowId != null && windowId == this.composeWindowId) {
      browser.windows.update(this.popupWindowId, { focused: true });
    }
  }
}