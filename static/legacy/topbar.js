// Classic script (ES5 only: var/function, no arrow fns, no let/const, no
// template literals, no optional chaining, no Array.from/Set/Map) — this is
// the TV-compatibility fallback path. Drives AppTopbar's interactive bits
// (theme toggle, colored remote-button shortcuts) on routes that have
// csr:false (see src/routes/live/+page.ts, src/routes/epg/+page.ts), where
// AppTopbar's own Svelte script never hydrates.
(function () {
	function byId(id) {
		return document.getElementById(id);
	}

	var themeBtn = byId('theme-toggle-btn');
	var themeLabel = byId('theme-toggle-label');
	var refreshForm = byId('refresh-form');
	var logoutForm = byId('logout-form');
	var tvGuideLink = byId('tvguide-link');
	var refreshing = false;

	function currentTheme() {
		return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
	}

	function syncThemeButton() {
		if (!themeBtn || !themeLabel) return;
		var t = currentTheme();
		themeLabel.textContent = t === 'light' ? 'Dark' : 'Light';
		themeBtn.title = (t === 'light' ? 'Switch to dark mode' : 'Switch to light mode') + ' (Blue)';
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

	// Key names/codes for the four hardware colored buttons vary a lot by
	// platform (Tizen/webOS use named keys like "ColorF0Red", some Android
	// TV/HbbTV-derived browsers only send legacy numeric keyCodes
	// 403/404/405/406) — both are checked. Mapping matches the original:
	// Red=Logout, Green=Refresh, Yellow=TV Guide, Blue=theme toggle.
	var COLOR_KEY_NAMES = {
		ColorF0Red: 'red',
		Red: 'red',
		ColorF1Green: 'green',
		Green: 'green',
		ColorF2Yellow: 'yellow',
		Yellow: 'yellow',
		ColorF3Blue: 'blue',
		Blue: 'blue'
	};
	var COLOR_KEY_CODES = { 403: 'red', 404: 'green', 405: 'yellow', 406: 'blue' };

	document.addEventListener('keydown', function (e) {
		var active = document.activeElement;
		var tag = active ? active.tagName : '';
		if (tag === 'INPUT' || tag === 'TEXTAREA') return;

		var color = COLOR_KEY_NAMES[e.key] || COLOR_KEY_CODES[e.keyCode] || COLOR_KEY_CODES[e.which];
		if (!color) return;
		e.preventDefault();

		if (color === 'red') {
			if (logoutForm) logoutForm.submit();
		} else if (color === 'green') {
			if (refreshForm && !refreshing) refreshForm.submit();
		} else if (color === 'yellow') {
			if (tvGuideLink) tvGuideLink.click();
		} else if (color === 'blue') {
			toggleTheme();
		}
	});
})();
