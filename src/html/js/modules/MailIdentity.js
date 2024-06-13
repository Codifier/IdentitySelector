export class MailIdentity
{
  static extractDomain(email) {
    return email.split('@')[1];
  }
  
  static fromNativeMailIdentity(nativeMailIdentity) {
    return new MailIdentity(nativeMailIdentity.email, nativeMailIdentity.name || null, nativeMailIdentity.label || null);
  }
  
  static fromString(identifier) {
    let email = null;
    let name = null;
    let label = null;

    const labelMatch = identifier.match(/\(([^)]+)\)$/);
    if(labelMatch) {
      label = labelMatch[1].trim();
      identifier = identifier.substring(0, labelMatch.index).trim();
    }

    const bracketMatch = identifier.match(/<([^>]+)>/);
    if(bracketMatch) {
      email = bracketMatch[1].trim();
      name = identifier.substring(0, bracketMatch.index).trim();
    } 
    else {
      const emailMatch = identifier.match(/([^<>\s]+@[^\s>]+)/);
      if(emailMatch) {
        email = emailMatch[0].trim();
        name = identifier.replace(email, '').trim();
      }
    }

    return new MailIdentity(email, name || null, label || null);
  }

  constructor(email, name = null, label = null) {
    this.email = email;
    this.name = name;
    this.label = label;
  }
  
  getDomain() {
    return MailIdentity.extractDomain(this.email);
  }
  
  toMailboxName(includeLabel = true) {
    let mailboxName = this.email;
    if(this.name != null) {
      mailboxName = this.name + ' <' + mailboxName + '>';
    }
    if(includeLabel && this.label != null) {
      mailboxName += ' (' + this.label + ')';
    }
    
    return mailboxName;
  }
}