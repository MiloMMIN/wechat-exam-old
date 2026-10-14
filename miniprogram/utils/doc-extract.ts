// utils/doc-extract.ts —— 小程序端解 .docx / .doc / .txt 抽纯文本
// .docx: zip + inflate（手写 RFC1951 canonical Huffman）
// .doc:  OLE2 CF + WordDocument 流；本实现走"全文件 UTF-16LE CJK 连续段提取"，
//        对 Aspose/Word 生成的常规 doc 题库都够用（piece table 路径不可靠时兜底）

function r16(b: Uint8Array, o: number): number { return b[o] | (b[o + 1] << 8) }
function r32(b: Uint8Array, o: number): number { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 }

// ============ Inflate (RFC1951) ============
interface HuffTable { count: number[]; symbol: number[] }

function buildHuff(lens: number[]): HuffTable {
  const count = new Array(16).fill(0)
  for (const l of lens) if (l) count[l]++
  const offs = new Array(16).fill(0)
  for (let l = 1; l < 15; l++) offs[l + 1] = offs[l] + count[l]
  const symbol = new Array<number>(lens.length).fill(0)
  for (let i = 0; i < lens.length; i++) {
    const l = lens[i]
    if (l) symbol[offs[l]++] = i
  }
  return { count, symbol }
}

function decodeHuff(st: { pos: number; bit: number }, data: Uint8Array, h: HuffTable): number {
  let code = 0, first = 0, index = 0
  for (let len = 1; len <= 15; len++) {
    const byte = st.pos >= data.length ? 0 : data[st.pos]
    const bit = (byte >> st.bit) & 1
    st.bit++
    if (st.bit === 8) { st.bit = 0; st.pos++ }
    code |= bit
    const cnt = h.count[len]
    if (code - first < cnt) return h.symbol[index + (code - first)]
    index += cnt
    first = (first + cnt) << 1
    code <<= 1
  }
  return -1
}

function inflateRaw(data: Uint8Array): Uint8Array | null {
  const out: number[] = []
  const st = { pos: 0, bit: 0 }
  const rb = (n: number): number => {
    let v = 0
    for (let i = 0; i < n; i++) {
      const byte = st.pos >= data.length ? 0 : data[st.pos]
      v |= ((byte >> st.bit) & 1) << i
      st.bit++
      if (st.bit === 8) { st.bit = 0; st.pos++ }
    }
    return v
  }
  const alignByte = () => { if (st.bit !== 0) { st.bit = 0; st.pos++ } }

  const LEN_BASE = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258]
  const LEN_EXTRA = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0]
  const DIST_BASE = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577]
  const DIST_EXTRA = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13]

  const FIXED_LEN = buildHuff((() => {
    const l = new Array(288)
    for (let i = 0; i < 144; i++) l[i] = 8
    for (let i = 144; i < 256; i++) l[i] = 9
    for (let i = 256; i < 280; i++) l[i] = 7
    for (let i = 280; i < 288; i++) l[i] = 8
    return l
  })())
  const FIXED_DIST = buildHuff(new Array(30).fill(5))

  let fin = false
  while (!fin) {
    fin = rb(1) === 1
    const bt = rb(2)
    if (bt === 0) {
      alignByte()
      const len = data[st.pos] | (data[st.pos + 1] << 8)
      st.pos += 4
      for (let i = 0; i < len; i++) out.push(data[st.pos++])
    } else if (bt === 1 || bt === 2) {
      let lc: HuffTable, dc: HuffTable
      if (bt === 1) { lc = FIXED_LEN; dc = FIXED_DIST }
      else {
        const hl = rb(5) + 257
        const hd = rb(5) + 1
        const hc = rb(4) + 4
        const ord = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]
        const cl = new Array(19).fill(0)
        for (let i = 0; i < hc; i++) cl[ord[i]] = rb(3)
        const cc = buildHuff(cl)
        const lens: number[] = []
        while (lens.length < hl + hd) {
          const s = decodeHuff(st, data, cc)
          if (s <= 15) lens.push(s)
          else if (s === 16) { const r = rb(2) + 3; for (let i = 0; i < r; i++) lens.push(lens[lens.length - 1]) }
          else if (s === 17) { const r = rb(3) + 3; for (let i = 0; i < r; i++) lens.push(0) }
          else if (s === 18) { const r = rb(7) + 11; for (let i = 0; i < r; i++) lens.push(0) }
        }
        lc = buildHuff(lens.slice(0, hl))
        dc = buildHuff(lens.slice(hl))
      }
      for (;;) {
        const s = decodeHuff(st, data, lc)
        if (s < 0) return null
        if (s === 256) break
        if (s < 256) { out.push(s); continue }
        const ls = s - 257
        const len = LEN_BASE[ls] + rb(LEN_EXTRA[ls])
        const ds = decodeHuff(st, data, dc)
        if (ds < 0) return null
        const dist = DIST_BASE[ds] + rb(DIST_EXTRA[ds])
        const start = out.length - dist
        for (let i = 0; i < len; i++) out.push(out[start + i])
      }
    } else return null
  }
  return new Uint8Array(out)
}

function decodeUtf8(b: Uint8Array): string {
  let s = ''
  for (let i = 0; i < b.length; i++) {
    const c = b[i]
    if (c < 0x80) s += String.fromCharCode(c)
    else if (c < 0xe0) s += String.fromCharCode(((c & 0x1f) << 6) | (b[++i] & 0x3f))
    else if (c < 0xf0) s += String.fromCharCode(((c & 0x0f) << 12) | ((b[++i] & 0x3f) << 6) | (b[++i] & 0x3f))
    else s += String.fromCharCode(((c & 0x07) << 18) | ((b[++i] & 0x3f) << 12) | ((b[++i] & 0x3f) << 6) | (b[++i] & 0x3f))
  }
  return s
}

