import { svg } from "../svg";

// myWebVault wordmark ("Geometric W" + "myWebVault"). Colours come from
// apps/browser/src/mywebvault/theme.css. Export name kept so upstream imports still resolve.
export const BitwardenLogo = svg`
  <svg viewBox="0 0 250 45" xmlns="http://www.w3.org/2000/svg">
    <title>myWebVault</title>
    <g transform="translate(-8 -17.5) scale(0.2)"><polygon class="mwv-logo-w-left" points="40,110 102,110 135.5,203.5 169,110 231,110 166.5,290 104.5,290"/><polygon class="mwv-logo-w-right" points="360,110 298,110 264.5,203.5 231,110 169,110 233.5,290 295.5,290"/></g>
    <text x="74" y="34" font-size="30" font-family="Sora, Inter, 'Segoe UI', system-ui, sans-serif"><tspan class="mwv-logo-accent" font-weight="400">my</tspan><tspan class="tw-fill-text-main" font-weight="700">Web</tspan><tspan class="mwv-logo-accent" font-weight="700">Vault</tspan></text>
  </svg>
`;
