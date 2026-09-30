import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterModule } from "@angular/router";

import {
  SettingsActive,
  SettingsInactive,
  VaultActive,
  VaultInactive,
} from "@bitwarden/assets/svg";
import { BottomNavigationButton } from "@bitwarden/components";

import { PopupTabNavigationComponent } from "../../../platform/popup/layout/popup-tab-navigation.component";

/** Bottom navigation: Bookmarks and Settings (replaces Vault / Generator / Send / Settings). */
@Component({
  selector: "mwv-tabs",
  template: `
    <popup-tab-navigation [navButtons]="navButtons">
      <router-outlet></router-outlet>
    </popup-tab-navigation>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule, PopupTabNavigationComponent],
})
export class MyWebVaultTabsComponent {
  protected readonly navButtons: BottomNavigationButton[] = [
    { label: "bookmarks", page: "/tabs/vault", icon: VaultInactive, iconActive: VaultActive },
    {
      label: "settings",
      page: "/tabs/settings",
      icon: SettingsInactive,
      iconActive: SettingsActive,
    },
  ];
}
