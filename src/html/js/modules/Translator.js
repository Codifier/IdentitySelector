export class Translator
{
  translate(what, substitutions = {}) {
    switch(true) {
      case what instanceof Document:
        this.translate(document.querySelectorAll('[data-i18n]'), substitutions);
        break;
      case what instanceof NodeList:
        for(const node of what) {
          if(!(node instanceof Element) || !node.hasAttribute('data-i18n')) {
            continue;
          }
          
          const messageName = node.getAttribute('data-i18n');
          const messageSubstitutionNames = node.hasAttribute('data-i18n-subs') ? node.getAttribute('data-i18n-subs').split(',') : [];
          const messageSubstitutions = messageSubstitutionNames.reduce((o, k) => { o[k] = substitutions[k] ?? '[missing substitution ' + k + ']'; return o; }, {});
          node.textContent = this.translate(messageName, messageSubstitutions);
        }
        break;
      case typeof what === 'string':
        let translatedMessage = browser.i18n.getMessage(what, Object.values(substitutions));
        if(translatedMessage.length < 1) {
          translatedMessage = '[missing translation ' + what + ']';
        }
        
        return translatedMessage;
    }
  }
}