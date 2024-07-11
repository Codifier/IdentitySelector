import { Migration } from './modules/Migration.js';

export const migrations = [
  new Migration(
    '0.4.0',
    async function() {
      const storedOptions = await browser.storage.sync.get();
      // convert booleans to integers: 0 = never, 1 = before compose, 2 = before send, 3 = both
      storedOptions.showForReply   = +storedOptions.showForReply;
      storedOptions.showForForward = +storedOptions.showForForward;
      storedOptions.showForNew     = +storedOptions.showForNew;
      storedOptions.showForDraft   = +storedOptions.showForDraft;

      return browser.storage.sync.set(storedOptions);
    },
    function() {
      // NO-OP
    }
  )
];