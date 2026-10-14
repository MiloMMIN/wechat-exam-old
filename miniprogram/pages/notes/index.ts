// pages/notes/index.ts —— 题库笔记：增删改
import { getActiveBank } from '../../utils/bank-store'
import { getNotes, addNote, removeNote, updateNote, Note } from '../../utils/store'

interface NoteView extends Note { qText: string }

Page({
  data: {
    notes: [] as NoteView[],
    bankId: '',
    draft: '',
    editingId: '',
    editingText: '',
    emptyText: '',
  },

  onShow() {
    const bank = getActiveBank()
    const list = getNotes(bank.id)
    const qmap = new Map(bank.questions.map(q => [q.id, q.q]))
    this.setData({
      bankId: bank.id,
      notes: list.map(n => ({ ...n, qText: n.qid ? (qmap.get(n.qid)?.slice(0, 50) || `题 ${n.qid}`) : '题库笔记' })),
      emptyText: list.length ? '' : '还没有笔记，可在刷题页"✎ 笔记"记，或下方直接添加题库笔记',
    })
  },

  onDraft(e: WechatMiniprogram.Input) { this.setData({ draft: e.detail.value }) },
  addBankNote() {
    const text = this.data.draft.trim()
    if (!text) { wx.showToast({ title: '写点内容', icon: 'none' }); return }
    addNote(this.data.bankId, 0, text)
    this.setData({ draft: '' })
    this.onShow()
  },

  startEdit(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    const n = this.data.notes.find(x => x.id === id)
    if (!n) return
    this.setData({ editingId: id, editingText: n.text })
  },
  onEditInput(e: WechatMiniprogram.Input) { this.setData({ editingText: e.detail.value }) },
  saveEdit() {
    if (!this.data.editingId) return
    updateNote(this.data.editingId, this.data.editingText)
    this.setData({ editingId: '', editingText: '' })
    this.onShow()
  },
  cancelEdit() { this.setData({ editingId: '', editingText: '' }) },

  del(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    wx.showModal({
      title: '删除笔记', content: '确定删除这条笔记？',
      success: r => { if (r.confirm) { removeNote(id); this.onShow() } },
    })
  },
})
