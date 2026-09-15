// Classic script (ES5 only: var/function, no arrow fns, no let/const, no
// template literals, no optional chaining, no Array.from/Set/Map) — this is
// the TV-compatibility fallback path. Drives AppTopbar's interactive bits
// (theme toggle) on routes that have csr:false (see src/routes/live/+page.ts,
// src/routes/epg/+page.ts), where AppTopbar's own Svelte script never
// hydrates.
(function () {
	function byId(id) {
		return document.getElementById(id);
	}

	var themeBtn = byId('theme-toggle-btn');
	var themeLabel = byId('theme-toggle-label');
	var refreshForm = byId('refresh-form');
	var refreshing = false;

	function currentTheme() {
		return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
	}

	function syncThemeButton() {
		if (!themeBtn || !themeLabel) return;
		var t = currentTheme();
		themeLabel.textContent = t === 'light' ? 'Dark' : 'Light';
		themeBtn.title = t === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
	}

	function toggleTheme() {
		var next = currentTheme() === 'light' ? 'dark' : 'light';
		document.documentElement.setAttribute('data-theme', next);
		try {
			localStorage.setItem('pulse-theme', next);
		} catch (e) {}
		syncThemeButton();
	}

	if (themeBtn) {
		syncThemeButton();
		themeBtn.addEventListener('click', toggleTheme);
	}

	if (refreshForm) {
		refreshForm.addEventListener('submit', function () {
			refreshing = true;
			var btn = refreshForm.querySelector('button');
			if (btn) btn.disabled = true;
		});
	}
})();
