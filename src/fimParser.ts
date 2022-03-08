import { parse as parseHTML } from 'node-html-parser'

export enum FiMFormatType {
	FIMFICTION_ARROW = 1,
	FIMFICTION_SLASH = 2,
	FIMFETCH = 3,
	FIMHTML = 4,

	UNKNOWN = -1,
	RAW = 0,
}
export interface FiMStory {
	Format: FiMFormatType
	Title: string
	Author: string
	Chapters: { [key: string]: (string | objectHTMLTree)[] }
}
export interface FiMStoryRaw {
	Format: FiMFormatType
	Text: string[]
}

interface objectHTMLTree {
	tag: string
	attr?: { [key: string]: any }
	children?: (string | objectHTMLTree)[]
	data?: string
}
function objectify_html(o: HTMLElement, depth: number = 1): objectHTMLTree | string {
	if (o.nodeType === 3) {
		if (o.textContent?.trim() !== o.textContent) return o.textContent!.replace(/^(\r\n)?                /g, '') // what the fuck
		return o.textContent!
	}

	const tree: objectHTMLTree = { tag: o.tagName.toLowerCase() }

	if (Object.keys(o.attributes).length) {
		tree.attr = {}
		Object.keys(o.attributes).forEach((k) => {
			// @ts-ignore
			tree.attr![k] = o.attributes[k]
		})
		if (tree.attr.hasOwnProperty('src')) {
			let filename: string = tree.attr.src!
			if (filename.includes('/')) filename = filename.split('/').pop()!
			tree.attr.src = filename
		}
	}

	if (o.childNodes.length) {
		if (o.childNodes.length === 1 && o.firstChild?.nodeType === 3) {
			// optimize p's by just only returning string
			if (tree.tag === 'p') return objectify_html(o.firstChild as HTMLElement) as string
			else tree.data = objectify_html(o.firstChild as HTMLElement) as string
		} else {
			tree.children = []
			o.childNodes.forEach((x) => {
				tree.children!.push(objectify_html(x as HTMLElement, depth + 1))
			})
		}
	}

	return tree
}

function ParseFiMHTMLStory(content: string, Story: FiMStory): FiMStory {
	const dom = parseHTML(content)

	if (!dom.querySelector('header h1 a') && !dom.querySelector('header h2 a')) {
		// FIXME: This probably looks cursed? Maybe find a better way to do this.

		Story.Title = dom.querySelector('h1 a').textContent
		Story.Author = dom.querySelector('h2 a').textContent

		// Chapter

		const bodyChildren = dom.querySelector('body').childNodes

		let chapterName = ''
		let startIndex = 0
		while (startIndex < bodyChildren.length) {
			const el = bodyChildren[startIndex] as unknown as HTMLElement
			if (el.tagName === 'H3') {
				chapterName = el.textContent
				startIndex++ // Skip before breaking
				break
			}
			startIndex++
		}

		if (!chapterName.trim() || startIndex == bodyChildren.length) {
			throw 'Failed to parse story!'
		}

		const chapterContents = []
		for (let i = startIndex; i < bodyChildren.length; i++) {
			const node = bodyChildren[i] as unknown as HTMLElement
			if (node.textContent && !chapterContents.length && !node.textContent.trim()) continue
			chapterContents.push(objectify_html(node, 0))
		}

		Story.Chapters[chapterName] = chapterContents
	} else {
		// Information
		{
			Story.Title = dom.querySelector('header h1 a').textContent
			Story.Author = dom.querySelector('header h2 a').textContent
		}

		// Chapters
		{
			dom.querySelectorAll('article.chapter').forEach((chapterElement) => {
				const chapterName = chapterElement
					.querySelector('header h1')
					.childNodes.find((x) => x.rawText)!
					.toString()

				const children = chapterElement.childNodes.filter((x) => {
					if (x.nodeType === 3 && !x.textContent.trim()) return false
					return true
				})

				const startRegex = /<header[^>]*>/
				const endRegex = /<(aside|footer)[^>]*>/

				while (startRegex.test(children[0].toString())) children.shift()
				while (endRegex.test(children[children.length - 1].toString())) children.pop()

				const chapterContents = []
				for (let i = 0; i < children.length; i++) {
					const content = objectify_html(children[i] as unknown as HTMLElement, 0) // dont ask me about this, i don't know either
					chapterContents.push(content)
				}

				Story.Chapters[chapterName] = chapterContents
			})
		}
	}

	return Story
}

