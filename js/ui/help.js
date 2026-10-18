/**
 * ui/help.js — modal hướng dẫn cử chỉ + chọn độ nhạy + mở chẩn đoán camera.
 */
import { $, $$ } from '../utils/dom.js';
import { SENSITIVITY_PRESETS } from '../core/sensitivity.js';
import { CONFIG } from '../config.js';

export class HelpModal {
  constructor({ onSensitivityChange, onOpen, onClose, onOpenDiagnostics } = {}) {
    this.modal = $('#help-modal');
    this.isOpen = false;
    this.onSensitivityChange = onSensitivityChange || (() => {});
    this.onOpen = onOpen || (() => {});
    this.onClose = onClose || (() => {});
    this.onOpenDiagnostics = onOpenDiagnostics || (() => {});

    this._bind();
  }

  _bind() {
    if (!this.modal) return;

    $$('[data-close="help"]', this.modal).forEach((node) => {
      node.addEventListener('click', () => this.close());
    });

    $$('#sens-select button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.sens;
        $$('#sens-select button').forEach((b) => b.classList.toggle('is-on', b === btn));
        const preset = SENSITIVITY_PRESETS[name];
        const label = $('#sens-status b');
        if (label && preset) label.textContent = preset.label;
        this.onSensitivityChange(name);
      });
    });

    $$('#enhance-select button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const on = btn.dataset.enh === 'on';
        $$('#enhance-select button').forEach((b) => b.classList.toggle('is-on', b === btn));
        CONFIG.hand.enhance.enabled = on;
        try {
          localStorage.setItem('phuduong.enhance', on ? '1' : '0');
        } catch (e) {}
      });
    });

    this.modal.querySelector('#btn-diag-help')?.addEventListener('click', () => {
      this.close();
      this.onOpenDiagnostics();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isOpen) {
        event.preventDefault();
        this.close();
      }
    });
  }

  open() {
    if (!this.modal || this.isOpen) return;
    this.isOpen = true;
    this.modal.hidden = false;
    document.body.classList.add('is-modal-open');
    this._returnFocus = document.activeElement;
    setTimeout(() => this.modal.querySelector('.icon-btn')?.focus(), 30);
    this.onOpen();
  }

  close() {
    if (!this.modal || !this.isOpen) return;
    this.isOpen = false;
    this.modal.hidden = true;
    document.body.classList.remove('is-modal-open');
    if (this._returnFocus?.focus) this._returnFocus.focus();
    this.onClose();
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  syncEnhance(enabled) {
    $$('#enhance-select button').forEach((b) =>
      b.classList.toggle('is-on', (b.dataset.enh === 'on') === Boolean(enabled))
    );
  }

  syncSensitivity(name) {
    $$('#sens-select button').forEach((b) => b.classList.toggle('is-on', b.dataset.sens === name));
    const label = $('#sens-status b');
    const preset = SENSITIVITY_PRESETS[name];
    if (label && preset) label.textContent = preset.label;
  }
}
