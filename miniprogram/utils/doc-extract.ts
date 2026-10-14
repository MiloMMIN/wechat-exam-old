// utils/doc-extract.ts —— 小程序端解 .docx / .doc 二进制抽纯文本
// 纯 JS 实现；不依赖 Node/浏览器 API

// ============ 基础位/字节读 ============
function r16(b: Uint8Array, o: number): number { return b[o] | (b[o + 1] << 8) }
function r32(b: Uint8Array, o: number): number { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 }

// ============ Inflate (RFC1951) ============
// Canonical Huffman decode 参考 puff.c：firstCode / index / symbol 表

interface HuffTable {
  /** count[len] = 该长度的符号数（len 1..15） */
  count: number[]
  /** symbol[i] = canonical 序第 i 个符号 */
  symbol: number[]
}

function buildHuff(lens: number[]): HuffTable {
  const count = new Array(16).fill(0)
  for (const l of lens) if (l) count[l]++
  // symbol 表：按 len 升序，同 len 按符号值升序
  const offs = new Array(16).fill(0)
  for (let l = 1; l < 15; l++) offs[l + 1] = offs[l] + count[l]
  const symbol = new Array<number>(lens.length).fill(0)
  for (let i = 0; i < lens.length; i++) {
    const l = lens[i]
    if (l) symbol[offs[l]++] = i
  }
  return { count, symbol }
}

function decodeHuff(state: { pos: number; bit: number }, data: Uint8Array, h: HuffTable): number {
  // 逐位累加 canonical 码；每加一位检查是否匹配某长度下的第一个码
  let code = 0, first = 0, index = 0
  for (let len = 1; len <= 15; len++) {
    // 读 1 位
    const byte = state.pos >= data.length ? 0 : data[state.pos]
    const bit = (byte >> state.bit) & 1
    state.bit++
    if (state.bit === 8) { state.bit = 0; state.pos++ }
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
  const state = { pos: 0, bit: 0 }
  const readBits = (n: number): number => {
    let v = 0
    for (let i = 0; i < n; i++) {
      const byte = state.pos >= data.length ? 0 : data[state.pos]
      v |= ((byte >> state.bit) & 1) << i
      state.bit++
      if (state.bit === 8) { state.bit = 0; state.pos++ }
    }
    return v
  }
  const alignByte = () => { if (state.bit !== 0) { state.bit = 0; state.pos++ } }

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

  let final = false
  while (!final) {
    final = readBits(1) === 1
    const btype = readBits(2)
    if (btype === 0) {
      alignByte()
      const len = data[state.pos] | (data[state.pos + 1] << 8)
      state.pos += 4
      for (let i = 0; i < len; i++) out.push(data[state.pos++])
    } else if (btype === 1 || btype === 2) {
      let lenCodes: HuffTable, distCodes: HuffTable
      if (btype === 1) {
        lenCodes = FIXED_LEN; distCodes = FIXED_DIST
      } else {
        const hlit = readBits(5) + 257
        const hdist = readBits(5) + 1
        const hclen = readBits(4) + 4
        const order = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]
        const clLens = new Array(19).fill(0)
        for (let i = 0; i < hclen; i++) clLens[order[i]] = readBits(3)
        const clCodes = buildHuff(clLens)
        const lens: number[] = []
        while (lens.length < hlit + hdist) {
          const sym = decodeHuff(state, data, clCodes)
          if (sym <= 15) lens.push(sym)
          else if (sym === 16) {
            const r = readBits(2) + 3
            for (let i = 0; i < r; i++) lens.push(lens[lens.length - 1])
          } else if (sym === 17) {
            const r = readBits(3) + 3
            for (let i = 0; i < r; i++) lens.push(0)
          } else if (sym === 18) {
            const r = readBits(7) + 11
            for (let i = 0; i < r; i++) lens.push(0)
          }
        }
        lenCodes = buildHuff(lens.slice(0, hlit))
        distCodes = buildHuff(lens.slice(hlit))
      }
      // LZ77
      for (;;) {
        const sym = decodeHuff(state, data, lenCodes)
        if (sym < 0) return null
        if (sym === 256) break
        if (sym < 256) { out.push(sym); continue }
        const ls = sym - 257
        const length = LEN_BASE[ls] + readBits(LEN_EXTRA[ls])
        const ds = decodeHuff(state, data, distCodes)
        if (ds < 0) return null
        const dist = DIST_BASE[ds] + readBits(DIST_EXTRA[ds])
        const start = out.length - dist
        for (let i = 0; i < length; i++) out.push(out[start + i])
      }
    } else {
      return null
    }
  }
  return new Uint8Array(out)
}

