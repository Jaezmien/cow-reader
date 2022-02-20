function load_story_from_folder(item, path) {
	function read(i) {
		return new Promise((res) => {
			const reader = i.createReader()
			reader.readEntries((e) => {
				res(e)
			})
		})
	}
	async function load(i, p) {
		p = p || ''

		if (i.isFile) {
			return i
		}
		const entries = await read(i)
		const children = {}
		for (let _i = 0; _i < entries.length; _i++) {
			const entry = entries[_i]
			let name = entry.name
			if (!name.includes('.')) name += '/'
			children[name] = await load_story_from_folder(entry, p + entry.name + '/')
		}
		return children
	}

	return new Promise((res) => {
		res(load(item, path))
	})
}
function load_file_as_text(item) {
	return new Promise((res, rej) => {
		item.file((f) => {
			const reader = new FileReader()

			reader.onload = (x) => res(x.target.result)
			reader.onerror = (x) => rej(x)

			reader.readAsText(f)
		}, rej)
	})
}
function load_file_as_image(item) {
	return new Promise((res, rej) => {
		item.file((f) => {
			res(URL.createObjectURL(f))
		}, rej)
	})
}

export async function load_drop_story(e, res, rej) {
	const data = e.dataTransfer
	if (!data.types) return

	if (data.items.length !== 1) {
		Vue.createCowAlert('Invalid file count, drop only one', 1)
		return
	}

	const story = {}
	let type = 0
	const item = data.items[0].webkitGetAsEntry()

	if (item.isDirectory) {
		const contents = await load_story_from_folder(item, '')
		const content_keys = Object.keys(contents)

		if (content_keys.includes('story.txt')) type = 1
		else if (content_keys.includes('story.html')) type = 3
		else {
			Vue.createCowAlert('Could not find story inside folder', 1)
			rej()
			return
		}

		if (type === 1) {
			if (!content_keys.includes('images/')) {
				Vue.createCowAlert('COW.READER.V1 could not find an image folder!', 1)
				rej()
				return
			}
			if (!content_keys.includes('config.json')) {
				Vue.createCowAlert('COW.READER.V1 could not find the config folder!', 1)
				rej()
				return
			}
		}

		const filename = 'story.' + (type === 1 ? 'txt' : 'html')
		story.entry = item.name + '/' + filename
		story.content = await load_file_as_text(contents[filename])

		if (content_keys.includes('config.json')) {
			story.config = JSON.parse(await load_file_as_text(contents['config.json'])) || {}
		}
		if (content_keys.includes('images/')) {
			story.images = {}
			for (const image of Object.keys(contents['images/'])) {
				const img = contents['images/'][image]
				story.images[image] = await load_file_as_image(img)
			}
		}

		res(item.name, story)
	} else {
		if (!['.txt', '.html'].some((s) => item.name.endsWith(s))) {
			Vue.createCowAlert('Invalid story format', 1)
			rej()
			return
		}
		story.content = await load_file_as_text(item)
		res(item.name, story)
	}
}

const state = Vue.observable({
	is_dropping_file: false,
})

export async function load_drop_handler(res, rej) {
	const body = document.querySelector('body')

	body.ondragover = (e) => {
		e.preventDefault()
		const i = e.dataTransfer.items
		if (Object.keys(i).some((x) => i[x].kind === 'file')) {
			state.is_dropping_file = true
			body.classList.add('hover')
		}
	}
	body.ondragleave = (e) => {
		e.preventDefault()
		body.classList.remove('hover')
	}
	body.ondrop = (e) => {
		if (!state.is_dropping_file) return
		e.preventDefault()
		body.classList.remove('hover')
		load_drop_story(e, res, rej)
	}
}
