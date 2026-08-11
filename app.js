/* 明毅洗涤剂报价单生成器 */
(function () {
  'use strict';

  // docxtemplater 浏览器版暴露的全局是小写 window.docxtemplater，这里统一别名
  var Docxtemplater = window.Docxtemplater || window.docxtemplater;

  var DEFAULT_R1 = '此价格含税、含运费（广州从化鳌头镇星业路123号）。';
  var DEFAULT_R3 = '其他约定事项：含托板。未尽事宜，双方友好协商解决。';
  var DEFAULT_SELLER = '广州明毅洗涤用品有限公司';

  var LS = {
    get: function (k, d) {
      try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); }
      catch (e) { return d; }
    },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---------- 大写金额 ---------- */
  function toChineseUpper(n) {
    if (isNaN(n) || n < 0) return '';
    if (n === 0) return '零元整';
    if (n > 999999999999.99) return '金额过大';
    var digits = '零壹贰叁肆伍陆柒捌玖';
    var intUnits = ['', '拾', '佰', '仟'];
    var groupUnits = ['', '万', '亿'];
    var decUnits = ['角', '分'];
    var s = n.toFixed(2);
    var parts = s.split('.');
    var intPart = parts[0];
    var decPart = parts[1];
    var result = '';
    // 整数部分
    var groups = [];
    while (intPart.length > 0) {
      groups.unshift(intPart.slice(-4));
      intPart = intPart.slice(0, -4);
    }
    var intStr = '';
    var zeroPending = false;
    for (var g = 0; g < groups.length; g++) {
      var grp = groups[g];
      var grpStr = '';
      var unitIdx = grp.length - 1;
      var innerZero = false;
      for (var i = 0; i < grp.length; i++) {
        var dgt = parseInt(grp[i], 10);
        if (dgt === 0) {
          innerZero = true;
        } else {
          if (innerZero && grpStr !== '') grpStr += '零';
          innerZero = false;
          grpStr += digits[dgt] + intUnits[unitIdx];
        }
        unitIdx--;
      }
      var gu = groupUnits[groups.length - 1 - g];
      if (grpStr !== '') {
        if (zeroPending) { intStr += '零'; zeroPending = false; }
        intStr += grpStr + gu;
      } else if (intStr !== '') {
        zeroPending = true;
      }
    }
    if (intStr !== '') result = intStr + '元';
    // 小数部分
    var jiao = parseInt(decPart[0], 10);
    var fen = parseInt(decPart[1], 10);
    if (jiao === 0 && fen === 0) {
      result += '整';
    } else {
      if (jiao > 0) {
        if (intStr !== '' && fen === 0) result += digits[jiao] + '角整';
        else result += digits[jiao] + '角';
      } else if (fen > 0) {
        result += '零';
      }
      if (fen > 0) result += digits[fen] + '分';
    }
    return result;
  }

  /* ---------- 工具 ---------- */
  function fmt(n) { return (Math.round(n * 100) / 100).toFixed(2); }
  function fmtDate(d) { return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate(); }
  function fmtDateCn(d) { return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
  function dateStr(d) {
    var m = ('0' + (d.getMonth() + 1)).slice(-2), day = ('0' + d.getDate()).slice(-2);
    return d.getFullYear() + '-' + m + '-' + day;
  }
  function parseDate(v) {
    var d = new Date(v + 'T00:00:00');
    return isNaN(d) ? new Date() : d;
  }

  /* ---------- 状态 ---------- */
  var rows = [{ name: '', unit: '', qty: '', price: '', remark: '' }];

  var $ = function (id) { return document.getElementById(id); };

  /* ---------- 产品行渲染 ---------- */
  function renderRows() {
    var tb = $('tbody');
    tb.innerHTML = '';
    var nameList = LS.get('bq_names', []);
    rows.forEach(function (r, i) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td style="text-align:center">' + (i + 1) + '</td>' +
        '<td><input data-f="name" list="nameList"></td>' +
        '<td><input data-f="unit"></td>' +
        '<td><input data-f="qty" type="number" min="0" step="any"></td>' +
        '<td><input data-f="price" type="number" min="0" step="any"></td>' +
        '<td class="amt"></td>' +
        '<td><input data-f="remark"></td>' +
        '<td class="del-row" title="删除">×</td>';
      var inputs = tr.querySelectorAll('input');
      inputs.forEach(function (inp) {
        var f = inp.getAttribute('data-f');
        inp.value = r[f];
        inp.addEventListener('input', function () {
          r[f] = inp.value;
          recalc();
          updatePreview();
        });
      });
      tr.querySelector('.del-row').addEventListener('click', function () {
        rows.splice(i, 1);
        if (rows.length === 0) rows.push({ name: '', unit: '', qty: '', price: '', remark: '' });
        renderRows(); updatePreview();
      });
      tb.appendChild(tr);
    });
    // 产品名 datalist（全局一个，行内共用）
    var dl = $('nameList');
    if (!dl) {
      dl = document.createElement('datalist');
      dl.id = 'nameList';
      document.body.appendChild(dl);
    }
    dl.innerHTML = '';
    nameList.forEach(function (n) {
      var o = document.createElement('option');
      o.value = n;
      dl.appendChild(o);
    });
    recalc();
  }

  function rowAmount(r) {
    var q = parseFloat(r.qty), p = parseFloat(r.price);
    if (isNaN(q) || isNaN(p)) return 0;
    return q * p;
  }

  function recalc() {
    var trs = $('tbody').querySelectorAll('tr');
    var total = 0;
    rows.forEach(function (r, i) {
      var amt = rowAmount(r);
      total += amt;
      trs[i].querySelector('.amt').textContent = (r.qty !== '' && r.price !== '') ? fmt(amt) : '';
    });
    $('totalNum').textContent = fmt(total);
    $('totalCn').textContent = toChineseUpper(total);
    return total;
  }

  /* ---------- 记忆：报价单位 & 产品名 ---------- */
  function saveMemory() {
    var company = $('company').value.trim();
    if (company) {
      var companies = LS.get('bq_companies', []);
      companies = companies.filter(function (b) { return b !== company; });
      companies.unshift(company);
      LS.set('bq_companies', companies.slice(0, 30));
    }
    var names = LS.get('bq_names', []);
    rows.forEach(function (r) {
      var n = r.name.trim();
      if (n && names.indexOf(n) === -1) names.push(n);
    });
    LS.set('bq_names', names.slice(0, 60));
    LS.set('bq_company', company);
    LS.set('bq_r1', $('r1').value);
    LS.set('bq_r3', $('r3').value);
    renderCompanyList();
  }

  function renderCompanyList() {
    var dl = $('companyList');
    dl.innerHTML = '';
    LS.get('bq_companies', []).forEach(function (b) {
      var o = document.createElement('option');
      o.value = b;
      dl.appendChild(o);
    });
  }

  /* ---------- 预览 ---------- */
  function updatePreview() {
    $('pv-buyer').textContent = $('company').value || '＿＿＿＿＿＿';
    var tb = $('pv-tbody');
    tb.innerHTML = '';
    rows.forEach(function (r, i) {
      if (!r.name && !r.qty && !r.price) return;
      var tr = document.createElement('tr');
      var amt = rowAmount(r);
      tr.innerHTML = '<td>' + (i + 1) + '</td><td>' + esc(r.name) + '</td><td>' + esc(r.unit) +
        '</td><td>' + esc(r.qty) + '</td><td>' + esc(r.price) + '</td><td>' +
        ((r.qty !== '' && r.price !== '') ? fmt(amt) : '') + '</td><td>' + esc(r.remark) + '</td>';
      tb.appendChild(tr);
    });
    var total = recalc();
    $('pv-total').textContent = fmt(total) + '   ' + toChineseUpper(total);
    $('pv-r1').textContent = '1、' + $('r1').value;
    var d1 = parseDate($('d1').value), d2 = parseDate($('d2').value);
    $('pv-dates').textContent = '2、报价时效：报价自' + fmtDate(d1) + '至' + fmtDate(d2) + '有效。';
    $('pv-r3').textContent = '3、' + $('r3').value;
    $('pv-seller').textContent = $('company').value;
    $('pv-date').textContent = fmtDateCn(new Date());
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------- 导出 docx ---------- */
  function b64ToUint8(b64) {
    var bin = atob(b64);
    var u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }

  function downloadBlob(blob, filename) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  }

  function fileDateStr() {
    var d = new Date();
    return '' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2);
  }

  function exportDocx() {
    saveMemory();
    var d1 = parseDate($('d1').value), d2 = parseDate($('d2').value);
    var items = [];
    var total = 0;
    rows.forEach(function (r, i) {
      if (!r.name && !r.qty && !r.price) return;
      var amt = rowAmount(r);
      total += amt;
      items.push({
        idx: items.length + 1,
        name: r.name, unit: r.unit, qty: r.qty, price: r.price,
        amount: fmt(amt), remark: r.remark
      });
    });
    if (items.length === 0) { alert('请至少填写一行产品'); return; }
    try {
      var zip = new PizZip(b64ToUint8(TEMPLATE_B64));
      var doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
      doc.render({
        buyer: $('company').value.trim(),
        seller: $('company').value.trim(),
        d1: fmtDate(d1), d2: fmtDate(d2),
        date: fmtDateCn(new Date()),
        r1: $('r1').value, r3: $('r3').value,
        total: fmt(total), totalCn: toChineseUpper(total),
        items: items
      });
      var blob = doc.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      downloadBlob(blob, '明毅洗涤剂报价单-' + fileDateStr() + '.docx');
    } catch (e) {
      alert('生成失败：' + (e.message || e));
    }
  }

  /* ---------- 导出截图 ---------- */
  function exportPng() {
    var paper = $('paper');
    // 手机端预览默认收起（display:none），截图前临时移到屏外显示，截完还原
    var prev = paper.getAttribute('style') || '';
    // 固定桌面宽度渲染，不受手机横竖屏影响，保证导出效果恒定
    paper.style.cssText += ';display:block !important;position:absolute;left:-9999px;top:0;z-index:-1;width:794px !important;max-width:none !important;';
    html2canvas(paper, { scale: 2, backgroundColor: '#ffffff' }).then(function (canvas) {
      paper.setAttribute('style', prev);
      canvas.toBlob(function (blob) {
        downloadBlob(blob, '明毅洗涤剂报价单-' + fileDateStr() + '.png');
      }, 'image/png');
    }).catch(function (e) {
      paper.setAttribute('style', prev);
      alert('截图失败：' + (e && e.message ? e.message : e));
    });
  }

  /* ---------- 初始化 ---------- */
  function init() {
    var today = new Date();
    var d2 = new Date();
    d2.setDate(d2.getDate() + 3);
    $('d1').value = dateStr(today);
    $('d2').value = dateStr(d2);
    $('company').value = LS.get('bq_company', LS.get('bq_seller', DEFAULT_SELLER));
    $('r1').value = LS.get('bq_r1', DEFAULT_R1);
    $('r3').value = LS.get('bq_r3', DEFAULT_R3);
    renderCompanyList();
    renderRows();

    ['company', 'd1', 'd2', 'r1', 'r3'].forEach(function (id) {
      $(id).addEventListener('input', updatePreview);
    });
    $('addRow').addEventListener('click', function () {
      rows.push({ name: '', unit: '', qty: '', price: '', remark: '' });
      renderRows(); updatePreview();
    });
    $('exportDocx').addEventListener('click', exportDocx);
    $('exportPng').addEventListener('click', exportPng);
    $('togglePreview').addEventListener('click', function () {
      var p = $('previewPanel');
      p.classList.toggle('open');
      this.textContent = p.classList.contains('open') ? '收起预览 ▴' : '展开预览 ▾';
    });
    $('resetAll').addEventListener('click', function () {
      rows = [{ name: '', unit: '', qty: '', price: '', remark: '' }];
      renderRows(); updatePreview();
    });
    updatePreview();
  }

  init();
})();
