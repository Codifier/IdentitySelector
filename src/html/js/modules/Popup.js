import { MailIdentity } from './MailIdentity.js';
import { Translator } from './Translator.js';

export class Popup
{
  static MIN_WIDTH = 320;
  static MIN_HEIGHT = 650;

  constructor() {
    this.parameters = {};

    this.translator = new Translator();
    this.placeholderComposeTypeMap = {
      reply: 'placeholderYouReplyTo',
      forward: 'placeholderYouForward'
    };
    this.handleMessage = this.handleMessage.bind(this);
  }

  run() {
    this.header = document.querySelector('header');
    this.buttonOptions = this.header.querySelector('#options');
    this.mismatchedIdentity = document.querySelector('#template-mismatched-identity').content.firstElementChild.cloneNode(true);
    this.missingIdentity = document.querySelector('#template-missing-identity').content.firstElementChild.cloneNode(true);
    this.selectPotentialIdentities = this.missingIdentity.querySelector('#potential-identities');
    this.selectAccounts = document.querySelector('#accounts');
    this.selectIdentities = document.querySelector('#identities');
    this.buttonCancel = document.querySelector('#cancel');
    this.buttonSelect = document.querySelector('#select');

    const keyDown = async (e) => {
      switch(e.key) {
        case 'p':
          openOptions();
          break;
        case 'Escape':
          cancel();
          break;
        case 'Enter':
          selectIdentity();
          break;
      }
    }

    const openOptions = (e) => {
      browser.runtime.openOptionsPage();
    }

    const cancel = (e) => {
      window.close();
    }

    const selectIdentity = async (e) => {
      try {
        await browser.runtime.sendMessage({ action: 'set-compose-identity-request', identityId: this.selectIdentities.value });
        window.close();
      }
      catch(error) {
        alert(this.translator.translate('errorSetComposeIdentity', { errorMessage: error.message }));
      }
    }

    const selectAccount = (e) => {
      const optionAccount = this.selectAccounts.selectedOptions[0] ?? null;
      if(optionAccount != null) {
        const accountId = this.parameters.originalAccountId || this.parameters.composeAccountId;
        const identityId = this.parameters.originalIdentityId || this.parameters.composeIdentityId;
        this.selectIdentities.textContent = '';
        for(const identity of optionAccount.identities) {
          const selected = (optionAccount.value != accountId && identity === optionAccount.identities[0]) || identity.id === identityId;
          const mailboxName = MailIdentity.fromNativeMailIdentity(identity).toMailboxName();
          const option = new Option(mailboxName, identity.id, selected, selected);
          this.selectIdentities.add(option);
        }
      }
    }

    const selectPotentialIdentity = async (e) => {
      const optionPotentialIdentity = this.selectPotentialIdentities.selectedOptions[0] ?? null;
      const optionAccount = this.selectAccounts.selectedOptions[0] ?? null;
      if(optionPotentialIdentity != null && optionAccount != null) {
        if(!confirm(this.translator.translate('confirmCreateIdentity', { identityEmail: optionPotentialIdentity.label, accountName: optionAccount.label }))) {
          this.selectPotentialIdentities.selectedIndex = -1;
          this.selectPotentialIdentities.blur();
        }
        else {
          try {
            await browser.runtime.sendMessage({ action: 'create-identity-request', accountId: optionAccount.value, identityEmail: optionPotentialIdentity.label });
          }
          catch(error) {
            alert(this.translator.translate('errorCreateIdentity', { errorMessage: error.message }));
          }
        }
      }
    }
    
    window.addEventListener('keydown', keyDown);

    this.buttonOptions.addEventListener('click', openOptions);
    this.selectPotentialIdentities.addEventListener('click', selectPotentialIdentity);
    this.selectAccounts.addEventListener('change', selectAccount);
    this.buttonCancel.addEventListener('click', cancel);
    this.buttonSelect.addEventListener('click', selectIdentity);

    browser.runtime.onMessage.addListener(this.handleMessage);
    browser.runtime.sendMessage({ action: 'parameters-request' });

    this.translator.translate(document);
  }

  async redraw() {
    const storedOptions = await browser.storage.sync.get();
    const accountId = this.parameters.originalAccountId || this.parameters.composeAccountId;
    const identityId = this.parameters.originalIdentityId || this.parameters.composeIdentityId;
    const isMismatchedIdentity = !!this.parameters.isMismatchedIdentity;
    const isMissingIdentity = !!this.parameters.isMissingIdentity;
    const potentialIdentityEmails = this.parameters.potentialIdentityEmails || [];
    const accounts = (await browser.accounts.list()).filter(account => account.type != 'none');
    const translationSubstitutions = {
      composeAction: (this.parameters.composeType in this.placeholderComposeTypeMap) ? this.translator.translate(this.placeholderComposeTypeMap[this.parameters.composeType]) : ''
    };
    
    isMissingIdentity && this.header.after(this.missingIdentity);
    isMismatchedIdentity && this.header.after(this.mismatchedIdentity);

    this.selectPotentialIdentities.textContent = '';
    for(const potentialIdentityEmail of potentialIdentityEmails) {
      const option = new Option(potentialIdentityEmail, potentialIdentityEmail);
      this.selectPotentialIdentities.add(option);
    }

    this.selectAccounts.textContent = '';
    for(const account of accounts) {
      const current = account.id == this.parameters.composeAccountId;
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
      this.selectAccounts.add(option);
    }

    this.selectAccounts.dispatchEvent(new Event('change'));

    this.translator.translate(document, translationSubstitutions);
  }

  async handleMessage(message, sender, sendResponse) {
    if(sender.tab != null) {
      return;
    }

    if(!message.success) {
      alert(this.translator.translate('errorOperationFailed', { errorMessage: message.error.message }));
      return;
    }

    switch(message.action) {
      case 'parameters-response':
        this.parameters = message.parameters || {};
        this.redraw();
        break;
      case 'create-identity-response':
        browser.runtime.sendMessage({ action: 'recreate-compose-window-request', identity: message.identity });
        break;
    }
  }
}