/**
 * myWebVault is a bookmark manager built on the Bitwarden browser extension.
 *
 * Bitwarden's password-manager behaviour that reaches into web pages (autofill scripts, the inline
 * autofill menu, passkey interception, the autofill context menu, the welcome page and the "make
 * Bitwarden your default password manager" prompt) is switched off here, so this extension never
 * competes with a real password manager installed alongside it.
 *
 * Guarding at these entry points (rather than deleting code) keeps the fork easy to update from
 * upstream Bitwarden until the password features are removed for good.
 */
export const MYWEBVAULT_PASSWORD_FEATURES = false;

/**
 * Account options that need something myWebVault doesn't have (yet): Bitwarden's web app, its
 * desktop app (biometric unlock), or server endpoints (devices, two-step login, changing the master
 * password). Hidden rather than shown and broken.
 */
export const BITWARDEN_ACCOUNT_FEATURES = false;