// ============ DOCX (ZIP) ============

interface ZipEntry { name: string; data: Uint8Array }

function decodeUtf8(b: Uint8Array): string {
  // 手动 UTF-8 → string，避免依赖 TextDecoder（小程序不一定有）
  let s = ''
  for (let i = 0; i < b.length; i++) {
    const c = b[i]
    if (c < 0x80) s += String.fromCharCode(c)
    else if (c < 0xe0) { s += String.fromCharCode(((c & 0x1f) << 6) | (b[++i] & 0x3f)) }
    else if (c < 0xf0) { s += String.fromCharCode(((c & 0x0f) << 12) | ((b[++i] & 0x3f) << 6) | (b[++i] & 0x3f)) }
    else { s += String.fromCharCode(((c & 0x07) << 18) | ((b[++i] & 0x3f) << 12) | ((b[++i] & 0x3f) << 6) | (b[++i] & 0x3f)) }
  }
  return s
}

function unzipDocx(buf: ArrayBuffer): ZipEntry[] {
  const bytes = new Uint8Array(buf)
  const entries: ZipEntry[] = []
  // 找 EOCD
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
  // 用 </w:p>、</w:tr> 作为段落/行边界，</w:tc> 作为列分隔
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

const DOC_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]

function isOle2(buf: ArrayBuffer): boolean {
  const b = new Uint8Array(buf)
  for (let i = 0; i < 8; i++) if (b[i] !== DOC_MAGIC[i]) return false
  return true
}

interface DirEntry { name: string; type: number; start: number; size: number }

