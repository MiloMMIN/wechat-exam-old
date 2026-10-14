# -*- coding: utf-8 -*-
"""解析 docx 题库 → miniprogram/data/questions.ts

文档结构（body 顺序）：题干段落(以"编号."开头) → 选项表格(每行 "X、|选项文本") → 【参考答案】X
"""
import docx
import json
import re
import sys
from docx.table import Table
from docx.text.paragraph import Paragraph

SRC = '电子商务师三级理论试题-80.docx'
OUT = 'miniprogram/data/questions.ts'

QRE = re.compile(r'^\s*(\d+)\s*[\.、]\s*(.*)', re.S)
ANS_RE = re.compile(r'【参考答案】\s*([A-D]+)')
OPT_RE = re.compile(r'^\s*([A-Z])\s*[、.]\s*')


def clean(text: str) -> str:
    # 去掉 \u2002 等占位空白，压缩连续空白
    t = re.sub(r'[   ​]', '', text)
    t = re.sub(r'\s+', ' ', t).strip()
    # 题目中的填空占位（）统一为（ ）
    t = t.replace('（）', '（ ）')
    return t


def main():
    d = docx.Document(SRC)
    seq = []
    for child in d.element.body.iterchildren():
        tag = child.tag.split('}')[-1]
        if tag == 'p':
            seq.append(('p', Paragraph(child, d).text))
        elif tag == 'tbl':
            seq.append(('t', Table(child, d)))

    questions = []
    i = 0
    while i < len(seq):
        kind, val = seq[i]
        if kind == 'p':
            m = QRE.match(val.strip())
            if m:
                no = int(m.group(1))
                stem = clean(m.group(2))
                # 题干可能跨段：直到遇到表格
                j = i + 1
                while j < len(seq) and seq[j][0] == 'p' and not ANS_RE.search(seq[j][1]):
                    extra = seq[j][1].strip()
                    if extra:
                        stem += ' ' + clean(extra)
                    j += 1
                # 表格
                options = {}
                if j < len(seq) and seq[j][0] == 't':
                    tbl = seq[j][1]
                    for row in tbl.rows:
                        cells = [c.text.strip() for c in row.cells]
                        if len(cells) >= 2:
                            lm = OPT_RE.match(cells[0])
                            if lm:
                                options[lm.group(1)] = clean(cells[1])
                            elif OPT_RE.match(cells[1] or ''):
                                options[OPT_RE.match(cells[1]).group(1)] = clean(cells[0])
                        elif len(cells) == 1:
                            om = OPT_RE.match(cells[0])
                            if om:
                                # "A、文本" 单格
                                options[om.group(1)] = clean(OPT_RE.sub('', cells[0]))
                    j += 1
                # 答案
                answer = ''
                if j < len(seq) and seq[j][0] == 'p':
                    am = ANS_RE.search(seq[j][1])
                    if am:
                        answer = am.group(1)
                    j += 1
                questions.append({
                    'no': no,
                    'stem': stem,
                    'options': options,
                    'answer': answer,
                })
                i = j
                continue
        i += 1

    # 770 缺答案：从旧 docx 回填（同源题号）
    FALLBACK = '电子商务师 （选择题）.docx'
    missing = [q for q in questions if not q['answer']]
    if missing and __import__('os').path.exists(FALLBACK):
        fallback = {}
        fd = docx.Document(FALLBACK)
        fseq = []
        for ch in fd.element.body.iterchildren():
            t = ch.tag.split('}')[-1]
            if t == 'p':
                fseq.append(Paragraph(ch, fd).text)
        for qi, q in enumerate(missing):
            for pi, p in enumerate(fseq):
                if p.strip().startswith(f"{q['no']}."):
                    if pi + 1 < len(fseq):
                        m = ANS_RE.search(fseq[pi + 1])
                        if m:
                            q['answer'] = m.group(1)
                    break
        still = [q['no'] for q in missing if not q['answer']]
        if still:
            print(f'回填后仍缺答案: {still}')

    # 校验：丢弃缺答案/缺选项题
    bad = [q for q in questions if not q['answer'] or len(q['options']) < 3 or q['answer'] not in q['options']]
    if bad:
        print('DROP bad questions:', [(q['no'], q['answer']) for q in bad])
        questions = [q for q in questions if q not in bad]
    nos = [q['no'] for q in questions]
    assert len(nos) == len(set(nos)), 'duplicate question numbers'

    letters = ['A', 'B', 'C', 'D']
    compact = []
    for q in questions:
        opts = [q['options'].get(l, '') for l in letters]
        # 去掉尾部全空选项
        while opts and opts[-1] == '':
            opts.pop()
        compact.append({
            'id': q['no'],
            'q': q['stem'],
            'o': opts,
            'a': letters.index(q['answer']),
        })

    ts = (
        '// 由 scripts/docx-to-questions.py 自动生成，勿手改\n'
        'export interface Question {\n'
        '  /** 原题号 */\n'
        '  id: number\n'
        '  /** 题干 */\n'
        '  q: string\n'
        '  /** 选项 A~D */\n'
        '  o: string[]\n'
        '  /** 正确选项下标 0~3 */\n'
        '  a: number\n'
        '}\n\n'
        'export const questions: Question[] = '
        + json.dumps(compact, ensure_ascii=False, separators=(',', ':'))
        + '\n'
    )
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(ts)
    print(f'OK {len(compact)} questions → {OUT} ({len(ts)//1024}KB)')


if __name__ == '__main__':
    sys.exit(main())
