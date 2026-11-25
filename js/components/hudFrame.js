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

/**
 * Bloque gráfico Cyberpunk / Streetwear para la parte inferior de las columnas laterales
 * de los módulos (excluyendo Dashboard). Inspirado en estética HUD monocromática.
 */
export function asideCyberDecal({
  code = 'SYS.00',
  label = 'DARKNESS // OS',
  tag = 'NODE // ACTIVE'
} = {}) {
  return `
    <div class="aside-cyber-decal" aria-hidden="true">
      <!-- Chasis HUD asimétrico con muesca inferior y bloques diagonales -->
      <svg class="aside-cyber-chassis" viewBox="0 0 264 128" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Marco exterior desplazado -->
        <path d="M96 4 H252 Q260 4 260 12 V96 Q260 104 252 104 H126 L114 118" stroke="var(--hud-border-strong)" stroke-width="1.4"/>
        <!-- Chasis principal con chaflán superior izquierdo y muesca inferior -->
        <path d="M40 12 H242 Q250 12 250 20 V88 Q250 96 242 96 H128 L114 114 Q110 119 102 119 H14 Q6 119 6 111 V42 Q6 36 11 31 L29 15 Q34 12 40 12 Z" fill="var(--bg-surface-elevated)" stroke="var(--text-primary)" stroke-width="1.6"/>

        <!-- Cabecera superior del chasis -->
        <text x="26" y="27" fill="var(--text-primary)" font-family="var(--font-display)" font-size="9.5" font-weight="700" letter-spacing="1.4">${label}</text>
        <line x1="138" y1="24" x2="178" y2="24" stroke="var(--hud-border-strong)" stroke-width="1.2"/>
        <text x="240" y="27" text-anchor="end" fill="var(--text-primary)" font-family="var(--font-display)" font-size="9" font-weight="700" letter-spacing="1">${code}</text>

        <!-- Micro-texto técnico -->
        <text x="26" y="37" fill="var(--text-muted)" font-family="var(--font-mono)" font-size="4.6" letter-spacing="0.6">SYSTEM TELEMETRY // INFINITE POTENTIAL</text>
        <text x="26" y="43.5" fill="var(--text-muted)" font-family="var(--font-mono)" font-size="4.6" letter-spacing="0.6">PROTOCOL: ${tag} · DRK-2077</text>

        <!-- Banda central con bloques inclinados de alto contraste -->
        <rect x="7" y="49" width="242" height="20" fill="var(--bg-canvas)"/>
        <polygon points="7,49 32,49 25,69 7,69" fill="var(--text-primary)"/>
        <polygon points="36,49 48,49 41,69 29,69" fill="var(--text-primary)"/>
        <polygon points="52,49 64,49 57,69 45,69" fill="var(--text-primary)"/>
        <polygon points="68,49 80,49 73,69 61,69" fill="var(--text-primary)"/>
        <polygon points="84,49 96,49 89,69 77,69" fill="var(--text-primary)"/>
        <polygon points="222,49 249,49 249,69 229,69" fill="var(--text-primary)"/>

        <!-- Bloque inferior izquierdo: tipografía apilada + metadata -->
        <text x="15" y="88" fill="var(--text-primary)" font-family="var(--font-display)" font-size="17" font-weight="700" letter-spacing="1.2">FUT-</text>
        <text x="15" y="105" fill="var(--text-primary)" font-family="var(--font-display)" font-size="17" font-weight="700" letter-spacing="1.2">URE</text>
        <text x="15" y="114" fill="var(--text-muted)" font-family="var(--font-mono)" font-size="5.2" letter-spacing="1.2">◈ WORLDWIDE</text>
        <line x1="66" y1="112" x2="106" y2="112" stroke="var(--hud-border-strong)" stroke-width="1"/>

        <!-- Tres marcas X contorneadas a la derecha -->
        <g stroke="var(--text-primary)" stroke-width="1.5" fill="none" stroke-linejoin="round">
          <path d="M174 75 L179 80 L184 75 L187 78 L182 83 L187 88 L184 91 L179 86 L174 91 L171 88 L176 83 L171 78 Z"/>
          <path d="M198 75 L203 80 L208 75 L211 78 L206 83 L211 88 L208 91 L203 86 L198 91 L195 88 L200 83 L195 78 Z"/>
          <path d="M222 75 L227 80 L232 75 L235 78 L230 83 L235 88 L232 91 L227 86 L222 91 L219 88 L224 83 L219 78 Z"/>
        </g>

        <!-- Cuatro puntos de estado en la muesca inferior -->
        <circle cx="136" cy="111" r="2.8" fill="var(--cyber-hud-armor)"/>
        <circle cx="147" cy="111" r="2.8" fill="var(--text-primary)"/>
        <circle cx="158" cy="111" r="2.8" fill="var(--text-primary)"/>
        <circle cx="169" cy="111" r="2.8" fill="var(--text-primary)"/>
      </svg>

      <!-- Barra de franjas diagonales + globo wireframe -->
      <div class="aside-cyber-hazard-row">
        <span class="aside-cyber-globe" title="WORLDWIDE">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="9"/>
            <ellipse cx="12" cy="12" rx="4.2" ry="9"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <path d="M4.8 7.5 Q12 9.5 19.2 7.5"/>
            <path d="M4.8 16.5 Q12 14.5 19.2 16.5"/>
          </svg>
        </span>
        <svg class="aside-cyber-stripes-svg" viewBox="0 0 220 14" preserveAspectRatio="xMinYMid slice" aria-hidden="true">
          ${Array.from({ length: 22 }, (_, i) => {
            const x = i * 11;
            return `<polygon points="${x + 6},0 ${x + 12},0 ${x + 6},14 ${x},14" fill="var(--text-primary)"/>`;
          }).join('')}
        </svg>
      </div>

      <!-- Pie tipográfico estilo streetwear/cyberpunk -->
      <div class="aside-cyber-footer-meta">
        <div class="aside-cyber-quote">"ALL AROUND US"</div>
        <div class="aside-cyber-glyphs">
          <svg viewBox="0 0 20 20" width="11" height="11" fill="currentColor">
            <path d="M10 0 L12.2 7.8 L20 10 L12.2 12.2 L10 20 L7.8 12.2 L0 10 L7.8 7.8 Z"/>
          </svg>
          <span class="aside-cyber-serial">DRK·NX</span>
        </div>
      </div>
      <div class="aside-cyber-subcopy">THE UNKNOWN IS ALSO THE REALM OF INFINITE POTENTIAL.</div>
    </div>
  `;
}
