/* 결혼 예산표 → 엑셀(.xlsx) 파일 만들기
   외부 라이브러리 없이 브라우저에서 바로 만들어요. 합계 칸에는 엑셀 수식(SUM 등)이 들어가서,
   엑셀에서 금액을 고치면 합계가 다시 계산돼요. */
(function () {
  /* ── ZIP(압축 없이 저장) ── */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  function zip(files) {
    const enc = new TextEncoder(), parts = [], central = []; let offset = 0;
    const u16 = (v) => [v & 255, (v >>> 8) & 255], u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
    const TIME = 0, DATE = ((2026 - 1980) << 9) | (11 << 5) | 21;
    files.forEach(([name, text]) => {
      const nm = enc.encode(name), data = enc.encode(text), crc = crc32(data);
      const head = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(TIME), u16(DATE), u32(crc), u32(data.length), u32(data.length), u16(nm.length), u16(0));
      parts.push(new Uint8Array(head), nm, data);
      central.push(new Uint8Array([].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(TIME), u16(DATE), u32(crc), u32(data.length), u32(data.length), u16(nm.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset))), nm);
      offset += head.length + nm.length + data.length;
    });
    const cdSize = central.reduce((s, p) => s + p.length, 0);
    const end = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdSize), u32(offset), u16(0)));
    return new Blob(parts.concat(central, [end]), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  /* 스타일 번호: 0 기본, 1 굵게, 2 제목, 3 회색 작은 글씨, 4 표 머리, 5 분류 줄, 6 숫자, 7 굵은 숫자, 8 굵은 숫자(색), 9 테두리 글자 */
  /* 스타일 번호: 0 기본, 1 굵게, 2 제목, 3 회색 작은 글씨, 4 표 머리, 5 분류 줄, 6 숫자, 7 굵은 금액(만 원), 8 강조 금액(만 원), 9 테두리 글자, 10 금액(만 원)
     색은 무난한 회색 계열이에요. 금액 칸은 '5,000만 원'처럼 보이지만 실제 값은 숫자라 계산에 그대로 쓸 수 있어요. */
  const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0&quot;만 원&quot;;-#,##0&quot;만 원&quot;;0&quot;만 원&quot;"/></numFmts>
<fonts count="5"><font><sz val="11"/><color rgb="FF333333"/><name val="맑은 고딕"/><family val="3"/></font><font><b/><sz val="11"/><color rgb="FF333333"/><name val="맑은 고딕"/><family val="3"/></font><font><b/><sz val="16"/><color rgb="FF222222"/><name val="맑은 고딕"/><family val="3"/></font><font><sz val="9"/><color rgb="FF808080"/><name val="맑은 고딕"/><family val="3"/></font><font><b/><sz val="11"/><color rgb="FF404040"/><name val="맑은 고딕"/><family val="3"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF5F5F5"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE7E6E6"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD9D9D9"/></left><right style="thin"><color rgb="FFD9D9D9"/></right><top style="thin"><color rgb="FFD9D9D9"/></top><bottom style="thin"><color rgb="FFD9D9D9"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="11">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="4" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="164" fontId="1" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="164" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  window.WPBudgetXlsx = function (d) {
    const rows = []; // [ [ {v, s, f}, ... ] ]
    const put = (r, cells) => { rows[r] = cells; };
    const S = (v, s) => ({ t: "s", v, s: s || 0 });
    const N = (v, s) => ({ t: "n", v, s: s == null ? 6 : s });
    const F = (f, v, s) => ({ t: "f", f, v, s: s == null ? 7 : s });
    const sum = (a) => a.reduce((x, y) => x + (y || 0), 0);

    put(1, [S("결혼 예산표", 2)]);
    put(2, [S("단위: 만 원 · 웨딩 프로젝트 wedding-project.com/info/budget/", 3)]);
    let r = 12;
    put(r, [S("항목", 4), S("계획 (만 원)", 4), S("실제 쓴 돈 (만 원)", 4), S("메모 (자유롭게 적어요)", 4)]);
    const subRows = [];
    let allB = 0, allA = 0;
    d.groups.forEach((g) => {
      r++; put(r, [S(g.name, 5), S("", 5), S("", 5), S("", 5)]);
      const first = r + 1;
      g.rows.forEach((x) => {
        r++;
        const memo = x.name.indexOf("식대") === 0 && d.mealN && d.mealP ? `보증 인원 ${d.mealN}명 × 1인 ${d.mealP}만 원` : "";
        put(r, [S(x.name, 9), x.b == null ? S("", 10) : N(x.b, 10), x.a == null ? S("", 10) : N(x.a, 10), S(memo, 9)]);
      });
      const last = r, gb = sum(g.rows.map((x) => x.b)), ga = sum(g.rows.map((x) => x.a));
      allB += gb; allA += ga;
      r++; put(r, [S(g.name + " 소계", 1), F(`SUM(B${first}:B${last})`, gb), F(`SUM(C${first}:C${last})`, ga), S("", 9)]);
      subRows.push(r);
    });
    r++; const totalRow = r;
    put(r, [S("합계", 4), F(subRows.map((x) => "B" + x).join("+"), allB, 8), F(subRows.map((x) => "C" + x).join("+"), allA, 8), S("", 9)]);

    const T = (d.saved || 0) + (d.support || 0);
    put(4, [S("두 사람이 모은 돈", 9), N(d.saved || 0, 10)]);
    put(5, [S("부모님 지원", 9), N(d.support || 0, 10)]);
    put(6, [S("총 예산 (모은 돈 + 부모님 지원)", 1), F(`B4+B5`, T, 7)]);
    put(7, [S("[계획] 계획 합계", 9), F(`B${totalRow}`, allB, 10)]);
    put(8, [S("[계획] 계획대로 쓰면 남는 돈 (총 예산 − 계획 합계)", 9), F(`B6-B7`, T - allB, 10)]);
    put(9, [S("[실제] 실제 쓴 돈 합계", 9), F(`C${totalRow}`, allA, 10)]);
    put(10, [S("[실제] 지금 남은 예산 (총 예산 − 실제 쓴 돈)", 1), F(`B6-B9`, T - allA, 8)]);

    const col = (i) => "ABCD"[i];
    let sheetRows = "";
    rows.forEach((cells, ri) => {
      if (!cells) return;
      sheetRows += `<row r="${ri}">` + cells.map((c, ci) => {
        const ref = col(ci) + ri;
        if (c.t === "n") return `<c r="${ref}" s="${c.s}"><v>${c.v}</v></c>`;
        if (c.t === "f") return `<c r="${ref}" s="${c.s}"><f>${c.f}</f><v>${Math.round(c.v * 100) / 100}</v></c>`;
        return c.v === "" ? `<c r="${ref}" s="${c.s}"/>` : `<c r="${ref}" s="${c.s}" t="inlineStr"><is><t xml:space="preserve">${esc(c.v)}</t></is></c>`;
      }).join("") + `</row>`;
    });
    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="12" topLeftCell="A13" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols><col min="1" max="1" width="46" customWidth="1"/><col min="2" max="3" width="15" customWidth="1"/><col min="4" max="4" width="30" customWidth="1"/></cols>
<sheetData>${sheetRows}</sheetData>
<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
    return zip([
      ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
      ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
      ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="결혼 예산표" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`],
      ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
      ["xl/worksheets/sheet1.xml", sheet],
      ["xl/styles.xml", STYLES],
    ]);
  };
})();
