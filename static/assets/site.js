(() => {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.getElementById('nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('open', open);
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && nav.classList.contains('open')) {
        toggle.setAttribute('aria-expanded', 'false');
        nav.classList.remove('open');
        toggle.focus();
      }
    });
  }

  const chips = document.querySelectorAll('[data-filter]');
  chips.forEach((chip) => chip.addEventListener('click', () => {
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    let shown = 0;
    document.querySelectorAll('.card[data-category]').forEach((card) => {
      card.hidden = chip.dataset.filter !== 'all' && card.dataset.category !== chip.dataset.filter;
      if (!card.hidden) shown++;
    });
    const status = document.getElementById('filter-status');
    if (status) status.textContent = `${shown} project${shown === 1 ? '' : 's'} shown`;
  }));
})();