// ============ DOCX (ZIP) ============
interface ZipEntry { name: string; data: Uint8Array }

function unzipDocx(buf: ArrayBuffer): ZipEntry[] {
  const bytes = new Uint8Array(buf)
  const entries: ZipEntry[] = []
  let eocd = -1
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) { eocd = i; break }
  }
  if (eocd < 0) return entries
  const cdOff = r32(bytes, eocd + 16)
  const cnt = r16(bytes, eocd + 10)
  let p = cdOff
  for (let i = 0; i < cnt; i++) {
    if (r32(bytes, p) !== 0x02014b50) break
    const method = r16(bytes, p + 10)
    const compSize = r32(bytes, p + 20)
    const nl = r16(bytes, p + 28)
    const el = r16(bytes, p + 30)
    const cl = r16(bytes, p + 32)
    const lOff = r32(bytes, p + 42)
    const name = decodeUtf8(bytes.subarray(p + 46, p + 46 + nl))
    if (!name.endsWith('/') && (method === 0 || method === 8) && r32(bytes, lOff) === 0x04034b50) {
      const lnl = r16(bytes, lOff + 26)
      const lex = r16(bytes, lOff + 28)
      const ds = lOff + 30 + lnl + lex
      const compData = bytes.subarray(ds, ds + compSize)
      const raw = method === 0 ? compData : inflateRaw(compData)
      if (raw) entries.push({ name, data: raw })
    }
    p += 46 + nl + el + cl
  }
  return entries
}

function unescapeXml(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}

function extractDocxText(buf: ArrayBuffer): string {
  const files = unzipDocx(buf)
  const doc = files.find(f => f.name === 'word/document.xml')
  if (!doc) return ''
  const xml = decodeUtf8(doc.data)
  const parts: string[] = []
  const re = /<w:t[^>]*>([^<]*)<\/w:t>/g
  let m: RegExpExecArray | null
  let last = 0
  while ((m = re.exec(xml)) !== null) {
    const between = xml.slice(last, m.index)
    if (between.includes('</w:p>') || between.includes('</w:tr>')) parts.push('\n')
    else if (between.includes('</w:tc>')) parts.push(' | ')
    parts.push(unescapeXml(m[1]))
    last = m.index + m[0].length
  }
  return parts.join('')
}

// ============ DOC (OLE2 / CF) ============
// 简化路径： Aspose/Word 生成的 .doc 里，正文 UTF-16LE 流就埋在文件里。
// 用「参考答案」锚定 + UTF-16LE 解码，比正经解 piece table 稳得多。

const DOC_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
function isOle2(buf: ArrayBuffer): boolean {
  const b = new Uint8Array(buf)
  for (let i = 0; i < 8; i++) if (b[i] !== DOC_MAGIC[i]) return false
  return true
}

function extractDocText(buf: ArrayBuffer): string {
  if (!isOle2(buf)) return ''
  const b = new Uint8Array(buf)
  // 1) 全文按 UTF-16LE 解出码点数组
  const all: number[] = []
  for (let i = 0; i < b.length - 1; i += 2) all.push(b[i] | (b[i + 1] << 8))

  // 2) 锚点：所有「参考答案」码点序列 (参 考 答 案)
  const hits: number[] = []
  for (let i = 0; i < all.length - 3; i++) {
    if (all[i] === 0x53c2 && all[i + 1] === 0x8003 && all[i + 2] === 0x7b54 && all[i + 3] === 0x6848) hits.push(i)
  }
  if (!hits.length) return ''

  // 3) 正文起点：在第一个「参考答案」之前找第一个形如 "NNN." 的题号（≥3位数字 + '.'）
  let start = 0
  for (let i = 0; i < hits[0]; i++) {
    const c = all[i]
    if (c >= 0x30 && c <= 0x39) {
      let j = i, numLen = 0
      while (j < all.length && all[j] >= 0x30 && all[j] <= 0x39) { numLen++; j++ }
      if (all[j] === 0x2e && numLen >= 3) { start = i; break }
    }
  }
  // 4) 正文终点：最后一个「参考答案」后再走一小段（含答案字母/行尾）
  const end = Math.min(all.length, hits[hits.length - 1] + 40)

  // 5) 抽出：换行 0x0d/0x0a → '\n'；控制字符（<0x20 且非换行）丢弃
  const parts: string[] = []
  for (let i = start; i < end; i++) {
    const c = all[i]
    if (c === 0x0d || c === 0x0a) parts.push('\n')
    else if (c >= 0x20) parts.push(String.fromCharCode(c))
  }
  return parts.join('')
}

// ============ 顶层入口 ============
export function extractOfficeText(path: string, fileName: string): { text: string; err?: string } {
  const fs = wx.getFileSystemManager()
  let buf: ArrayBuffer
  try {
    buf = fs.readFileSync(path) as ArrayBuffer
  } catch (e) {
    return { text: '', err: '读取文件失败' }
  }
  const b = new Uint8Array(buf)
  const isDocx = b[0] === 0x50 && b[1] === 0x4b

  if (isDocx) {
    const text = extractDocxText(buf)
    return { text: normalizeText(text) }
  }
  if (isOle2(buf)) {
    const text = extractDocText(buf)
    return { text: normalizeText(text) }
  }
  try {
    const text = fs.readFileSync(path, 'utf8') as string
    return { text: normalizeText(text) }
  } catch (e) {
    return { text: '', err: `不支持的文件类型：${fileName}` }
  }
}

function normalizeText(s: string): string {
  return s
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
}
