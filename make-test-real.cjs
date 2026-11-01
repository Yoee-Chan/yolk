const {Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell, ImageRun} = require('docx');
const fs = require('fs');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AL+2wUAAAAASUVORK5CYII=', 'base64');
(async () => {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({text: '公众号文章标题', heading: HeadingLevel.HEADING_1}),
        new Paragraph({children: [new TextRun({text: '加粗', bold: true}), new TextRun({text: '普通文本。'})]}),
        new Paragraph({text: '二级标题', heading: HeadingLevel.HEADING_2}),
        new Table({rows: [new TableRow({children: [new TableCell({children: [new Paragraph('单元格')]})]})]}),
        new Paragraph({children: [new ImageRun({data: png, transformation: {width: 10, height: 10}, type: 'png'})]}),
      ],
    }],
  });
  fs.writeFileSync('test-real.docx', await Packer.toBuffer(doc));
  console.log('ok');
})();
