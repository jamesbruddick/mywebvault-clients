import { Observable } from "rxjs";

import { BottomNavigationButton } from "@bitwarden/components";
import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * The Health tab's entry in the popup's bottom navigation, rendered between Send and Settings.
 *
 * The Health report feature is part of upstream Bitwarden's commercial extension and is not included
 * in this fork, so this token is never provided and the Health tab is always hidden.
 */
export const HEALTH_TAB_NAV_BUTTON = new SafeInjectionToken<
  Observable<BottomNavigationButton | undefined>
>("HEALTH_TAB_NAV_BUTTON");
