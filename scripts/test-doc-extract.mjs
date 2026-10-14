import fs from 'fs'
const buf=fs.readFileSync('电子商务师三级理论试题-80.doc')
const b=new Uint8Array(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength))

// 粗暴法：先按 utf16le 把所有双字节都解出来，再过滤乱码
// 中文正文占大头，里面混杂控制字符就用"窗口滑动"找最稠密段
const all=[]
for(let i=0;i<b.length-1;i+=2){
  const c=b[i]|(b[i+1]<<8)
  all.push(c)
}
// 找出所有"参考答案"出现的位置 → 它们一定在正文里
const hits=[]
for(let i=0;i<all.length-3;i++){
  if(all[i]===0x53c2&&all[i+1]===0x8003&&all[i+2]===0x7b54&&all[i+3]===0x6848){hits.push(i)}
}
console.log('参考答案 hits:',hits.length,'first:',hits[0],'last:',hits[hits.length-1])
// 正文大致范围 = 第一个题号前 ~ 最后一个参考答案后
// 找题号：开头有 "688." 模式
const firstQ=[]
for(let i=0;i<hits[0];i++){
  if(all[i]>=0x30&&all[i]<=0x39){
    let j=i
    let num=''
    while(j<all.length&&all[j]>=0x30&&all[j]<=0x39){num+=String.fromCharCode(all[j]);j++}
    if(all[j]===0x2e&&num.length>=3){firstQ.push({i,num:+num});if(firstQ.length>3)break}
  }
}
console.log('first q candidates:',firstQ)

// 用第一题位置向前找正文起点
if(hits.length&&firstQ.length){
  const start=firstQ[0].i
  const end=hits[hits.length-1]+10
  const text=[]
  for(let i=start;i<end;i++){
    const c=all[i]
    if(c===0x0d||c===0x0a)text.push('\n')
    else if(c>=0x20)text.push(String.fromCharCode(c))
    // 控制字符跳过
  }
  const s=text.join('')
  console.log('=== extracted ===')
  console.log(s.slice(0,600))
  console.log('---tail---')
  console.log(s.slice(-400))
}
