const OPT_RE=/^([A-F])\s*[、.．：:]\s*(.+)$/
const OPT_BARE_RE=/^([A-F])\s+(.+)$/
const ANS_RE=/【参考答案】\s*([A-F])/
const ANS_RE2=/^(?:参考答案|答案|答)\s*[:：]?\s*([A-F])\s*$/
const Q_RE=/^(?:第\s*)?(\d+)\s*[题\.、．]\s*(.+)$/
function cleanStem(s){return s.replace(/[ 　​]/g,'').replace(/\s+/g,' ').trim()}

function parseText(input){
  const warnings=[];const questions=[]
  const raw0=input.split(/\r?\n/).map(l=>l.trim())
  const rawLines=[]
  for(let i=0;i<raw0.length;i++){
    const l=raw0[i];if(!l)continue
    if(/^[A-F][、.．：:]?\s*$/.test(l)&&i+1<raw0.length&&raw0[i+1]){rawLines.push(l+raw0[++i].trim());continue}
    rawLines.push(l)
  }
  const blocks=[];let cur=null
  for(const l of rawLines){const m=Q_RE.exec(l);if(m){cur={no:+m[1],first:m[2],rest:[]};blocks.push(cur)}else if(cur)cur.rest.push(l)}
  for(const b of blocks){
    const seg=[b.first,...b.rest].join('\n')
    const ansMatch=ANS_RE.exec(seg)||/(?:参考答案|答案|答)\s*[:：]?\s*([A-F])\s*$/.exec(seg)
    const answer=ansMatch?ansMatch[1]:''
    const firstOptM=/(?:^|\n)\s*([A-F])\s*[、.．：:]\s*/.exec(seg)
    if(!firstOptM){warnings.push('no opt: '+seg.slice(0,30));continue}
    const stemEnd=firstOptM.index+(firstOptM[0].startsWith('\n')?1:0)
    const stem=cleanStem(seg.slice(0,stemEnd))
    const ansStart=ansMatch?ansMatch.index:seg.length
    const optSeg=seg.slice(stemEnd,ansStart)
    const opts={}
    const optRe=/([A-F])\s*[、.．：:]\s*/g
    const marks=[]
    let mm
    while((mm=optRe.exec(optSeg))!==null)marks.push({letter:mm[1],start:mm.index,end:mm.index+mm[0].length})
    for(let i=0;i<marks.length;i++){const c=marks[i];const nx=i+1<marks.length?marks[i+1].start:optSeg.length;opts[c.letter]=optSeg.slice(c.end,nx).trim().replace(/\s+/g,' ')}
    const optList=['A','B','C','D','E','F'].map(l=>opts[l]||'')
    while(optList.length&&!optList[optList.length-1])optList.pop()
    if(!stem||optList.length<2||!answer||!opts[answer]){warnings.push('bad:'+stem.slice(0,30));continue}
    questions.push({id:b.no,q:stem,o:optList,a:'ABCDEF'.indexOf(answer)})
  }
  return{questions,warnings}
}

// 案例 1: doc 黏行
const t1=`688.所谓职业，从社会的角度而言，是指人们为了谋生和发展而从事相对稳定、合法、（ ）、专门类别的社会活动。
A、有报酬B、无报酬C、零报酬D、无所谓【参考答案】A
689.电子商务师是指在互联网及现代信息技术平台上，从事（ ）的人员。
A、商品买卖B、商品交易C、商务交易D、商务活动
【参考答案】D`
console.log('=== 黏行 ===')
console.log(JSON.stringify(parseText(t1),null,1))

// 案例 2: 分行格式
const t2=`688.所谓职业
A、有报酬
B、无报酬
C、零报酬
D、无所谓
【参考答案】A`
console.log('=== 分行 ===')
console.log(JSON.stringify(parseText(t2),null,1))
