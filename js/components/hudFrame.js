/**
 * Ornamentos vectoriales SVG para marcos HUD Cyberpunk asimétricos.
 * Se adaptan automáticamente a modo claro y oscuro mediante variables CSS.
 */
export function hudFrameOrnaments() {
  return `
    <svg class="cyber-frame-ornament cyber-frame-tl" viewBox="0 0 180 42" aria-hidden="true">
      <polygon points="0,0 180,0 162,16 42,16 26,32 0,32" fill="var(--cyber-hud-armor)"/>
      <g stroke="var(--cyber-hud-armor-contrast)" stroke-width="2.2">
        <line x1="16" y1="28" x2="24" y2="20"/>
        <line x1="23" y1="28" x2="31" y2="20"/>
        <line x1="30" y1="28" x2="38" y2="20"/>
        <line x1="37" y1="28" x2="45" y2="20"/>
        <line x1="44" y1="28" x2="52" y2="20"/>
      </g>
    </svg>

    <svg class="cyber-frame-ornament cyber-frame-top-trace" viewBox="0 0 160 28" aria-hidden="true">
      <polyline points="4,10 92,10 108,2" fill="none" stroke="var(--cyber-hud-line)" stroke-width="1.2"/>
      <circle cx="4" cy="10" r="2.2" fill="var(--cyber-hud-line)"/>
      <rect x="28" y="13" width="38" height="2.5" fill="var(--cyber-hud-accent)"/>
      <g stroke="var(--cyber-hud-accent)" stroke-width="1.8">
        <line x1="92" y1="25" x2="99" y2="16"/>
        <line x1="97" y1="25" x2="104" y2="16"/>
        <line x1="102" y1="25" x2="109" y2="16"/>
      </g>
    </svg>

    <svg class="cyber-frame-ornament cyber-frame-tr-reticle" viewBox="0 0 36 36" aria-hidden="true">
      <path d="M2,10 V2 H10 M26,2 H34 V10 M34,26 V34 H26 M10,34 H2 V26" fill="none" stroke="var(--cyber-hud-line)" stroke-width="1.4"/>
      <g stroke="var(--cyber-hud-line)" stroke-width="2.2">
        <line x1="9" y1="16" x2="16" y2="9"/>
        <line x1="9" y1="23" x2="23" y2="9"/>
        <line x1="12" y1="27" x2="27" y2="12"/>
        <line x1="19" y1="27" x2="27" y2="19"/>
      </g>
    </svg>

    <svg class="cyber-frame-ornament cyber-frame-left" viewBox="0 0 20 140" aria-hidden="true">
      <polygon points="0,0 10,10 10,130 0,140" fill="var(--cyber-hud-armor)"/>
      <polyline points="15,18 15,122" fill="none" stroke="var(--cyber-hud-line)" stroke-width="1.1"/>
      <circle cx="15" cy="48" r="2" fill="var(--cyber-hud-line)"/>
      <circle cx="15" cy="94" r="2" fill="var(--cyber-hud-line)"/>
    </svg>

    <svg class="cyber-frame-ornament cyber-frame-right" viewBox="0 0 28 170" aria-hidden="true">
      <polygon points="28,0 16,12 16,136 28,148" fill="var(--cyber-hud-armor)"/>
      <polyline points="8,8 8,66 14,76 14,116" fill="none" stroke="var(--cyber-hud-line)" stroke-width="1.1"/>
      <circle cx="8" cy="8" r="2.4" fill="none" stroke="var(--cyber-hud-line)" stroke-width="1.2"/>
      <g stroke="var(--cyber-hud-accent)" stroke-width="2">
        <line x1="6" y1="132" x2="15" y2="142"/>
        <line x1="6" y1="140" x2="15" y2="150"/>
        <line x1="6" y1="148" x2="15" y2="158"/>
        <line x1="6" y1="156" x2="15" y2="166"/>
      </g>
    </svg>

    <svg class="cyber-frame-ornament cyber-frame-bl" viewBox="0 0 210 30" aria-hidden="true">
      <polygon points="0,30 0,10 140,10 158,24 210,24 210,30" fill="var(--cyber-hud-armor)"/>
      <g stroke="var(--cyber-hud-armor-contrast)" stroke-width="1.8">
        <line x1="58" y1="25" x2="66" y2="15"/>
        <line x1="64" y1="25" x2="72" y2="15"/>
        <line x1="70" y1="25" x2="78" y2="15"/>
        <line x1="76" y1="25" x2="84" y2="15"/>
        <line x1="82" y1="25" x2="90" y2="15"/>
        <line x1="88" y1="25" x2="96" y2="15"/>
      </g>
      <rect x="12" y="16" width="22" height="2" fill="var(--cyber-hud-armor-contrast)"/>
      <rect x="12" y="21" width="34" height="2" fill="var(--cyber-hud-armor-contrast)"/>
    </svg>

    <svg class="cyber-frame-ornament cyber-frame-br" viewBox="0 0 130 22" aria-hidden="true">
      <rect x="4" y="10" width="14" height="3" fill="var(--cyber-hud-line)"/>
      <rect x="22" y="10" width="6" height="3" fill="var(--cyber-hud-accent)"/>
      <rect x="32" y="10" width="18" height="3" fill="var(--cyber-hud-line)"/>
      <rect x="56" y="7" width="32" height="2" fill="var(--cyber-hud-accent)"/>
      <path d="M58,17 L62,13 M65,17 L69,13 M72,17 L76,13 M79,13 L83,17" stroke="var(--cyber-hud-accent)" stroke-width="1.4" fill="none"/>
      <g stroke="var(--cyber-hud-accent)" stroke-width="1.8">
        <line x1="98" y1="18" x2="105" y2="9"/>
        <line x1="103" y1="18" x2="110" y2="9"/>
        <line x1="108" y1="18" x2="115" y2="9"/>
      </g>
    </svg>
  `;
}
