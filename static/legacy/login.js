// Classic script (ES5 only). Handles the theme toggle and show/hide-
// password buttons on /login, whose csr is disabled (see +page.ts) — the
// actual sign-in submit is a plain <form method="POST"> and needs no JS.
(function () {
	var themeBtn = document.getElementById('theme-toggle-btn');
	var iconDark = document.getElementById('theme-icon-dark');
	var iconLight = document.getElementById('theme-icon-light');
	var toggleBtn = document.getElementById('toggle-pass-btn');
	var passInput = document.getElementById('password-input');
	var iconHidden = document.getElementById('pass-icon-hidden');
	var iconShown = document.getElementById('pass-icon-shown');
	var loginForm = document.getElementById('login-form');
	var submitBtn = document.getElementById('submit-btn');
	var submitLabel = document.getElementById('submit-btn-label');

	// See static/legacy/live.js for why this is a capture-phase listener
	// instead of an inline onerror attribute (not allowed on a plain string
	// in Svelte 5, and would need hydration anyway).
	document.addEventListener(
		'error',
		function (e) {
			var t = e.target;
			if (t && t.id === 'brand-logo-img') {
				t.style.display = 'none';
				if (t.nextElementSibling) t.nextElementSibling.style.display = '';
			}
		},
		true
	);

	function currentTheme() {
		return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
	}

	function syncTheme() {
		if (!themeBtn) return;
		var t = currentTheme();
		if (iconDark) iconDark.style.display = t === 'light' ? '' : 'none';
		if (iconLight) iconLight.style.display = t === 'light' ? 'none' : '';
		themeBtn.setAttribute('aria-label', t === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
	}

	if (themeBtn) {
		syncTheme();
		themeBtn.addEventListener('click', function () {
			var next = currentTheme() === 'light' ? 'dark' : 'light';
			document.documentElement.setAttribute('data-theme', next);
			try {
				localStorage.setItem('pulse-theme', next);
			} catch (e) {}
			syncTheme();
		});
	}

	if (toggleBtn && passInput) {
		toggleBtn.addEventListener('click', function () {
			var showing = passInput.type === 'text';
			passInput.type = showing ? 'password' : 'text';
			if (iconHidden) iconHidden.style.display = showing ? '' : 'none';
			if (iconShown) iconShown.style.display = showing ? 'none' : '';
			toggleBtn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
		});
	}

	if (loginForm && submitBtn && submitLabel) {
		loginForm.addEventListener('submit', function () {
			submitBtn.disabled = true;
			addClass(submitBtn, 'is-loading');
			submitLabel.textContent = 'Tuning in…';
		});
	}

	function addClass(el, name) {
		if ((' ' + el.className + ' ').indexOf(' ' + name + ' ') === -1) {
			el.className = el.className ? el.className + ' ' + name : name;
		}
	}
})();
