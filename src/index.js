/*eslint-disable no-unused-vars*/

import './css/index.scss'
import { CowAlert } from './cowAlert'
import { load_drop_handler } from './dragDropLoader'
import { ParseFiMStory } from './fimParser'
import { create_bookmark_handler } from './bookmark'

function debounce(f, t) {
	let id
	return function () {
		const c = this
		const a = arguments
		if (id) clearTimeout(id)
		id = setTimeout(() => {
			id = null
			f.apply(c, a)
		}, t)
	}
}

function getElementOffset(elem) {
	if (!elem.getClientRects()?.length) {
		return { top: 0, left: 0 }
	}

	const rect = elem.getBoundingClientRect()
	const win = elem.ownerDocument.defaultView
	return {
		top: rect.top + win.pageYOffset,
		left: rect.left + win.pageXOffset,
	}
}

function copyObject(obj) {
	return obj && Object.keys(obj).length ? JSON.parse(JSON.stringify(obj)) : {}
}

Vue.prototype.$generateId = (t = 16) => {
	let e = '',
		r = t
	for (; r--; ) e += 'ModuleSymbhasOwnPr-0123456789ABCDEFGHNRVfgctiUvz_KqYTJkLxpZXIjQW'[(Math.random() * 64) | 0]
	return e
}

const storyStore = Vue.observable({
	id: -1,
	filename: '',
	story: { Chapters: {} },
	config: {},
	blobImages: {}, // For setups that directly loads images
})
Vue.use(CowAlert)
Vue.component('CowLine', {
	data() {
		return { storyStore }
	},
	computed: {
		story() {
			return this.storyStore
		},
		hasConfig() {
			return this.story.config && Object.keys(this.story.config).length
		},
	},
	methods: {
		sanitize_string(str) {
			return (str || '').replace(/\.\.\.(?=\S)/g, '...\u200B')
		},
		sanitize_attr(_attr) {
			if (!_attr || !Object.keys(_attr).length) return {}

			const attr = copyObject(_attr)
			attr.attrs = {}
			if (attr.hasOwnProperty('src')) {
				attr.attrs.src = this.fetch_image(attr.src)
				delete attr.src
			}

			return attr
		},

		// Modify if needed.
		fetch_image(src) {
			if (this.story.blobImages && this.story.blobImages[src]) return this.story.blobImages[src]
			return src
		},
	},
	props: {
		content: {
			type: [String, Object],
			required: true,
		},
	},

	// Do not ask me I don't know either
	render(create) {
		// Formats 0-1
		if (typeof this.content === 'string') {
			if (
				!this.hasConfig ||
				!(this.story.config.imageFormatText && this.story.config.imageFormatText.test(this.content))
			)
				return create('p', this.sanitize_string(this.content))

			const config = this.story.config
			let line_index = parseInt(this.content.replace(config.imageFormatText, ''))
			let img_filename = this.content.replace(config.imageFormatText, config.imageFormatFile)
			let img_filetype = config.imageGIFIndex && config.imageGIFIndex.includes(line_index) ? '.gif' : '.png'

			return create('img', { attrs: { src: this.fetch_image(img_filename + img_filetype) } }, line_index)
		}

		// Format 2-3
		if (this.content.children) {
			const children = []
			this.content.children.forEach((x) => {
				if (typeof x === 'string') children.push(this.sanitize_string(x))
				else if (x.children)
					x.children.forEach((y) => {
						children.push(create('cow-line', { props: { content: y } }))
					})
				else if (!x.children) children.push(create(x.tag, this.sanitize_attr(x.attr), x.data))
			})
			return create(this.content.tag, this.sanitize_attr(this.content.attr), children)
		}

		return create(this.content.tag, this.sanitize_attr(this.content.attr))
	},
})

