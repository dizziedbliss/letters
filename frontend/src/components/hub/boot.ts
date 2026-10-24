const BOOT_SEEN_KEY = 'hub_boot_seen';

/** First time the hub loads in this tab without arriving through a wipe (e.g. a refresh). */
export const shouldBoot = () => {
  try {
    return sessionStorage.getItem(BOOT_SEEN_KEY) !== '1';
  } catch {
    return false;
  }
};

export const markBootSeen = () => {
  try {
    sessionStorage.setItem(BOOT_SEEN_KEY, '1');
  } catch {
    // private mode: it just boots again next time
  }
};