function extractDocText(buf: ArrayBuffer): string {
  if (!isOle2(buf)) return ''
  const b = new Uint8Array(buf)
  const secShift = r16(b, 30)
  const miniShift = r16(b, 32)
  const secSize = 1 << secShift
  const miniSize = 1 << miniShift
  const firstDirSec = r32(b, 48)
  const miniCutoff = r32(b, 56)
  const firstMiniFatSec = r32(b, 60)
  const numMiniFatSecs = r32(b, 64)
  const firstDifatSec = r32(b, 68)
  const numDifatSecs = r32(b, 72)

  // DIFAT
  const difat: number[] = []
  for (let i = 0; i < 109; i++) difat.push(r32(b, 76 + i * 4))
  let dsec = firstDifatSec
  for (let i = 0; i < numDifatSecs; i++) {
    const off = 512 + dsec * secSize
    for (let j = 0; j < secSize / 4 - 1; j++) difat.push(r32(b, off + j * 4))
    dsec = r32(b, off + secSize - 4)
  }
  const fatSecs = difat.filter(s => s !== 0xffffffff && s !== 0xfffffffe)
  const fat: number[] = []
  for (const sec of fatSecs) {
    const off = 512 + sec * secSize
    for (let i = 0; i < secSize / 4; i++) fat.push(r32(b, off + i * 4))
  }
  const getSec = (sec: number) => b.subarray(512 + sec * secSize, 512 + (sec + 1) * secSize)

  // 目录
  const dirBytesArr: number[] = []
  let ds = firstDirSec
  while (ds !== 0xfffffffe && ds !== 0xffffffff) {
    const s = getSec(ds)
    for (let i = 0; i < s.length; i++) dirBytesArr.push(s[i])
    ds = fat[ds]
  }
  const dirBytes = new Uint8Array(dirBytesArr)
  const entries: DirEntry[] = []
  for (let i = 0; i < dirBytes.length; i += 128) {
    const nameLen = r16(dirBytes, i + 64)
    if (nameLen < 2) continue
    let name = ''
    for (let j = 0; j < nameLen - 2; j += 2) name += String.fromCharCode(dirBytes[i + j] | (dirBytes[i + j + 1] << 8))
    const type = dirBytes[i + 66]
    const start = r32(dirBytes, i + 116)
    const size = r32(dirBytes, i + 120)
    entries.push({ name, type, start, size })
  }

  const root = entries.find(e => e.name === 'Root Entry' || e.type === 5)
  const wordDoc = entries.find(e => e.name === 'WordDocument')
  const table = entries.find(e => e.name === '1Table' || e.name === '0Table')
  if (!root || !wordDoc || !table) return ''

  // MiniFAT + MiniStream
  const miniFat: number[] = []
  let mfs = firstMiniFatSec
  for (let i = 0; i < numMiniFatSecs && mfs !== 0xfffffffe && mfs !== 0xffffffff; i++) {
    const s = getSec(mfs)
    for (let j = 0; j < s.length / 4; j++) miniFat.push(r32(s, j * 4))
    mfs = fat[mfs]
  }
  const miniBytes: number[] = []
  let ms = root.start
  while (ms !== 0xfffffffe && ms !== 0xffffffff) {
    const s = getSec(ms)
    for (let i = 0; i < s.length; i++) miniBytes.push(s[i])
    ms = fat[ms]
  }
  const miniStream = new Uint8Array(miniBytes)

  const readStream = (e: DirEntry): Uint8Array => {
    const out: number[] = []
    if (e.size < miniCutoff) {
      let sec = e.start
      while (sec !== 0xfffffffe && sec !== 0xffffffff && out.length < e.size) {
        const off = sec * miniSize
        for (let i = 0; i < miniSize; i++) out.push(miniStream[off + i])
        sec = miniFat[sec]
      }
    } else {
      let sec = e.start
      while (sec !== 0xfffffffe && sec !== 0xffffffff && out.length < e.size) {
        const s = getSec(sec)
        for (let i = 0; i < s.length; i++) out.push(s[i])
        sec = fat[sec]
      }
    }
    return new Uint8Array(out.slice(0, e.size))
  }

  const wordBytes = readStream(wordDoc)
  const tableBytes = readStream(table)

  const fcMin = r32(wordBytes, 0x18)
  const ccpText = r32(wordBytes, 0x4c)
  const flags = r16(wordBytes, 0x0a)
  const fComplex = (flags >> 2) & 1
  const fcClx = r32(wordBytes, 0x01a2)
  const lcbClx = r32(wordBytes, 0x01a6)

  const parts: string[] = []
  if (fComplex && fcClx && lcbClx) {
    let p = fcClx
    const end = fcClx + lcbClx
    while (p < end) {
      const tag = tableBytes[p]
      if (tag === 0x01) {
        const cb = r16(tableBytes, p + 1)
        p += 3 + cb
      } else if (tag === 0x02) {
        const lcb = r32(tableBytes, p + 1)
        const plc = p + 5
        const nPcd = (lcb - 4) / 12
        const cps: number[] = []
        for (let i = 0; i <= nPcd; i++) cps.push(r32(tableBytes, plc + i * 4))
        for (let i = 0; i < nPcd; i++) {
          const pcdOff = plc + (nPcd + 1) * 4 + i * 8
          const fc = r32(tableBytes, pcdOff + 2)
          const fcCompressed = (fc >> 30) & 1
          const realFc = fc & 0x3fffffff
          const cpLen = cps[i + 1] - cps[i]
          if (fcCompressed) {
            const byteOff = realFc >> 1
            for (let k = 0; k < cpLen; k++) {
              const c = wordBytes[byteOff + k]
              parts.push(c === 0x0d ? '\n' : String.fromCharCode(c))
            }
          } else {
            for (let k = 0; k < cpLen; k++) {
              const c = wordBytes[realFc + k * 2] | (wordBytes[realFc + k * 2 + 1] << 8)
              parts.push(c === 0x0d ? '\n' : String.fromCharCode(c))
            }
          }
        }
        break
      } else break
    }
  } else {
    for (let i = 0; i < ccpText; i++) {
      const c = wordBytes[fcMin + i * 2] | (wordBytes[fcMin + i * 2 + 1] << 8)
      parts.push(c === 0x0d ? '\n' : String.fromCharCode(c))
    }
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
  const isDoc = isOle2(buf)

  if (isDocx) {
    const text = extractDocxText(buf)
    return { text: normalizeText(text) }
  }
  if (isDoc) {
    const text = extractDocText(buf)
    return { text: normalizeText(text) }
  }
  // 兜底按 UTF-8 文本
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
