// Classic script (ES5 only). This is the real "player" implementation for
// TVs whose engine can't run SvelteKit's ES-module client bundle at all
// (see src/routes/live/+page.ts — csr is disabled for this route). It's a
// straight port of the interactive logic that used to live in
// src/routes/live/+page.svelte's <script> block, rewritten without
// let/const, arrow functions, template literals, optional chaining,
// classes, Array.from, Set/Map, or fetch (all of which are either ES2015+
// syntax an old parser can choke on, or APIs that may not exist).
(function () {
	var videoEl = document.getElementById('live-video');
	var playerShellEl = document.getElementById('player-shell');
	var channelListEl = document.getElementById('channel-list');
	var searchInputEl = document.getElementById('search-input');
	var listCountEl = document.getElementById('list-count');
	var noResultsEl = document.getElementById('no-results');
	var prevBtnEl = document.getElementById('prev-btn');
	var playPauseBtnEl = document.getElementById('play-pause-btn');
	var nextBtnEl = document.getElementById('next-btn');
	var muteBtnEl = document.getElementById('mute-btn');
	var fullscreenBtnEl = document.getElementById('fullscreen-btn');
	var volumeSliderEl = document.getElementById('volume-slider');
	var playPauseIconPlay = document.getElementById('play-pause-icon-play');
	var playPauseIconPause = document.getElementById('play-pause-icon-pause');
	var muteIconMuted = document.getElementById('mute-icon-muted');
	var muteIconUnmuted = document.getElementById('mute-icon-unmuted');
	var overlayTopEl = document.getElementById('player-overlay-top');
	var overlayBottomEl = document.getElementById('player-overlay-bottom');
	var chNumberBadgeEl = document.getElementById('ch-number-badge');
	var nowCatEl = document.getElementById('now-cat');
	var playerErrorEl = document.getElementById('player-error');
	var playerErrorTextEl = document.getElementById('player-error-text');
	var playerCenterBtnEl = document.getElementById('player-center-btn');

	if (!videoEl || !playerShellEl || !channelListEl) return;

	// Channel logos are frequently broken/dead provider links. Svelte 5
	// doesn't allow a plain string `onerror="..."` attribute (must be a JS
	// expression, which would need hydration anyway), so this falls back to
	// each icon's generated badge sibling via a capture-phase listener
	// instead — 'error' on <img> doesn't bubble, but it does fire during
	// capture on ancestors, so one listener on the document catches all of
	// them.
	document.addEventListener(
		'error',
		function (e) {
			var t = e.target;
			if (t && t.tagName === 'IMG' && (' ' + t.className + ' ').indexOf(' ch-icon ') !== -1) {
				t.style.display = 'none';
				if (t.nextElementSibling) t.nextElementSibling.style.display = 'flex';
			}
		},
		true
	);

	var items = Array.prototype.slice.call(channelListEl.getElementsByClassName('channel-item'));
	if (items.length === 0) return;

	var activeIndex = 0;
	var focusedIndex = 0;
	var isPlaying = false;
	var isBuffering = true;
	var isMuted = true;
	var volume = 100;
	var networkRetries = 0;
	var MAX_NETWORK_RETRIES = 3;
	var hls = null;

	function itemId(item) {
		return item.getAttribute('data-channel-id');
	}

	function visibleItems() {
		var out = [];
		for (var i = 0; i < items.length; i++) {
			if (items[i].style.display !== 'none') out.push(items[i]);
		}
		return out;
	}

	function setActiveClasses() {
		for (var i = 0; i < items.length; i++) {
			var el = items[i];
			if (i === activeIndex) addClass(el, 'active');
			else removeClass(el, 'active');
			if (i === focusedIndex) addClass(el, 'focused');
			else removeClass(el, 'focused');
		}
	}

	function addClass(el, name) {
		if ((' ' + el.className + ' ').indexOf(' ' + name + ' ') === -1) {
			el.className = el.className ? el.className + ' ' + name : name;
		}
	}
	function removeClass(el, name) {
		var parts = el.className.split(' ');
		var out = [];
		for (var i = 0; i < parts.length; i++) {
			if (parts[i] !== name && parts[i] !== '') out.push(parts[i]);
		}
		el.className = out.join(' ');
	}
	function hasClass(el, name) {
		return (' ' + el.className + ' ').indexOf(' ' + name + ' ') !== -1;
	}

	function scrollIntoView(item) {
		if (item.scrollIntoView) {
			try {
				item.scrollIntoView({ block: 'nearest' });
			} catch (e) {
				item.scrollIntoView();
			}
		}
	}

	function loadChannel(channelId) {
		hidePlayerError();
		networkRetries = 0;
		var url = '/api/stream/' + channelId;

		if (window.Hls && window.Hls.isSupported && window.Hls.isSupported()) {
			if (!hls) {
				hls = new window.Hls({ lowLatencyMode: true });
				hls.attachMedia(videoEl);
				hls.on(window.Hls.Events.MANIFEST_PARSED, function () {
					hidePlayerError();
					var p = videoEl.play();
					if (p && p.catch) p.catch(function () {});
				});
				hls.on(window.Hls.Events.ERROR, function (event, data) {
					if (!data.fatal) return;
					if (window.console) console.error('[hls]', data.type, data.details);
					if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
						networkRetries++;
						if (networkRetries <= MAX_NETWORK_RETRIES) {
							hls.startLoad();
						} else {
							var code = data.response && data.response.code;
							if (code) {
								showPlayerError(
									'Playback failed after ' +
										MAX_NETWORK_RETRIES +
										' retries (HTTP ' +
										code +
										"). If this account is already streaming on another device, that's likely why — most IPTV plans only allow a limited number of simultaneous streams."
								);
							} else {
								showPlayerError('Playback failed after ' + MAX_NETWORK_RETRIES + ' retries: ' + data.details + '.');
							}
						}
					} else if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
						hls.recoverMediaError();
					} else {
						showPlayerError('Playback failed: ' + data.details);
					}
				});
			}
			hls.loadSource(url);
		} else if (videoEl.canPlayType && videoEl.canPlayType('application/vnd.apple.mpegurl')) {
			videoEl.src = url;
			var p = videoEl.play();
			if (p && p.catch) p.catch(function () {});
		}
	}

	function showPlayerError(msg) {
		if (!playerErrorEl || !playerErrorTextEl) return;
		playerErrorTextEl.textContent = msg;
		playerErrorEl.style.display = 'block';
	}
	function hidePlayerError() {
		if (!playerErrorEl) return;
		playerErrorEl.style.display = 'none';
	}

	function updateNowPlayingUI(item, index) {
		var colorA = item.getAttribute('data-color-a');
		var colorB = item.getAttribute('data-color-b');
		if (colorA) playerShellEl.style.setProperty('--ch-a', colorA);
		if (colorB) playerShellEl.style.setProperty('--ch-b', colorB);
		if (chNumberBadgeEl) {
			var num = index + 1;
			chNumberBadgeEl.textContent = 'CH. ' + (num < 10 ? '0' + num : String(num));
		}
		if (nowCatEl) nowCatEl.textContent = item.getAttribute('data-category') || '';
	}

	function setBuffering(v) {
		isBuffering = v;
		if (v) addClass(playerShellEl, 'is-buffering');
		else removeClass(playerShellEl, 'is-buffering');
	}
	function setPlayingClass(v) {
		if (v) addClass(playerShellEl, 'is-playing');
		else removeClass(playerShellEl, 'is-playing');
	}

	function selectChannel(index) {
		var item = items[index];
		if (!item) return;
		activeIndex = index;
		focusedIndex = index;
		setBuffering(true);
		setActiveClasses();
		updateNowPlayingUI(item, index);
		loadChannel(itemId(item));
	}

	function goToChannel(delta) {
		var n = items.length;
		if (n === 0) return;
		var next = (activeIndex + delta + n) % n;
		selectChannel(next);
	}

	// --- filtering ---
	function applyFilter() {
		var q = (searchInputEl && searchInputEl.value ? searchInputEl.value : '').trim().toLowerCase();
		var shown = 0;
		for (var i = 0; i < items.length; i++) {
			var name = items[i].getAttribute('data-name') || '';
			var match = !q || name.indexOf(q) !== -1;
			items[i].style.display = match ? '' : 'none';
			if (match) shown++;
		}
		if (listCountEl) listCountEl.textContent = shown + ' ' + (shown === 1 ? 'CHANNEL' : 'CHANNELS');
		if (noResultsEl) noResultsEl.style.display = shown === 0 ? 'block' : 'none';
		// Keep the focus highlight on a still-visible item.
		var vis = visibleItems();
		if (vis.length > 0) {
			var stillVisible = false;
			for (var j = 0; j < vis.length; j++) {
				if (vis[j] === items[focusedIndex]) stillVisible = true;
			}
			if (!stillVisible) {
				focusedIndex = items.indexOf ? items.indexOf(vis[0]) : indexOfItem(vis[0]);
				setActiveClasses();
			}
		}
	}
	function indexOfItem(item) {
		for (var i = 0; i < items.length; i++) {
			if (items[i] === item) return i;
		}
		return -1;
	}
	if (searchInputEl) {
		searchInputEl.addEventListener('input', applyFilter);
		searchInputEl.addEventListener('keyup', applyFilter);
	}

	// --- click-to-select (event delegation) ---
	channelListEl.addEventListener('click', function (e) {
		var el = e.target;
		while (el && el !== channelListEl) {
			if (hasClass(el, 'channel-item')) {
				selectChannel(indexOfItem(el));
				return;
			}
			el = el.parentNode;
		}
	});

	// --- transport controls ---
	function togglePlay() {
		if (isPlaying) videoEl.pause();
		else {
			var p = videoEl.play();
			if (p && p.catch) p.catch(function () {});
		}
	}
	function updatePlayPauseIcon() {
		if (playPauseIconPlay) playPauseIconPlay.style.display = isPlaying ? 'none' : '';
		if (playPauseIconPause) playPauseIconPause.style.display = isPlaying ? '' : 'none';
		if (playPauseBtnEl) playPauseBtnEl.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
	}
	function toggleMute() {
		isMuted = !isMuted;
		videoEl.muted = isMuted;
		updateMuteIcon();
	}
	function updateMuteIcon() {
		if (muteIconMuted) muteIconMuted.style.display = isMuted ? '' : 'none';
		if (muteIconUnmuted) muteIconUnmuted.style.display = isMuted ? 'none' : '';
		if (muteBtnEl) muteBtnEl.setAttribute('aria-label', isMuted ? 'Unmute' : 'Mute');
	}
	function handleVolumeInput(v) {
		volume = v;
		videoEl.volume = v / 100;
		if (v === 0) {
			isMuted = true;
			videoEl.muted = true;
		} else if (isMuted) {
			isMuted = false;
			videoEl.muted = false;
		}
		updateMuteIcon();
	}

	function isPlayerFullscreen() {
		return Boolean(document.fullscreenElement || document.webkitFullscreenElement || videoEl.webkitDisplayingFullscreen);
	}
	function enterFullscreen() {
		if (playerShellEl.requestFullscreen) {
			var p = playerShellEl.requestFullscreen();
			if (p && p.catch) {
				p.catch(function () {
					if (videoEl.webkitEnterFullscreen) videoEl.webkitEnterFullscreen();
				});
			}
		} else if (playerShellEl.webkitRequestFullscreen) {
			playerShellEl.webkitRequestFullscreen();
		} else if (videoEl.webkitEnterFullscreen) {
			videoEl.webkitEnterFullscreen();
		}
	}
	function exitFullscreen() {
		if (document.exitFullscreen) {
			var p = document.exitFullscreen();
			if (p && p.catch) p.catch(function () {});
		} else if (document.webkitExitFullscreen) {
			document.webkitExitFullscreen();
		}
	}
	function toggleFullscreen() {
		if (isPlayerFullscreen()) exitFullscreen();
		else enterFullscreen();
	}

	if (prevBtnEl) prevBtnEl.addEventListener('click', function () { goToChannel(-1); });
	if (nextBtnEl) nextBtnEl.addEventListener('click', function () { goToChannel(1); });
	if (playPauseBtnEl) playPauseBtnEl.addEventListener('click', togglePlay);
	if (muteBtnEl) muteBtnEl.addEventListener('click', toggleMute);
	if (fullscreenBtnEl) fullscreenBtnEl.addEventListener('click', toggleFullscreen);
	if (playerCenterBtnEl) playerCenterBtnEl.addEventListener('click', function () {
		var p = videoEl.play();
		if (p && p.catch) p.catch(function () {});
	});
	if (volumeSliderEl) {
		volumeSliderEl.addEventListener('input', function () {
			handleVolumeInput(Number(volumeSliderEl.value));
		});
	}

	// Clicking anywhere on the player toggles play/pause, except clicks on
	// an actual control (which already have their own handler above).
	playerShellEl.addEventListener('click', function (e) {
		var el = e.target;
		while (el && el !== playerShellEl) {
			var tag = el.tagName;
			if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'A') return;
			el = el.parentNode;
		}
		togglePlay();
	});

	videoEl.addEventListener('play', function () {
		isPlaying = true;
		setPlayingClass(true);
		updatePlayPauseIcon();
	});
	videoEl.addEventListener('pause', function () {
		isPlaying = false;
		setPlayingClass(false);
		updatePlayPauseIcon();
	});
	videoEl.addEventListener('playing', function () {
		setBuffering(false);
		// 'play' only means "not paused" and can fail to fire on MSE-backed
		// live HLS when a channel switch interrupts the previous play()
		// call — 'playing' is the reliable signal that video is genuinely
		// rendering, so the center button must hide here too.
		isPlaying = true;
		setPlayingClass(true);
		updatePlayPauseIcon();
	});
	videoEl.addEventListener('waiting', function () {
		setBuffering(true);
	});

	// --- controls auto-hide ---
	var hideTimer;
	function showControls() {
		if (overlayTopEl) removeClass(overlayTopEl, 'chrome-hidden');
		if (overlayBottomEl) removeClass(overlayBottomEl, 'chrome-hidden');
		clearTimeout(hideTimer);
		hideTimer = setTimeout(function () {
			if (overlayTopEl) addClass(overlayTopEl, 'chrome-hidden');
			if (overlayBottomEl) addClass(overlayBottomEl, 'chrome-hidden');
		}, 5000);
	}
	playerShellEl.addEventListener('pointermove', showControls);
	playerShellEl.addEventListener('pointerdown', showControls);
	playerShellEl.addEventListener('mousemove', showControls);
	playerShellEl.addEventListener('touchstart', showControls);

	// --- remote / keyboard navigation ---
	function moveFocus(delta) {
		var vis = visibleItems();
		if (vis.length === 0) return;
		var pos = -1;
		for (var i = 0; i < vis.length; i++) {
			if (indexOfItem(vis[i]) === focusedIndex) pos = i;
		}
		var nextPos = pos === -1 ? 0 : Math.min(Math.max(pos + delta, 0), vis.length - 1);
		focusedIndex = indexOfItem(vis[nextPos]);
		setActiveClasses();
		scrollIntoView(vis[nextPos]);
	}

	var BACK_KEYS = { Backspace: true, Escape: true, GoBack: true, XF86Back: true, Back: true };
	var BACK_KEYCODES = { 461: true, 10009: true, 27: true, 8: true };
	function isBackKey(e) {
		return Boolean(BACK_KEYS[e.key] || BACK_KEYCODES[e.keyCode] || BACK_KEYCODES[e.which]);
	}

	function controlButtons() {
		var list = [prevBtnEl, playPauseBtnEl, nextBtnEl, muteBtnEl, fullscreenBtnEl];
		var out = [];
		for (var i = 0; i < list.length; i++) {
			if (list[i]) out.push(list[i]);
		}
		return out;
	}

	document.addEventListener('keydown', function (e) {
		var active = document.activeElement;
		if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;

		showControls();

		if (e.key === 'MediaPlayPause' || e.keyCode === 179) {
			e.preventDefault();
			togglePlay();
			return;
		}

		var buttons = controlButtons();
		var controlIdx = -1;
		for (var i = 0; i < buttons.length; i++) {
			if (buttons[i] === active) controlIdx = i;
		}
		var onControlButton = controlIdx !== -1;

		if (e.key === 'ArrowLeft') {
			if (onControlButton) {
				e.preventDefault();
				if (controlIdx > 0) buttons[controlIdx - 1].focus();
				else if (active && active.blur) active.blur();
			}
		} else if (e.key === 'ArrowRight') {
			if (onControlButton) {
				e.preventDefault();
				if (controlIdx < buttons.length - 1) buttons[controlIdx + 1].focus();
			} else {
				e.preventDefault();
				if (buttons[0]) buttons[0].focus();
			}
		} else if (e.key === 'ArrowUp') {
			if (!onControlButton) {
				e.preventDefault();
				moveFocus(-1);
			}
		} else if (e.key === 'ArrowDown') {
			if (!onControlButton) {
				e.preventDefault();
				moveFocus(1);
			}
		} else if (e.key === 'Enter') {
			if (onControlButton) return;
			e.preventDefault();
			if (isPlayerFullscreen()) togglePlay();
			else if (focusedIndex === activeIndex) enterFullscreen();
			else selectChannel(focusedIndex);
		} else if (isBackKey(e)) {
			if (isPlayerFullscreen()) {
				e.preventDefault();
				exitFullscreen();
			}
		}
	});

	// --- boot ---
	setActiveClasses();
	videoEl.muted = true;
	updateMuteIcon();
	updatePlayPauseIcon();
	showControls();
	selectChannel(0);
})();
