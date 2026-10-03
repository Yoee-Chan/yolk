import {DOMParser, XMLSerializer} from '@xmldom/xmldom'
import type {Document as XmlDocument, Element as XmlElement, Node as XmlNode} from '@xmldom/xmldom'
import {WORD_NS} from './constants'

export type {XmlDocument, XmlElement, XmlNode}

export const parser = new DOMParser()
export const serializer = new XMLSerializer()

export function localName(node: XmlNode): string {
    const element = node as unknown as XmlElement
    return element.localName || node.nodeName.split(':').pop() || node.nodeName
}

export function childElements(node: XmlNode, name?: string): XmlElement[] {
    const children: XmlElement[] = []
    for (let child = node.firstChild; child; child = child.nextSibling) {
        if (child.nodeType === 1 && (!name || localName(child) === name)) children.push(child as unknown as XmlElement)
    }
    return children
}

export function descendants(node: XmlNode, name: string): XmlElement[] {
    const result: XmlElement[] = []
    const visit = (current: XmlNode) => {
        for (let child = current.firstChild; child; child = child.nextSibling) {
            if (child.nodeType !== 1) continue
            if (localName(child) === name) result.push(child as unknown as XmlElement)
            visit(child)
        }
    }
    visit(node)
    return result
}

export function firstDescendant(node: XmlNode, name: string): XmlElement | undefined {
    return descendants(node, name)[0]
}

export function attr(element: XmlElement | undefined, name: string, namespace = WORD_NS): string | undefined {
    if (!element) return undefined
    return element.getAttributeNS(namespace, name) || element.getAttribute(`w:${name}`) || undefined
}

export function sourceXmlPath(element: XmlElement): string {
    const segments: string[] = []
    let current: XmlNode | null = element
    while (current?.nodeType === 1) {
        const currentElement = current as unknown as XmlElement
        const name = localName(currentElement)
        let index = 1
        for (let sibling = currentElement.previousSibling; sibling; sibling = sibling.previousSibling) {
            if (sibling.nodeType === 1 && localName(sibling) === name) index += 1
        }
        segments.unshift(`w:${name}[${index}]`)
        current = currentElement.parentNode
    }
    return `/${segments.join('/')}`
}

export function parseXml(bytes: Uint8Array): ReturnType<DOMParser['parseFromString']> {
    return parser.parseFromString(Buffer.from(bytes).toString('utf8'), 'text/xml')
}

export function serializeXml(document: ReturnType<DOMParser['parseFromString']>): Uint8Array {
    return Buffer.from(serializer.serializeToString(document), 'utf8')
}
