/**
 * Utilidades de texto: escape, limpieza de HTML, búsqueda y conteo
 */
const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHTML(str = '') {
  return String(str ?? '').replace(/[&<>"']/g, c => ESCAPE_MAP[c]);
}

/** Convierte YYYY-MM-DD a DD/MM/AA */
export function formatDateDMY(iso) {
  const s = String(iso || '').trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s || '—';
  return `${m[3]}/${m[2]}/${m[1].slice(2)}`;
}

export function isHTML(str = '') {
  return /<\/?[a-z][\s\S]*>/i.test(String(str || ''));
}

/** Convierte HTML a texto plano legible (con espacios entre bloques) */
export function stripHTML(html = '') {
  if (!isHTML(html)) return String(html || '').trim();
  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  doc.body.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,li,blockquote,pre,br,tr,td,th').forEach(el => {
    el.insertAdjacentText('afterend', ' ');
  });
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

/** Texto plano -> párrafos HTML */
export function plainToHTML(text = '') {
  return String(text || '')
    .split(/\n{2,}/)
    .map(p => `<p>${escapeHTML(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Normaliza contenido antiguo (texto plano) o nuevo (HTML) para el editor */
export function toEditorHTML(content = '') {
  if (!content) return '<p><br></p>';
  return isHTML(content) ? sanitizeHTML(content) : plainToHTML(content);
}

const DANGEROUS_TAGS = 'script,style,iframe,object,embed,link,meta,base,form,input,button,textarea,select';

/** Elimina scripts, manejadores on* y URLs javascript: conservando el formato */
export function sanitizeHTML(html = '') {
  const doc = new DOMParser().parseFromString(`<div id="__root">${html}</div>`, 'text/html');
  const root = doc.getElementById('__root');
  root.querySelectorAll(DANGEROUS_TAGS).forEach(n => n.remove());
  root.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(attr => {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) el.removeAttribute(attr.name);
      if ((name === 'href' || name === 'src') && /^\s*(javascript|vbscript):/i.test(attr.value)) {
        el.removeAttribute(attr.name);
      }
    });
  });
  return root.innerHTML;
}

/** Limpia HTML pegado desde Word / web: conserva estructura, elimina estilos y colores ajenos */
export function cleanPastedHTML(html = '') {
  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  doc.querySelectorAll(`${DANGEROUS_TAGS},title,xml`).forEach(n => n.remove());

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_COMMENT);
  const comments = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  comments.forEach(c => c.remove());

  const allowed = ['href', 'src', 'alt', 'colspan', 'rowspan'];
  doc.body.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(attr => {
      const name = attr.name.toLowerCase();
      if (!allowed.includes(name) || /^\s*(javascript|vbscript):/i.test(attr.value)) {
        el.removeAttribute(attr.name);
      }
    });
  });
  doc.body.querySelectorAll('font, span, o\\:p').forEach(el => el.replaceWith(...el.childNodes));
  return doc.body.innerHTML;
}

/** Minúsculas y sin tildes, para búsquedas tolerantes */
export function normalizeText(str = '') {
  return String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function countWords(text = '') {
  const t = String(text || '').trim();
  return t ? t.split(/\s+/).length : 0;
}
