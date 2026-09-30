import { Route, Routes } from "@angular/router";

import { authGuard } from "@bitwarden/angular/auth/guards";

import { IntroCarouselGuard } from "../../vault/popup/guards/intro-carousel.guard";

import { BookmarkEditComponent } from "./pages/bookmark-edit.component";
import { BookmarksComponent } from "./pages/bookmarks.component";
import { ImportBookmarksComponent } from "./pages/import-bookmarks.component";
import { MyWebVaultSettingsComponent } from "./pages/mywebvault-settings.component";
import { MyWebVaultTabsComponent } from "./pages/mywebvault-tabs.component";

/**
 * Password-manager pages that myWebVault doesn't offer. Anything that still navigates to them
 * (old links, background messages) lands on the bookmark list instead.
 */
const REMOVED_ROUTES = new Set([
  "view-cipher",
  "cipher-password-history",
  "new-item",
  "add-cipher",
  "edit-cipher",
  "clone-cipher",
  "attachments",
  "generator",
  "generator-history",
  "import",
  "import-source-select",
  "autofill",
  "notifications",
  "vault-settings",
  "blocked-domains",
  "excluded-domains",
  "premium",
  "add-send",
  "edit-send",
  "send-created",
  "share-item",
  "assign-collections",
  "more-from-bitwarden",
  "download-bitwarden",
  "default-password-manager-prompt",
  "intro-carousel",
  "at-risk-passwords",
  "trash",
  "archive",
  "admin",
  "autofill-triage",
]);

const ELEVATION_TOP = { elevation: 0 };
const ELEVATION_CHILD = { elevation: 1 };

/**
 * Adapts Bitwarden's popup routes (popup/app-routing.module.ts) for myWebVault, leaving that file
 * nearly untouched so upstream updates stay easy to merge. The route paths the rest of the code
 * relies on (/tabs/vault, /tabs/settings) are kept; only the components behind them change.
 */
export function applyMyWebVaultRoutes(routes: Routes): void {
  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    if (route.path && REMOVED_ROUTES.has(route.path)) {
      routes[i] = { path: route.path, redirectTo: "/tabs/vault", pathMatch: "full" };
    } else if (route.path === "tabs") {
      routes[i] = tabsRoute();
    } else {
      removeIntroCarousel(route);
    }
  }

  routes.push(
    {
      path: "bookmark",
      component: BookmarkEditComponent,
      canActivate: [authGuard],
      data: ELEVATION_CHILD,
    },
    {
      path: "import-bookmarks",
      component: ImportBookmarksComponent,
      canActivate: [authGuard],
      data: ELEVATION_CHILD,
    },
  );
}

function tabsRoute(): Route {
  return {
    path: "tabs",
    component: MyWebVaultTabsComponent,
    data: ELEVATION_TOP,
    children: [
      { path: "", redirectTo: "/tabs/vault", pathMatch: "full" },
      { path: "current", redirectTo: "/tabs/vault" },
      {
        path: "vault",
        component: BookmarksComponent,
        canActivate: [authGuard],
        data: ELEVATION_TOP,
      },
      { path: "vault/:vaultId", redirectTo: "/tabs/vault" },
      {
        path: "settings",
        component: MyWebVaultSettingsComponent,
        canActivate: [authGuard],
        data: ELEVATION_TOP,
      },
      { path: "generator", redirectTo: "/tabs/vault" },
      { path: "send", redirectTo: "/tabs/vault" },
    ],
  };
}

/** Bitwarden shows a marketing carousel before the first login; myWebVault doesn't. */
function removeIntroCarousel(route: Route): void {
  if (route.canActivate) {
    route.canActivate = route.canActivate.filter((guard) => guard !== IntroCarouselGuard);
  }
  route.children?.forEach(removeIntroCarousel);
}
