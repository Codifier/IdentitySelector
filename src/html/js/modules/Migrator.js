class Version
{
  #major = 0;
  #minor = null;
  #patch = null;

  static fromAny(version) {
    if(version instanceof Version) {
      return version;
    }
    else if(typeof version === 'string') {
      return Version.fromString(version);
    }

    throw new TypeError(`Invalid version: ${version}; must be string or instance of Version`);
  }

  static fromString(string) {
    const match = string.match(/^(?<major>\d+)(?:\.(?<minor>\d+)(?:\.(?<patch>\d+))?)?$/);
    if(match == null) {
      throw new Error(`Invalid version string: ${string}`);
    }

    return new Version(match.groups.major, match.groups.minor ?? null, match.groups.patch ?? null);
  }

  constructor(major, minor, patch = null) {
    if(!/^\d+$/.test(`${major}`)) {
      throw new TypeError(`Invalid major value: ${major}; must be integer larger than or equal to zero`);
    }
    if(minor != null && !/^\d+$/.test(`${minor}`)) {
      throw new TypeError(`Invalid minor value: ${minor}; must be integer larger than or equal to zero`);
    }
    if(patch != null && !/^\d+$/.test(`${patch}`)) {
      throw new TypeError(`Invalid patch value: ${patch}; must be null or integer larger than or equal to zero`);
    }

    this.#major = +major;
    this.#minor = minor != null ? +minor : null;
    this.#patch = patch != null ? +patch : null;
  }

  toString() {
    let version = `${this.#major}`;
    if(this.#minor != null) {
      version = `${version}.${this.#minor}`;
      if(this.#patch != null) {
        version = `${version}.${this.#patch}`;
      }
    }

    return version
  }

  toCanonical() {
    return new Version(this.#major, this.#minor ?? 0, this.#patch ?? 0);
  }

  compareTo(version) {
    version = Version.fromAny(version).toCanonical();
    const self = this.toCanonical();
    if(self < version) {
      return -1;
    }
    else if(self > version) {
      return 1;
    }
    return 0;
  }

  get major() {
    return this.#major;
  }

  get minor() {
    return this.#minor;
  }

  get patch() {
    return this.#patch;
  }
}

class Migration
{
  #minVersion;
  #openOptionsPage;
  #upgrader;
  #downgrader;

  constructor(minVersion, upgrader, downgrader, openOptionsPage = false) {
    if(typeof upgrader !== 'function') {
      throw new TypeError(`Invalid upgrader: ${upgrader}; must be a function`);
    }
    if(typeof downgrader !== 'function') {
      throw new TypeError(`Invalid downgrader: ${downgrader}; must be a function`);
    }
    this.#minVersion = Version.fromAny(minVersion).toCanonical();
    this.#openOptionsPage = !!openOptionsPage;
    this.#upgrader = upgrader.bind(this);
    this.#downgrader = downgrader.bind(this);
  }

  get minVersion() {
    return this.#minVersion;
  }

  get openOptionsPage() {
    return this.#openOptionsPage;
  }

  async upgrade() {
    return this.#upgrader();
  }

  async downgrade() {
    return this.#downgrader();
  }
}

const migrations = [
  new Migration(
    '0.4.0',
    async function() {
      const storedOptions = await browser.storage.sync.get();
      // convert booleans to integers: 0 = never, 1 = before compose, 2 = before send
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
].sort((a, b) => a.minVersion.compareTo(b.minVersion));

export class Migrator
{
  async migrate(from, to) {
    let openOptionsPage = false;
    from = Version.fromAny(from).toCanonical();
    to = Version.fromAny(to).toCanonical();
    const comparison = to.compareTo(from);
    if(comparison < 0) { // downgrade
      // TODO: Is this even possible? browser.runtime.onInstalled does not appear to be called for downgrades
    }
    else if(comparison > 0) {  // upgrade
      let previousVersion = from;
      for(const migration of migrations) {
        if(to >= migration.minVersion && previousVersion <= migration.minVersion) {
          await migration.upgrade();
          openOptionsPage = openOptionsPage || migration.openOptionsPage;
          previousVersion = migration.minVersion;
        }
      }
    }

    return openOptionsPage;
  }
}