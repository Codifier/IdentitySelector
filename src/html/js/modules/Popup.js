import { MailIdentity } from './MailIdentity.js';
import { Translator } from './Translator.js';

export class Popup
{
  static MIN_WIDTH = 320;
  static MAX_WIDTH = 600;
  static MIN_HEIGHT = 300;
  static MAX_HEIGHT = 650;

  #parameters = {};
  #elements = {};
  #translator = new Translator();
  #placeholderComposeTypeMap = {
    reply: 'placeholderYouReplyTo',
    forward: 'placeholderYouForward'
  };
  #listeners = {
    handleMessage: (message, sender, sendResponse) => {
      if(sender.tab != null) {
        return;
      }

      if('success' in message && !message.success) {
        alert(this.#translator.translate('errorOperationFailed', { errorMessage: message.error.message }));
        return;
      }

      switch(message.action) {
        case 'parameters-response':
          this.#parameters = message.parameters || {};
          this.#redraw();
          break;
        case 'create-identity-response':
          browser.runtime.sendMessage({ action: 'recreate-compose-window-request', identity: message.identity });
          break;
      }
    },
    handleKeyDown: (e) => {
      switch(e.key) {
        case 'p':
          this.#openOptionsPage();
          break;
        case 'Escape':
          this.#close();
          break;
        case 'Enter':
          this.#selectIdentity();
          break;
      }
    },
    handleOptionsClick: (e) => {
      this.#openOptionsPage();
    },
    handleSelectPotentialIdentity: (e) => {
      this.#selectPotentialIdentity();
    },
    handleSelectAccount: (e) => {
      this.#selectAccount();
    },
    handleCancelClick: (e) => {
      this.#close();
    },
    handleSelectClick: (e) => {
      this.#selectIdentity();
    }
  };

  run() {
    this.#initializeElements();
    this.#initializeListeners();

    browser.runtime.sendMessage({ action: 'parameters-request' });

    this.#translator.translate(document);
  }

  #openOptionsPage() {
    browser.runtime.openOptionsPage();
  }

  #close() {
    window.close();
  }

  async #selectPotentialIdentity() {
    const optionPotentialIdentity = this.#elements.selectPotentialIdentities.selectedOptions[0] ?? null;
    const optionAccount = this.#elements.selectAccounts.selectedOptions[0] ?? null;
    if(optionPotentialIdentity != null && optionAccount != null) {
      if(!confirm(this.#translator.translate('confirmCreateIdentity', { identityEmail: optionPotentialIdentity.label, accountName: optionAccount.label }))) {
        this.#elements.selectPotentialIdentities.selectedIndex = -1;
        this.#elements.selectPotentialIdentities.blur();
      }
      else {
        try {
          await browser.runtime.sendMessage({ action: 'create-identity-request', accountId: optionAccount.value, identityEmail: optionPotentialIdentity.label });
        }
        catch(error) {
          alert(this.#translator.translate('errorCreateIdentity', { errorMessage: error.message }));
        }
      }
    }
  }

  #selectAccount() {
    const optionAccount = this.#elements.selectAccounts.selectedOptions[0] ?? null;
    if(optionAccount != null) {
      const accountId = this.#parameters.originalAccountId || this.#parameters.composeAccountId;
      const identityId = this.#parameters.originalIdentityId || this.#parameters.composeIdentityId;
      this.#elements.selectIdentities.textContent = '';
      for(const identity of optionAccount.identities) {
        const selected = (optionAccount.value != accountId && identity === optionAccount.identities[0]) || identity.id === identityId;
        const mailboxName = MailIdentity.fromNativeMailIdentity(identity).toMailboxName();
        const option = new Option(mailboxName, identity.id, selected, selected);
        this.#elements.selectIdentities.add(option);
      }

      this.#requestResize();
    }
  }

  async #selectIdentity() {
    try {
      await browser.runtime.sendMessage({ action: 'set-compose-identity-request', identityId: this.#elements.selectIdentities.value });
      this.#close();
    }
    catch(error) {
      alert(this.#translator.translate('errorSetComposeIdentity', { errorMessage: error.message }));
    }
  }

  #initializeElements() {
    this.#elements.header = document.querySelector('header');
    this.#elements.buttonOptions = this.#elements.header.querySelector('#options');
    this.#elements.mismatchedIdentity = document.querySelector('#template-mismatched-identity').content.firstElementChild.cloneNode(true);
    this.#elements.missingIdentity = document.querySelector('#template-missing-identity').content.firstElementChild.cloneNode(true);
    this.#elements.selectPotentialIdentities = this.#elements.missingIdentity.querySelector('#potential-identities');
    this.#elements.selectAccounts = document.querySelector('#accounts');
    this.#elements.selectIdentities = document.querySelector('#identities');
    this.#elements.buttonCancel = document.querySelector('#cancel');
    this.#elements.buttonSelect = document.querySelector('#select');
  }

  #initializeListeners() {
    window.addEventListener('keydown', this.#listeners.handleKeyDown);

    this.#elements.buttonOptions.addEventListener('click', this.#listeners.handleOptionsClick);
    this.#elements.selectPotentialIdentities.addEventListener('click', this.#listeners.handleSelectPotentialIdentity);
    this.#elements.selectAccounts.addEventListener('change', this.#listeners.handleSelectAccount);
    this.#elements.buttonCancel.addEventListener('click', this.#listeners.handleCancelClick);
    this.#elements.buttonSelect.addEventListener('click', this.#listeners.handleSelectClick);

    browser.runtime.onMessage.addListener(this.#listeners.handleMessage);
  }

  async #redraw() {
    const storedOptions = await browser.storage.sync.get();
    const accountId = this.#parameters.originalAccountId || this.#parameters.composeAccountId;
    const identityId = this.#parameters.originalIdentityId || this.#parameters.composeIdentityId;
    const isMismatchedIdentity = !!this.#parameters.isMismatchedIdentity;
    const isMissingIdentity = !!this.#parameters.isMissingIdentity;
    const potentialIdentityEmails = this.#parameters.potentialIdentityEmails || [];
    const accounts = (await browser.accounts.list()).filter(account => account.type != 'none');
    const translationSubstitutions = {
      composeAction: (this.#parameters.composeType in this.#placeholderComposeTypeMap) ? this.#translator.translate(this.#placeholderComposeTypeMap[this.#parameters.composeType]) : ''
    };

    isMissingIdentity && this.#elements.header.after(this.#elements.missingIdentity);
    isMismatchedIdentity && this.#elements.header.after(this.#elements.mismatchedIdentity);

    this.#elements.selectPotentialIdentities.textContent = '';
    for(const potentialIdentityEmail of potentialIdentityEmails) {
      const option = new Option(potentialIdentityEmail, potentialIdentityEmail);
      this.#elements.selectPotentialIdentities.add(option);
    }

    this.#elements.selectAccounts.textContent = '';
    for(const account of accounts) {
      const current = account.id == this.#parameters.composeAccountId;
      const selected = account.id === accountId;
      if(current) {
        translationSubstitutions.currentAccount = account.name;
      }
      else if(selected) {
        translationSubstitutions.identityAccount = account.name;
      }
      const option = new Option(account.name, account.id, selected, selected);
      option.identities = account.identities;
      option.classList.toggle('current', current);
      this.#elements.selectAccounts.add(option);
    }

    this.#elements.selectAccounts.dispatchEvent(new Event('change'));

    this.#translator.translate(document, translationSubstitutions);

    this.#requestResize();

    window.focus();
  }

  #requestResize() {
    browser.runtime.sendMessage({ action: 'resize-popup-request', height: document.body.scrollHeight });
  }
}