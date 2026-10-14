$word = New-Object -ComObject Word.Application
$word.Visible = $false
$src = "D:\Desktop\share\script\wechat-exam\电子商务师三级理论试题-80.doc"
$out = "D:\Desktop\share\script\wechat-exam\电子商务师三级理论试题-80.docx"
try {
  $doc = $word.Documents.Open($src, $false, $true)
  $doc.SaveAs([ref]$out, [ref]16)  # 16 = wdFormatDocumentDefault (.docx)
  $doc.Close($false)
  Write-Output "saved: $out"
} finally {
  $word.Quit()
}
