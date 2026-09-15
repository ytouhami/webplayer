// Classic script (ES5 only). See static/legacy/live.js for the general
// approach — this is the same treatment for /epg's channel search filter
// and per-channel programming fetch, using XMLHttpRequest instead of
// fetch() since fetch may not exist on the oldest TV engines this targets.
(function () {
	var channelListEl = document.getElementById('channel-list');
	var searchInputEl = document.getElementById('search-input');
	var listCountEl = document.getElementById('list-count');
	var noResultsEl = document.getElementById('no-results');
	var epgPlaceholderEl = document.getElementById('epg-placeholder');
	var epgHeaderEl = document.getElementById('epg-header');
	var epgChannelNameEl = document.getElementById('epg-channel-name');
	var epgChannelCategoryEl = document.getElementById('epg-channel-category');
	var epgListEl = document.getElementById('epg-list');

	if (!channelListEl) return;

	// See static/legacy/live.js for why this is a capture-phase listener
	// instead of an inline onerror attribute.
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
	var activeIndex = -1;
	var requestId = 0;

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
	function indexOfItem(item) {
		for (var i = 0; i < items.length; i++) {
			if (items[i] === item) return i;
		}
		return -1;
	}

	function setActiveClasses() {
		for (var i = 0; i < items.length; i++) {
			if (i === activeIndex) addClass(items[i], 'active');
			else removeClass(items[i], 'active');
		}
	}

	function escapeHtml(s) {
		return String(s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
	}

	function renderEntries(entries) {
		if (!epgListEl) return;
		if (!entries || entries.length === 0) {
			epgListEl.style.display = 'none';
			if (epgPlaceholderEl) {
				epgPlaceholderEl.textContent = 'No planning available.';
				epgPlaceholderEl.style.display = 'block';
			}
			return;
		}
		if (epgPlaceholderEl) epgPlaceholderEl.style.display = 'none';
		var html = '';
		for (var i = 0; i < entries.length; i++) {
			var entry = entries[i];
			var time = escapeHtml(entry.startLabel || '');
			if (entry.endLabel) time += ' – ' + escapeHtml(entry.endLabel);
			html += '<li class="epg-entry"><span class="epg-time">' + time + '</span><h3>' + escapeHtml(entry.title || '') + '</h3>';
			if (entry.description) html += '<p>' + escapeHtml(entry.description) + '</p>';
			html += '</li>';
		}
		epgListEl.innerHTML = html;
		epgListEl.style.display = 'block';
	}

	function selectChannel(index) {
		var item = items[index];
		if (!item) return;
		activeIndex = index;
		setActiveClasses();

		if (epgPlaceholderEl) {
			epgPlaceholderEl.textContent = 'Loading…';
			epgPlaceholderEl.style.display = 'block';
		}
		if (epgListEl) epgListEl.style.display = 'none';
		if (epgHeaderEl) {
			epgHeaderEl.style.display = 'block';
			var h3 = item.querySelector('h3');
			if (epgChannelNameEl) epgChannelNameEl.textContent = h3 ? h3.textContent : '';
			if (epgChannelCategoryEl) epgChannelCategoryEl.textContent = item.getAttribute('data-category') || '';
		}

		var channelId = item.getAttribute('data-channel-id');
		var thisRequest = ++requestId;
		var xhr = new XMLHttpRequest();
		xhr.open('GET', '/api/epg/' + channelId, true);
		xhr.onreadystatechange = function () {
			if (xhr.readyState !== 4) return;
			if (thisRequest !== requestId) return;
			var listings = [];
			if (xhr.status >= 200 && xhr.status < 300) {
				try {
					var body = JSON.parse(xhr.responseText);
					if (body && Object.prototype.toString.call(body.listings) === '[object Array]') {
						listings = body.listings;
					}
				} catch (e) {
					listings = [];
				}
			}
			renderEntries(listings);
		};
		xhr.send();
	}

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
	}
	if (searchInputEl) {
		searchInputEl.addEventListener('input', applyFilter);
		searchInputEl.addEventListener('keyup', applyFilter);
	}
})();
