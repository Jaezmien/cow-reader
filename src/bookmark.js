function create_bookmark_template() {
	return {
		lastSeenChapter: null,
		scrollChapter: null,
		scrollParagraph: null,
		scrollAmount: null,
	}
}
// function validate_bookmark_object(b) {
// const props = ['lastSeenChapter', 'scrollChapter', 'scrollParagraph', 'scrollAmount'];
//
// return props.every((prop) => b.hasOwnProperty(prop));
// }
function clone_object(o) {
	return JSON.parse(JSON.stringify(o))
}
function generate_bookmark_state() {
	return Vue.observable({
		firstBookmark: create_bookmark_template(),
		updatedBookmark: create_bookmark_template(),

		isLoaded: false,
	})
}

export function create_bookmark_handler({ hash, url }) {
	const state = generate_bookmark_state()

	function get_bookmark() {
		return state.firstBookmark
	}
	function get_storage_bookmark() {
		return state.updatedBookmark
	}

	function is_loaded() {
		return state.isLoaded
	}

	function load_bookmark_data(json) {
		Vue.set(state, 'firstBookmark', clone_object(json))
		Vue.set(state, 'updatedBookmark', clone_object(json))
	}

	const LSKEY = 'cowreader.' + hash

	function load_bookmark() {
		return new Promise(async (res) => {
			if (url) {
				if (navigator.online) {
					try {
						const serverData = await fetch(url)
						const serverBMRK = await serverData.json()
						load_bookmark_data(serverBMRK)
						state.isLoaded = true
						res(state)
					} catch (err) {}
				}
			}

			let ls = localStorage[LSKEY]
			if (ls) {
				load_bookmark_data(JSON.parse(localStorage[LSKEY]))
				state.isLoaded = true
				res(state)
			}

			state.isLoaded = true
			res(state)
		})
	}

	function save_bookmark() {
		return new Promise(async (res) => {
			localStorage[LSKEY] = JSON.stringify(state.updatedBookmark)

			if (navigator.onLine && url) {
				try {
					await fetch(url, {
						method: 'POST',
						body: JSON.stringify(state.updatedBookmark),
						headers: { 'Content-Type': 'application/json' },
					})
				} catch (err) {
					console.log('🔥 Failed to save bookmark info to server')
				}
			}

			res()
		})
	}

	return {
		get_bookmark,
		get_storage_bookmark,
		load_bookmark,
		save_bookmark,
		is_loaded,
	}
}
