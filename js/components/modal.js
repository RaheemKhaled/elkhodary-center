/**
 * مكون النوافذ المنبثقة للتأكيد (Confirm Modal)
 * تأكيد إلزامي قبل أي حذف أو إلغاء لتجنب الخطأ غير المقصود
 */

class ModalManager {
  confirm({ title = 'تأكيد العملية', message = 'هل أنت متأكد من المتابعة؟', confirmText = 'نعم، متأكد', cancelText = 'تراجع', type = 'warning' }) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay active';

      let icon = '⚠️';
      let confirmBtnClass = 'btn-warning';
      if (type === 'danger') {
        icon = '🗑️';
        confirmBtnClass = 'btn-danger';
      } else if (type === 'success') {
        icon = '✅';
        confirmBtnClass = 'btn-success';
      }

      overlay.innerHTML = `
        <div class="modal-content">
          <div class="modal-title">
            <span style="font-size: 32px;">${icon}</span>
            <span>${title}</span>
          </div>
          <div class="modal-body">${message}</div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" id="modalCancelBtn">${cancelText}</button>
            <button type="button" class="btn ${confirmBtnClass}" id="modalConfirmBtn">${confirmText}</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const cancelBtn = overlay.querySelector('#modalCancelBtn');
      const confirmBtn = overlay.querySelector('#modalConfirmBtn');

      const close = (result) => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 250);
        resolve(result);
      };

      cancelBtn.addEventListener('click', () => close(false));
      confirmBtn.addEventListener('click', () => close(true));
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close(false);
      });
    });
  }
}

export const modal = new ModalManager();
