import { icon } from './icons.js?v=1.3.0';

/**
 * Sistema de Modales Reutilizable
 */
export function openModal({ title, contentHTML, onMount }) {
  closeModal();

  const backdrop = document.createElement('div');
  backdrop.id = 'active-modal';
  backdrop.className = 'modal-backdrop open';
  backdrop.innerHTML = `
    <div class="modal-panel" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button type="button" class="btn-icon" id="modal-close-btn" aria-label="Cerrar">
          ${icon('close')}
        </button>
      </div>
      <div class="modal-body">
        ${contentHTML}
      </div>
    </div>
  `;

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });

  document.body.appendChild(backdrop);

  const closeBtn = backdrop.querySelector('#modal-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  if (typeof onMount === 'function') {
    onMount(backdrop);
  }
}

export function closeModal() {
  const existing = document.getElementById('active-modal');
  if (existing) existing.remove();
}