new Vue({
	data: {
		storyStore,

		currentChapter: 0,
		showChapterSelect: false,

		bookmarkHandler: {},
		allowScroll: false,

		_navOffset: 0,
	},
	computed: {
		story() {
			return this.storyStore.story
		},
		storyDetails() {
			return this.storyStore
		},
		bookmark() {
			return this.bookmarkHandler.get_bookmark()
		},

		computedCurrentChapter() {
			return !this.story.Format
				? this.story.Text
				: this.story.Chapters[Object.keys(this.story.Chapters)[this.currentChapter]]
		},
		has_multiple_chapters() {
			return this.story.Format === 0 ? false : Object.keys(this.story.Chapters).length > 1
		},
	},
	methods: {
		_get_y_scroll() {
			const doc = document.documentElement
			return (window.pageYOffset || doc.scrollTop) - (doc.clientTop || 0)
		},

		_doc_scroll_1() {
			if (!this.allowScroll || !this.bookmarkHandler.is_loaded || this.story.Format === 0) return
			this.set_bookmark()
		},
		_doc_resize() {
			if (!this.allowScroll || !this.bookmarkHandler.is_loaded || this.story.Format === 0) return
			this.set_bookmark_div()
		},
		_doc_scroll_2() {
			const navOffset = this._navOffset
			const scroll = window.pageYOffset
			const article = document.querySelector('article#content')
			if (navOffset < scroll) article.classList.add('docked')
			if (navOffset > scroll) article.classList.remove('docked')
		},

		setup() {
			document.title = `${this.story.Title} - Cow Reader`

			// -- Save bookmark on scroll
			document.addEventListener('scroll', this._doc_scroll_1)

			// -- When page resizes, apply bookmark accordingly
			document.addEventListener('resize', this._doc_resize)

			// -- Set chapter navbar if the format type isn't raw
			this.$nextTick(() => {
				document.querySelector('article#content').classList.remove('docked')
				if (this.story.Format !== 0 && this.has_multiple_chapters) {
					this._navOffset = getElementOffset(document.querySelector('nav')).top
					document.addEventListener('scroll', this._doc_scroll_2)
				}

				this.$nextTick(() => {
					this.set_chapter(this.bookmark.lastSeenChapter, true)
					this.scroll_to_bookmark_div()
				})
			})
		},

		show_chapter_select() {
			if (this.story.Format === 0) return
			if (Object.keys(this.story.Chapters).length < 2) return

			this.showChapterSelect = true
		},
		hide_chapter_select() {
			this.showChapterSelect = false
		},
		select_chapter(chapter_key) {
			this.set_chapter(Object.keys(this.story.Chapters).indexOf(chapter_key))

			this.showChapterSelect = false
		},

		//
		set_chapter(index, startup) {
			index = index || 0

			this.currentChapter = index
			this.set_bookmark_div()
			if (!startup) {
				this.bookmarkHandler.get_storage_bookmark().lastSeenChapter = !index ? null : index
				this.save_bookmark()

				this.$nextTick(() => {
					window.scrollTo(0, getElementOffset(document.querySelector('article#content article')).top)
				})
			}
		},
		set_new_page(offset) {
			const new_page = this.currentChapter + offset
			if (new_page < 0 || new_page >= Object.keys(storyStore.story.Chapters).length) return
			this.set_chapter(new_page, false)
		},

		// Bookmark Handlers
		set_bookmark_div() {
			if (this.currentChapter !== this.bookmark.scrollChapter) {
				document.getElementById('bookmark').classList.remove('placed')
				return
			}

			if (!this.bookmark.scrollParagraph) return

			document.getElementById('bookmark').classList.add('placed')
			this.$nextTick(() => {
				if (this.bookmark.scrollParagraph >= document.getElementById('contents').childNodes.length - 1) return
				const el = document.getElementById('contents').childNodes[this.bookmark.scrollParagraph - 1]

				document.querySelector('#bookmark .inner').style.top =
					getElementOffset(el).top - getElementOffset(document.getElementById('contents')).top + 'px'
			})
		},
		scroll_to_bookmark_div() {
			if (!this.bookmark.scrollParagraph) {
				this.allowScroll = true
				return
			}

			const contentCheck = setInterval(() => {
				if (this.bookmark.scrollParagraph >= document.getElementById('contents').childNodes.length - 1) {
					this.allowScroll = true
					return
				}

				const el = document.getElementById('contents').childNodes[this.bookmark.scrollParagraph - 1]
				if (document.getElementById('contents').childNodes.length - 1 < this.bookmark.scrollParagraph - 1) {
					this.allowScroll = true
					clearInterval(contentCheck)
					return
				}
				if (el && el.offsetTop) {
					window.scroll(0, el.offsetTop)
					clearInterval(contentCheck)
					setTimeout(() => {
						this.allowScroll = true
					}, 100)
				}
			}, 100)
		},

		has_bookmark(t) {
			const b = t || this.bookmark
			return b.scrollChapter !== null && b.scrollParagraph !== null && b.scrollAmount !== null
		},

		async get_bookmark() {
			await this.bookmarkHandler.load_bookmark()
		},
		save_bookmark: debounce(async function () {
			await this.bookmarkHandler.save_bookmark()
		}, 1000),

		set_bookmark() {
			const scroll = this._get_y_scroll()
			const paragraphs = [...document.getElementById('contents').childNodes]
			const first_paragraph = paragraphs.shift()
			const base = document.getElementById('contents').offsetTop
			const bookmark = this.bookmarkHandler.get_storage_bookmark()

			// No progress
			if (scroll <= getElementOffset(first_paragraph).top) {
				bookmark.scrollChapter = null
				bookmark.scrollParagraph = null
				bookmark.scrollAmount = null
			}
			// Has progress
			else {
				bookmark.scrollAmount = scroll
				bookmark.scrollChapter = this.currentChapter
				let index = 2
				for (let child of paragraphs) {
					let pos = base + child.offsetTop
					if (pos >= scroll) {
						bookmark.scrollParagraph = index
						break
					}
					index++
				}
			}

			this.save_bookmark()
		},

		// Functions that needs to be changed depending on the setup
		reset_story() {
			this.storyDetails.story = {}
			this.storyDetails.filename = ''
			this.storyDetails.blobImages = {}
			this.storyDetails.config = {}
			this.storyDetails.id = -1
		},

		load_story(filename, content) {
			if (this.storyDetails.filename === filename) return

			document.removeEventListener('scroll', this._doc_scroll_2)
			document.removeEventListener('resize', this._doc_resize)

			this.$set(this.storyDetails, 'story', ParseFiMStory(content.entry || filename, content.content))
			this.storyDetails.filename = filename
			this.storyDetails.blobImages = content.images || {}
			this.storyDetails.config = content.config || {}

			if (this.storyDetails.config && Object.keys(this.storyDetails.config).length) {
				this.storyDetails.config.imageFormatText = new RegExp(this.storyDetails.config.imageFormatText, 'g')
			}

			this.bookmarkHandler = create_bookmark_handler({ hash: filename })
			this.get_bookmark()

			this.storyDetails.id = 1
			this.$nextTick(() => {
				this.setup()
			})
		},

		unload_story() {
			this.reset_story()
		},
	},
	mounted() {
		load_drop_handler(this.load_story, this.unload_story)
	},
}).$mount('#app')