export function ParseFiMStory(file: string, content: string): FiMStory | FiMStoryRaw {
	let Story: FiMStory = {
		Format: FiMFormatType.UNKNOWN,
		Title: '',
		Author: '',
		Chapters: {},
	}

	// -- Check if we need to parse HTML -- \\
	if (file.endsWith('.html')) {
		Story.Format = FiMFormatType.FIMHTML
		return ParseFiMHTMLStory(content, Story)
	}

	// -- File Parsing -- \\
	let Raw: string[] = []
	if (content.includes('�')) {
		throw `Story at ${file} contains an illegal character! Use iconv to fix it.`
	}
	// Raw = content.replace(/\t/g,"\n").replace(/’/g,"'").replace(/…/g,"...").replace(/[“”]/g,'"').split('\n');
	Raw = content.replace(/\t/g, '\n').split('\n') // we'll keep the fancy shmut
	Raw = Raw.map((x) => x.replace('\r', '').trim()).filter((x) => x !== '')

	// -- Format Type -- \\
	if (/\/\/-{55}\/\//g.test(Raw[0])) {
		Story.Format = FiMFormatType.FIMFETCH
	} else if (/\/\/-{30}\/\//g.test(Raw[0])) {
		Story.Format = FiMFormatType.FIMFICTION_SLASH
	} else if (Raw[0].startsWith('> ')) {
		Story.Format = FiMFormatType.FIMFICTION_ARROW
	} else {
		return <FiMStoryRaw>{
			Format: FiMFormatType.RAW,
			Text: Raw,
		}
	}

	// -- Story Content --\\
	switch (Story.Format) {
		case FiMFormatType.FIMFETCH:
			{
				Story.Title = Raw[1].trim()
				Story.Author = Raw[2].trim()
				Story.Author = Story.Author.substring(4, Story.Author.length - 1)

				let buffer: string[] = []
				let is_in_chapter = true
				let chapter_name = ''
				for (let i = 4; i < Raw.length; i++) {
					let line = Raw[i]

					if (/\/\/-{55}\/\//g.test(line)) {
						if (buffer.length > 0) {
							if (is_in_chapter) Story.Chapters[chapter_name] = Object.assign([], buffer)
							else chapter_name = buffer[0].trim()

							buffer = []
						}
						is_in_chapter = !is_in_chapter
						continue
					}

					buffer.push(line)
				}
				if (buffer.length > 0 && is_in_chapter) Story.Chapters[chapter_name] = buffer
			}
			break

		case FiMFormatType.FIMFICTION_ARROW:
			{
				Story.Title = Raw[0].substr(2)
				Story.Author = Raw[1].substr(6)

				let chapter_name = ''
				let buffer: string[] = []

				let i = 2
				while (++i) {
					if (i >= Raw.length) break
					let line = Raw[i]

					if (i + 1 < Raw.length) {
						if (line.startsWith('>') && Raw[i + 1] && /> -{74}/g.test(Raw[i + 1])) {
							if (buffer.length > 0) {
								Story.Chapters[chapter_name] = Object.assign([], buffer)
								buffer = []
							}
							chapter_name = line.substr(2)
							i++
							continue
						}
					}

					buffer.push(line)
				}

				if (buffer.length > 0) Story.Chapters[chapter_name] = Object.assign([], buffer)
			}
			break

		case FiMFormatType.FIMFICTION_SLASH:
			{
				let chapter_name = ''
				let is_single_chapter = false

				let starting_index = -1

				// This is incredibly cursed, please do not attempt this at home
				{
					let i = 0
					let buffer = []
					while (++i) {
						let line = Raw[i]
						if (/^\/\/-{30}\/\/$/g.test(line)) break
						buffer.push(line)
					}
					if (!buffer[buffer.length - 1].endsWith('//------------------------------//'))
						buffer.push('//------------------------------//')

					let r = /(?:\/\/(.+))?\/\/(.+)\/\/(.+)\/\/-{30}\/\//g
					let _r = r.exec(buffer.join(' '))
					let info = _r!
						.slice(1)
						.filter((x) => x)
						.map((x) => x.trim())

					if (info.length === 3) {
						is_single_chapter = true
						chapter_name = info.shift()!
					}
					Story.Title = info.shift()!
					if (is_single_chapter && Story.Title.startsWith('Story: ')) Story.Title = Story.Title.substr(7)
					Story.Author = info.shift()!.substr(3)
					starting_index = i + 1
				}

				if (is_single_chapter) {
					Story.Chapters[chapter_name] = Raw.slice(starting_index)
					break
				}

				let is_in_chapter = false
				let buffer = []
				for (let i = starting_index; i < Raw.length; i++) {
					let line = Raw[i]

					if (/\/\/-{30}\/\//g.test(line)) {
						if (buffer.length > 0) {
							if (is_in_chapter) Story.Chapters[chapter_name] = Object.assign([], buffer)
							else chapter_name = buffer[0].trim().substr(3)

							buffer = []
						}
						is_in_chapter = !is_in_chapter
						continue
					}

					buffer.push(line)
				}

				if (buffer.length > 0 && is_in_chapter) Story.Chapters[chapter_name] = buffer
			}
			break
	}

	return Story
}
