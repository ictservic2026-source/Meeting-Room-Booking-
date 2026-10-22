// ==========================================================
// 🏢 ระบบจองห้องประชุม - Shared JavaScript (v4.3.2)
// ใช้ร่วมกันระหว่าง index.html และ admin.html
// v4.3: ปฏิทินเลือกวันแบบ DD/MM/YYYY ทุกเครื่อง · แก้ไขรายการหน้าเดียว
//       (วัน เวลา ห้อง สลับ/บังคับย้าย ผู้จอง อุปกรณ์) · ประวัติและเหตุผลการแก้ไข
// ==========================================================

// ==========================================================
// ⚙️ CONFIG
// ==========================================================
const API_URL = "https://script.google.com/macros/s/AKfycbw2njcskR2L7ZjZYwSm0_YU1LEkukngXXnCwjR7a6Naw2DuJ-zZ1vWg_mcTKdurfTKa/exec";

// ==========================================================
// 🛠️ SHARED UTILITIES (ใช้ร่วมกันทั้ง 2 หน้า)
// ==========================================================

/** ย่อ document.getElementById */
function $(id) { return document.getElementById(id); }

/** เรียก API (POST) */
async function callAPI(payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

/** เรียก API (GET) */
async function callAPIget(params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API_URL}?${qs}`);
  return res.json();
}

/** แสดง Alert ที่มุมบน */
function showAlert(type, message, duration = 5000) {
  const box = $('alertBox');
  if (!box) return;
  box.className = 'alert ' + type;
  box.textContent = message;
  box.style.display = 'block';
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (duration > 0) {
    setTimeout(() => { box.style.display = 'none'; }, duration);
  }
}

/** แปลงวันที่ YYYY-MM-DD → DD/MM/YYYY */
function formatThaiDate(dateStr) {
  if (!dateStr) return '-';
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/** ป้องกัน XSS เวลาจะแสดงข้อความ */
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** วันที่ (เวลาเครื่อง) → YYYY-MM-DD — ไม่ใช้ toISOString() เพราะเป็น UTC (ก่อน 07:00 จะได้วันของเมื่อวาน) */
function isoOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** วันนี้ในรูปแบบ YYYY-MM-DD */
function todayStr() { return isoOf(new Date()); }

/** หน่วงการเรียกฟังก์ชัน (ใช้กับช่องค้นหา ลดจำนวนครั้งที่ re-render) */
function debounce(fn, wait = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// ==========================================================
// 🕐 TIME PICKER (Dropdown ชั่วโมง/นาที แทน <input type="time">)
//    เดิมใช้ <input type="time"> ซึ่งบางเบราว์เซอร์/บางเครื่อง (โดยเฉพาะมือถือ
//    ที่ตั้ง locale เป็น 12 ชม.) จะแสดงเป็น AM/PM ทำให้กรอกเวลาผิดพลาดได้
//    เปลี่ยนมาใช้ <select> คู่ (ชั่วโมง 00-23 / นาที 00-59) เพื่อบังคับรูปแบบ
//    24 ชั่วโมงให้เหมือนกันทุกเครื่องเสมอ
// ==========================================================

/**
 * สร้าง HTML dropdown เลือกเวลา — prefix ใช้ตั้งชื่อ id (เช่น "startTime" → #startTimeHour, #startTimeMin)
 * opts (ไม่ใส่ก็ได้ — ค่าเริ่มต้นคือช่วงเต็มวัน 00-23 / นาทีทีละ 1):
 *   hourStart, hourEnd  — จำกัดช่วงชั่วโมงที่เลือกได้ (เช่น 6, 18 → เลือกได้แค่ 06-18)
 *   minuteStep          — ระยะห่างของตัวเลือกนาที (เช่น 5 → 00,05,10,...,55)
 */
function timeSelectHTML(prefix, value, opts) {
  opts = opts || {};
  const hourStart = opts.hourStart != null ? opts.hourStart : 0;
  const hourEnd = opts.hourEnd != null ? opts.hourEnd : 23;
  const minuteStep = opts.minuteStep || 1;

  const parts = String(value || '').split(':');
  const h = parts[0] || '', m = parts[1] || '';

  const hours = Array.from({ length: hourEnd - hourStart + 1 }, (_, i) => String(hourStart + i).padStart(2, '0'));
  const mins = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => String(i * minuteStep).padStart(2, '0'));
  // ค่าเดิมที่อยู่นอกช่วง/ไม่ตรงขั้น (เช่น 08:07 จากข้อมูลเก่า) ต้องยังเลือกอยู่ ไม่อย่างนั้นบันทึกแล้วเวลาหาย
  if (/^\d{2}$/.test(h) && !hours.includes(h)) { hours.push(h); hours.sort(); }
  if (/^\d{2}$/.test(m) && !mins.includes(m)) { mins.push(m); mins.sort(); }

  const hourOpts = ['<option value="">--</option>'].concat(
    hours.map(hh => `<option value="${hh}"${hh === h ? ' selected' : ''}>${hh}</option>`)
  ).join('');

  const minOpts = ['<option value="">--</option>'].concat(
    mins.map(mm => `<option value="${mm}"${mm === m ? ' selected' : ''}>${mm}</option>`)
  ).join('');

  const hourLabel = `ชั่วโมง (${String(hourStart).padStart(2, '0')}-${String(hourEnd).padStart(2, '0')})`;
  const minLabel = minuteStep > 1 ? `นาที (ทีละ ${minuteStep})` : 'นาที (00-59)';

  return `
    <div class="time-select">
      <select id="${prefix}Hour" aria-label="${hourLabel}">${hourOpts}</select>
      <span class="time-sep">:</span>
      <select id="${prefix}Min" aria-label="${minLabel}">${minOpts}</select>
      <span class="time-suffix">น.</span>
    </div>`;
}

/** อ่านค่าเวลาจาก dropdown → "HH:mm" (คืนค่าว่างถ้ายังเลือกไม่ครบทั้งชั่วโมงและนาที) */
function getTimeValue(prefix) {
  const h = $(prefix + 'Hour'), m = $(prefix + 'Min');
  if (!h || !m || !h.value || !m.value) return '';
  return `${h.value}:${m.value}`;
}

/** ตั้งค่า dropdown เวลาจากสตริง "HH:mm" */
function setTimeValue(prefix, hhmm) {
  const parts = String(hhmm || '').split(':');
  if ($(prefix + 'Hour')) $(prefix + 'Hour').value = parts[0] || '';
  if ($(prefix + 'Min'))  $(prefix + 'Min').value  = parts[1] || '';
}

// ==========================================================
// 📅 DATE PICKER — ปฏิทินเลือกวันของระบบเอง แสดง DD/MM/YYYY ทุกเครื่อง
//    <input type="date"> แสดงรูปแบบตามภาษาของเครื่อง (บางเครื่องเป็น MM/DD/YYYY)
//    จึงแทนด้วยปุ่ม + ปฏิทิน ส่วนค่าจริงเก็บใน <input type="hidden" id="..."> เป็น YYYY-MM-DD
//    โค้ดเดิมที่อ่าน $(id).value จึงทำงานเหมือนเดิม
// ==========================================================
const DatePicker = {
  MONTHS: ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
           'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'],
  DOW: ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'],
  opts: {},          // id → { min, clearable, placeholder }
  state: null,       // { id, y, m } ของปฏิทินที่เปิดอยู่
  pop: null,

  /** HTML ของช่องวันที่ — iso = ค่าเริ่มต้น "YYYY-MM-DD" หรือ '' */
  html(id, iso, opts) {
    this.opts[id] = opts || {};
    const ph = this.opts[id].placeholder || 'วว/ดด/ปปปป';
    return `<span class="dp">` +
      `<input type="hidden" id="${id}" value="${escapeHtml(iso || '')}">` +
      `<button type="button" class="dp-btn${iso ? '' : ' dp-empty'}" id="${id}Btn" data-dp="${id}" aria-haspopup="dialog">` +
      `<span class="dp-text">${iso ? formatThaiDate(iso) : ph}</span>` +
      `<svg class="dp-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>` +
      `</button></span>`;
  },

  /** ใส่ช่องวันที่ลงใน element ที่มีอยู่ */
  mount(wrapId, id, iso, opts) { $(wrapId).innerHTML = this.html(id, iso, opts); },

  get(id) { const el = $(id); return el ? el.value : ''; },

  /** ตั้งค่า (fire = true จะยิง change ให้โค้ดที่ฟังอยู่ทำงานต่อ) */
  set(id, iso, fire) {
    const el = $(id), btn = $(id + 'Btn');
    if (!el) return;
    el.value = iso || '';
    if (btn) {
      btn.querySelector('.dp-text').textContent = iso ? formatThaiDate(iso) : ((this.opts[id] || {}).placeholder || 'วว/ดด/ปปปป');
      btn.classList.toggle('dp-empty', !iso);
    }
    if (fire) el.dispatchEvent(new Event('change', { bubbles: true }));
  },

  setDisabled(id, disabled) { const b = $(id + 'Btn'); if (b) b.disabled = !!disabled; },

  open(id) {
    const cur = this.get(id) || this.opts[id].min || todayStr();
    const [y, m] = cur.split('-').map(Number);
    this.state = { id, y, m: m - 1 };
    if (!this.pop) {
      this.pop = document.createElement('div');
      this.pop.className = 'dp-pop';
      this.pop.setAttribute('role', 'dialog');
      this.pop.setAttribute('aria-label', 'เลือกวันที่');
      document.body.appendChild(this.pop);
      this.pop.addEventListener('click', e => this.onPopClick(e));
    }
    this.render();
    this.pop.classList.add('show');
    this.position();
    const focusBtn = this.pop.querySelector('.dp-day.sel') || this.pop.querySelector('.dp-day.today') || this.pop.querySelector('.dp-day:not([disabled])');
    if (focusBtn) focusBtn.focus({ preventScroll: true });
  },

  close(returnFocus) {
    if (!this.pop || !this.state) return;
    const id = this.state.id;
    this.pop.classList.remove('show');
    this.state = null;
    if (returnFocus && $(id + 'Btn')) $(id + 'Btn').focus();
  },

  position() {
    const btn = $(this.state.id + 'Btn');
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const w = this.pop.offsetWidth, h = this.pop.offsetHeight;
    let left = Math.min(r.left, window.innerWidth - w - 8);
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    this.pop.style.left = Math.max(8, left) + 'px';
    this.pop.style.top = top + 'px';
  },

  render() {
    const { id, y, m } = this.state;
    const o = this.opts[id] || {};
    const sel = this.get(id), today = todayStr();
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const minMonth = o.min ? o.min.slice(0, 7) : null;
    const thisMonth = `${y}-${String(m + 1).padStart(2, '0')}`;

    let cells = '';
    for (let i = 0; i < first; i++) cells += '<span></span>';
    for (let d = 1; d <= days; d++) {
      const iso = `${thisMonth}-${String(d).padStart(2, '0')}`;
      const dis = o.min && iso < o.min;
      const cls = ['dp-day', iso === sel ? 'sel' : '', iso === today ? 'today' : ''].join(' ').trim();
      cells += `<button type="button" class="${cls}" data-iso="${iso}"${dis ? ' disabled' : ''} aria-label="${d} ${this.MONTHS[m]} ${y}"${iso === sel ? ' aria-pressed="true"' : ''}>${d}</button>`;
    }

    const canToday = !o.min || today >= o.min;
    this.pop.innerHTML = `
      <div class="dp-head">
        <button type="button" class="dp-nav" data-nav="-1" aria-label="เดือนก่อน"${minMonth && thisMonth <= minMonth ? ' disabled' : ''}>‹</button>
        <span class="dp-title">${this.MONTHS[m]} ${y}</span>
        <button type="button" class="dp-nav" data-nav="1" aria-label="เดือนถัดไป">›</button>
      </div>
      <div class="dp-grid">${this.DOW.map(w => `<span class="dp-dow">${w}</span>`).join('')}${cells}</div>
      <div class="dp-foot">
        ${canToday ? '<button type="button" class="dp-link" data-act="today">วันนี้</button>' : '<span></span>'}
        ${o.clearable ? '<button type="button" class="dp-link" data-act="clear">ล้าง</button>' : ''}
      </div>`;
  },

  onPopClick(e) {
    e.stopPropagation();
    const t = e.target.closest('button');
    if (!t || t.disabled || !this.state) return;
    if (t.dataset.nav) {
      let { y, m } = this.state;
      m += Number(t.dataset.nav);
      if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
      this.state.y = y; this.state.m = m;
      this.render();
      return;
    }
    const id = this.state.id;
    if (t.dataset.iso) { this.set(id, t.dataset.iso, true); this.close(true); }
    else if (t.dataset.act === 'today') { this.set(id, todayStr(), true); this.close(true); }
    else if (t.dataset.act === 'clear') { this.set(id, '', true); this.close(true); }
  },

  /** ผูกครั้งเดียวทั้งหน้า (ใช้ event delegation จึงรองรับช่องที่สร้างใหม่ใน modal ด้วย) */
  init() {
    document.addEventListener('click', e => {
      const btn = e.target.closest('.dp-btn');
      if (btn && !btn.disabled) {
        const id = btn.dataset.dp;
        if (this.state && this.state.id === id) this.close(); else this.open(id);
        return;
      }
      if (this.state && this.pop && !this.pop.contains(e.target)) this.close();
    });
    // Esc ปิดปฏิทินก่อน (ไม่ให้ปิดหน้าต่าง modal ไปพร้อมกัน)
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.state) { e.stopImmediatePropagation(); this.close(true); }
    }, true);
    window.addEventListener('resize', () => { if (this.state) this.position(); });
    // เลื่อนหน้า/หน้าต่าง → ให้ปฏิทินเลื่อนตามช่องวันที่ (ไม่ปิดทิ้ง กันปิดเองบนมือถือ)
    document.addEventListener('scroll', () => { if (this.state) this.position(); }, true);
  }
};

// ==========================================================
// 📄 INDEX PAGE — หน้าจอง (พนักงาน)
// ==========================================================
const IndexPage = {
  state: { rooms: [] },

  async init() {
    // ปฏิทินเลือกวัน (DD/MM/YYYY ทุกเครื่อง) — เลือกย้อนหลังไม่ได้ ตั้งต้นเป็นวันนี้
    DatePicker.mount('dateWrap', 'date', todayStr(), { min: todayStr() });
    $('todayLabel').textContent = 'วันที่ ' + formatThaiDate(todayStr());

    // สร้าง dropdown เวลาเริ่ม-สิ้นสุด (แทน <input type="time"> เดิม)
    // จำกัดช่วงเวลาทำการ 06:00-18:00 นาทีเลือกได้ทีละ 5 นาที และตั้งเวลาเริ่มต้นเป็น 08:00 ไว้ล่วงหน้า
    const TIME_OPTS = { hourStart: 6, hourEnd: 18, minuteStep: 5 };
    $('startTimeWrap').innerHTML = timeSelectHTML('startTime', '08:00', TIME_OPTS);
    $('endTimeWrap').innerHTML = timeSelectHTML('endTime', '', TIME_OPTS);

    // ผูก event
    $('date').addEventListener('change', () => {
      this.checkAvailability();
      this.refreshRoomDots();
    });
    $('otherCheck').addEventListener('change', function() {
      $('otherEquipment').style.display = this.checked ? 'block' : 'none';
    });
    $('bookingForm').addEventListener('submit', e => {
      e.preventDefault();
      this.submit(e);
    });

    // โหลดรายชื่อห้อง แล้วค่อยเช็คสถานะวันนี้
    await this.loadRooms();
    this.refreshRoomDots();
  },

  /** โหลดรายชื่อห้องจาก API */
  async loadRooms() {
    try {
      const json = await callAPIget({ action: 'rooms.list' });
      if (!json.success) throw new Error(json.message);

      this.state.rooms = json.data.rooms;

      const container = $('roomList');
      container.innerHTML = this.state.rooms.map(r => `
        <label class="room-card" data-room="${escapeHtml(r.name)}">
          <input type="radio" name="room" value="${escapeHtml(r.name)}" required>
          <span class="room-card-text">
            <span class="room-name">${escapeHtml(r.name)}</span>
            <span class="room-capacity">${r.capacity} ที่นั่ง</span>
          </span>
          <span class="room-dot" data-status="unknown"></span>
        </label>
      `).join('');

      container.querySelectorAll('input[name="room"]').forEach(r => {
        r.addEventListener('change', () => this.checkAvailability());
      });
    } catch (err) {
      showAlert('error', 'โหลดรายชื่อห้องไม่สำเร็จ: ' + err.message);
    }
  },

  /** อัปเดตจุดสถานะ (ว่าง/ไม่ว่าง) บนการ์ดห้องทุกห้อง ตามวันที่เลือก */
  async refreshRoomDots() {
    const date = $('date').value;
    if (!date) return;
    try {
      const json = await callAPIget({ action: 'rooms.availability', date });
      if (!json.success) return;

      Object.entries(json.data.rooms).forEach(([name, info]) => {
        const card = document.querySelector(`.room-card[data-room="${CSS.escape(name)}"]`);
        if (!card) return;
        const dot = card.querySelector('.room-dot');
        dot.dataset.status = info.available ? 'available' : 'busy';
        dot.title = info.available ? 'ว่างทั้งวัน' : 'มีรายการจองในวันนี้';
      });
    } catch (err) {
      console.warn('โหลดสถานะห้องไม่สำเร็จ', err);
    }
  },

  /** ตรวจห้องว่างของห้องที่เลือกอยู่ (แบบละเอียด) */
  async checkAvailability() {
    const date = $('date').value;
    const room = document.querySelector('input[name="room"]:checked');
    const info = $('bookingInfo');
    const list = $('bookingList');

    if (!date || !room) { info.style.display = 'none'; return; }

    list.innerHTML = '<li>กำลังโหลด...</li>';
    info.style.display = 'block';

    try {
      const json = await callAPIget({
        action: 'bookings.list',
        date: date,
        room: room.value
      });
      if (!json.success) throw new Error(json.message);

      const active = json.data.data.filter(b =>
        b.status === 'ยืนยันแล้ว' || b.status === 'รออนุมัติ'
      );

      if (active.length === 0) {
        list.innerHTML = '<li style="color:var(--available);">ห้องว่าง ไม่มีรายการจองในวันนี้</li>';
      } else {
        list.innerHTML = active.map(b => `
          <li>
            <strong>${escapeHtml(b.startTime)} - ${escapeHtml(b.endTime)} น.</strong>
            โดย ${escapeHtml(b.userName)} (${escapeHtml(b.department)})
            <span style="color:${b.status === 'ยืนยันแล้ว' ? 'var(--done)' : 'var(--pending)'};">
              [${escapeHtml(b.status)}]
            </span>
          </li>
        `).join('');
      }
    } catch (err) {
      list.innerHTML = `<li style="color:var(--busy);">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(err.message)}</li>`;
    }
  },

  /** ส่งฟอร์มจอง */
  async submit(e) {
    const purpose = document.querySelector('input[name="purpose"]:checked');
    const room = document.querySelector('input[name="room"]:checked');
    const startTime = getTimeValue('startTime');
    const endTime = getTimeValue('endTime');

    if (!DatePicker.get('date')) { showAlert('error', 'กรุณาเลือกวันที่ต้องการใช้'); return; }
    if (!purpose) { showAlert('error', 'กรุณาเลือกวัตถุประสงค์'); return; }
    if (!room)    { showAlert('error', 'กรุณาเลือกห้องประชุม'); return; }
    if (!startTime || !endTime) {
      showAlert('error', 'กรุณาเลือกเวลาเริ่มต้น-สิ้นสุดให้ครบ'); return;
    }
    if (startTime >= endTime) {
      showAlert('error', 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น'); return;
    }

    const equipment = Array.from(document.querySelectorAll('input[name="equipment"]:checked'))
      .map(cb => cb.value);
    const other = $('otherEquipment').value.trim();
    if ($('otherCheck').checked && other) equipment.push("อื่นๆ: " + other);

    const payload = {
      action: 'bookings.create',
      date: $('date').value,
      startTime: startTime,
      endTime: endTime,
      userName: $('userName').value.trim(),
      department: $('department').value.trim(),
      requesterEmail: $('requesterEmail').value.trim(),
      purpose: purpose.value,
      attendees: parseInt($('attendees').value, 10),
      room: room.value,
      equipment: equipment,
      otherEquipment: other
    };

    const btn = $('submitBtn');
    btn.disabled = true;
    btn.textContent = 'กำลังบันทึก...';

    try {
      const json = await callAPI(payload);

      if (json.success) {
        showAlert('success', `จองสำเร็จ! รหัส: ${json.data.id}`);
        e.target.reset();
        DatePicker.set('date', todayStr());
        setTimeValue('startTime', '08:00');
        $('bookingInfo').style.display = 'none';
        $('otherEquipment').style.display = 'none';
        this.refreshRoomDots();
      } else {
        const detail = json.error?.details?.message || '';
        showAlert('error', json.message + (detail ? ' — ' + detail : ''));
      }
    } catch (err) {
      showAlert('error', 'เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'ส่งคำขอจองห้องประชุม';
    }
  }
};

// ==========================================================
// 🔐 ADMIN AUTH — เก็บ session ของผู้ดูแลไว้ใน sessionStorage
//    (แก้ช่องโหว่เดิมที่หน้า admin ไม่มีการยืนยันตัวตนเลย)
// ==========================================================
const AdminAuth = {
  KEY_STORAGE: 'mrAdminKey',
  NAME_STORAGE: 'mrAdminName',

  get key() { return sessionStorage.getItem(this.KEY_STORAGE) || ''; },
  get name() { return sessionStorage.getItem(this.NAME_STORAGE) || 'ผู้ดูแลระบบ'; },
  get isSet() { return !!this.key; },

  set(key, name) {
    sessionStorage.setItem(this.KEY_STORAGE, key);
    sessionStorage.setItem(this.NAME_STORAGE, name || 'ผู้ดูแลระบบ');
  },
  clear() {
    sessionStorage.removeItem(this.KEY_STORAGE);
    sessionStorage.removeItem(this.NAME_STORAGE);
  },

  /** แสดงหน้าล็อกอิน ซ่อน dashboard */
  showGate(errorMsg) {
    $('authGate').style.display = 'flex';
    $('mainContainer').style.display = 'none';
    $('authError').textContent = errorMsg || '';
    $('authKey').value = '';
    $('authKey').focus();
  },

  /** ซ่อนหน้าล็อกอิน แสดง dashboard */
  hideGate() {
    $('authGate').style.display = 'none';
    $('mainContainer').style.display = 'block';
    $('adminWho').textContent = this.name;
  },

  bindGate() {
    const submit = () => {
      const key = $('authKey').value.trim();
      const name = $('authName').value.trim();
      if (!key) { $('authError').textContent = 'กรุณากรอกรหัสผ่าน'; return; }
      this.set(key, name);
      this.hideGate();
      AdminPage.init();
    };
    $('authSubmit').addEventListener('click', submit);
    $('authKey').addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    $('authName').addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });

    $('logoutBtn').addEventListener('click', () => {
      this.clear();
      this.showGate();
    });
  }
};

// ==========================================================
// 🛡️ ADMIN PAGE — หน้าจัดการ (PR)
// ==========================================================
const AdminPage = {
  state: { bookings: [], rooms: [] },
  // ✅ ใหม่ (v4.2): จำนวนรายการ/หน้า (ตั้งต้น 10), หน้าปัจจุบัน, และแถวที่กำลังขยายเมนู "⋯" อยู่
  page: 1,
  pageSize: 10,
  expandedId: null,

  STATUS_LIST: ['รออนุมัติ', 'ยืนยันแล้ว', '__done', 'ยกเลิก'],
  STATUS_LABEL: { 'รออนุมัติ': 'รออนุมัติ', 'ยืนยันแล้ว': 'ยืนยันแล้ว', '__done': 'เสร็จแล้ว', 'ยกเลิก': 'ยกเลิก' },

  /** เสร็จแล้ว = "เสร็จสิ้น" หรือ "เสร็จก่อนเวลา" */
  isDone(status) { return status === 'เสร็จสิ้น' || status === 'เสร็จก่อนเวลา'; },

  async init() {
    this.renderStatusChips();
    await this.loadData();
  },

  /** โหลดข้อมูลทั้งหมด (ใช้ตอนเปิดหน้า/กดรีเฟรชเท่านั้น — action อื่นๆ ใช้ optimistic update แทน) */
  async loadData() {
    try {
      // โหลดรายชื่อห้อง
      const roomJson = await callAPIget({ action: 'rooms.list' });
      if (roomJson.success) {
        this.state.rooms = roomJson.data.rooms;
        const current = $('filterRoom').value;
        $('filterRoom').innerHTML = '<option value="">-- ทุกห้อง --</option>' +
          this.state.rooms.map(r =>
            `<option value="${escapeHtml(r.name)}">${escapeHtml(r.name)}</option>`
          ).join('');
        $('filterRoom').value = current;
        this.renderRoomChips();
      }

      // โหลดรายการจองทั้งหมด วนทีละหน้า (หน้าละ 200) — ไม่ตกหล่นเมื่อมีเกิน 200 รายการ
      // ใช้ bookings.listAdmin (ต้องมีรหัสผู้ดูแล) → ได้อีเมลผู้แจ้งด้วย และรหัสผิดจะรู้ตั้งแต่ตอนล็อกอิน
      const all = [];
      let page = 1, totalPages = 1;
      do {
        const json = await callAPI({
          action: 'bookings.listAdmin', limit: 200, page, apiKey: AdminAuth.key
        });
        if (!json.success) {
          if (json.error?.code === 'UNAUTHORIZED') {
            AdminAuth.clear();
            AdminAuth.showGate('รหัสผ่านไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่');
            return;
          }
          throw new Error(json.message);
        }
        all.push(...json.data.data);
        totalPages = json.data.pagination.totalPages;
        page++;
      } while (page <= totalPages);

      this.state.bookings = all;
      this.renderStatsFromState();
      this.renderTable();
    } catch (err) {
      showAlert('error', 'โหลดข้อมูลไม่สำเร็จ: ' + err.message);
    }
  },

  /** นับจำนวนตามสถานะ */
  countByStatus(list) {
    const c = { 'รออนุมัติ': 0, 'ยืนยันแล้ว': 0, 'เสร็จสิ้น': 0, 'เสร็จก่อนเวลา': 0, 'ยกเลิก': 0 };
    list.forEach(x => { if (x.status in c) c[x.status]++; });
    return c;
  },

  /** คำนวณสถิติจากข้อมูลในเครื่อง (ไม่ยิง API ซ้ำ) */
  renderStatsFromState() {
    const b = this.state.bookings;
    const c = this.countByStatus(b);
    const today = todayStr();
    $('statTotal').textContent = b.length;
    $('statPending').textContent = c['รออนุมัติ'];
    $('statConfirmed').textContent = c['ยืนยันแล้ว'];
    $('statCompleted').textContent = c['เสร็จสิ้น'] + c['เสร็จก่อนเวลา'];
    $('statCancelled').textContent = c['ยกเลิก'];
    $('statToday').textContent = b.filter(x => x.status !== 'ยกเลิก' && x.date === today).length;
  },

  /** รายการหลังกรองตามตัวกรองปัจจุบัน (ใช้ทั้งตารางและ Export) */
  getFiltered() {
    const st = $('filterStatus').value;
    const rm = $('filterRoom').value;
    const dt = $('filterDate').value;
    const kw = $('searchBox').value.trim().toLowerCase();

    return this.state.bookings.filter(b => {
      const mSt = !st || (st === '__done' ? this.isDone(b.status) : b.status === st);
      const mRm = !rm || b.room === rm;
      const mDt = !dt || b.date === dt;
      const mKw = !kw ||
        (b.userName || '').toLowerCase().includes(kw) ||
        (b.department || '').toLowerCase().includes(kw) ||
        (b.requesterEmail || '').toLowerCase().includes(kw) ||
        (b.room || '').toLowerCase().includes(kw);
      return mSt && mRm && mDt && mKw;
    });
  },

  /** ตาราง */
  renderTable() {
    const filtered = this.getFiltered();
    this.renderResultBar(filtered);
    this.syncStatCards();
    this.syncFilterChips();
    this.renderPager(filtered.length);

    const tbody = $('tableBody');
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--ink-faint);">ไม่มีรายการ</td></tr>';
      return;
    }

    const start = this.pageSize === Infinity ? 0 : (this.page - 1) * this.pageSize;
    const end = this.pageSize === Infinity ? filtered.length : start + this.pageSize;
    const pageRows = filtered.slice(start, end);

    tbody.innerHTML = pageRows.map(b => this.renderRow(b)).join('');
  },

  /** แถบสรุปเหนือตาราง: แสดงกี่รายการ / เสร็จแล้วกี่รายการ (นับตามตัวกรองที่เลือกอยู่) */
  renderResultBar(filtered) {
    const c = this.countByStatus(filtered);
    const done = c['เสร็จสิ้น'] + c['เสร็จก่อนเวลา'];
    const start = this.pageSize === Infinity ? 0 : (this.page - 1) * this.pageSize;
    const end = this.pageSize === Infinity ? filtered.length : Math.min(filtered.length, start + this.pageSize);
    const rangeText = filtered.length === 0 ? '' : `(${start + 1}-${end}) `;
    $('resultCounts').innerHTML = `
      <span>แสดง ${rangeText}<b>${filtered.length}</b> จาก ${this.state.bookings.length} รายการ</span>
      <span class="count-chip done">เสร็จแล้ว ${done}</span>
      <span class="count-chip">รออนุมัติ ${c['รออนุมัติ']}</span>
      <span class="count-chip">ยืนยันแล้ว ${c['ยืนยันแล้ว']}</span>
      <span class="count-chip">ยกเลิก ${c['ยกเลิก']}</span>
    `;
  },

  /** กดการ์ดสถิติ = กรองตารางตามสถานะนั้น (กดซ้ำเพื่อยกเลิกตัวกรอง) */
  bindStatCards() {
    document.querySelectorAll('.stat-card').forEach(card => {
      card.addEventListener('click', () => {
        const f = card.dataset.filter;
        if (f === '') {
          this.clearFilters();
          return;
        }
        if (f === '__today') {
          DatePicker.set('filterDate', $('filterDate').value === todayStr() ? '' : todayStr());
        } else {
          $('filterStatus').value = $('filterStatus').value === f ? '' : f;
        }
        this.page = 1;
        this.renderTable();
      });
    });
  },

  /** ไฮไลต์การ์ดสถิติที่ตรงกับตัวกรองปัจจุบัน */
  syncStatCards() {
    const st = $('filterStatus').value;
    const isToday = $('filterDate').value === todayStr();
    document.querySelectorAll('.stat-card').forEach(card => {
      const f = card.dataset.filter;
      const active = f === '__today' ? isToday : f === '' ? (st === '' && !isToday) : f === st;
      card.classList.toggle('active', active);
    });
  },

  // ---- ตัวกรองแบบ chip (v4.2) — เขียนค่าลง select ที่ซ่อนไว้ เพื่อให้ getFiltered() เดิมทำงานเหมือนเดิม ----

  renderStatusChips() {
    $('statusChips').innerHTML = this.STATUS_LIST.map(v =>
      `<button type="button" class="filter-chip" data-val="${v}" onclick="AdminPage.toggleStatusChip('${v}')">${this.STATUS_LABEL[v]}</button>`
    ).join('') + `<button type="button" class="filter-chip" data-val="" onclick="AdminPage.toggleStatusChip('')">ทั้งหมด</button>`;
  },

  renderRoomChips() {
    $('roomChips').innerHTML =
      `<button type="button" class="filter-chip" data-val="" onclick="AdminPage.toggleRoomChip('')">ทุกห้อง</button>` +
      this.state.rooms.map(r =>
        `<button type="button" class="filter-chip" data-val="${escapeHtml(r.name)}" onclick="AdminPage.toggleRoomChip('${escapeHtml(r.name)}')">${escapeHtml(r.name)}</button>`
      ).join('');
  },

  toggleStatusChip(v) {
    $('filterStatus').value = $('filterStatus').value === v ? '' : v;
    this.page = 1;
    this.renderTable();
  },

  toggleRoomChip(v) {
    $('filterRoom').value = $('filterRoom').value === v ? '' : v;
    this.page = 1;
    this.renderTable();
  },

  /** ไฮไลต์ chip ที่ตรงกับตัวกรองปัจจุบัน */
  syncFilterChips() {
    const st = $('filterStatus').value, rm = $('filterRoom').value;
    document.querySelectorAll('#statusChips .filter-chip').forEach(c => c.classList.toggle('active', c.dataset.val === st));
    document.querySelectorAll('#roomChips .filter-chip').forEach(c => c.classList.toggle('active', c.dataset.val === rm));
  },

  setQuickDate(which) {
    const d = new Date();
    if (which === 'tomorrow') d.setDate(d.getDate() + 1);
    const iso = isoOf(d);
    DatePicker.set('filterDate', $('filterDate').value === iso ? '' : iso);
    this.page = 1;
    this.renderTable();
  },

  setPageSize(v) {
    this.pageSize = v === 'all' ? Infinity : parseInt(v, 10);
    this.page = 1;
    this.renderTable();
  },

  goPage(delta) {
    this.page += delta;
    this.renderTable();
  },

  /** เมนู "⋯" — ขยาย/ยุบแถวปุ่มจัดการที่เหลือของแถวนั้น (ยุบแถวอื่นที่เปิดอยู่ก่อนหน้าเสมอ) */
  toggleMenu(id) {
    this.expandedId = this.expandedId === id ? null : id;
    this.renderTable();
  },

  /** แสดงปุ่ม prev/next + เลขหน้า ใต้ตาราง */
  renderPager(totalCount) {
    const el = $('pagerBar');
    if (this.pageSize === Infinity) { el.innerHTML = ''; return; }
    const totalPages = Math.max(1, Math.ceil(totalCount / this.pageSize));
    if (this.page > totalPages) this.page = totalPages;
    el.innerHTML = `
      <button onclick="AdminPage.goPage(-1)" ${this.page <= 1 ? 'disabled' : ''}>ก่อนหน้า</button>
      <span>หน้า ${this.page} / ${totalPages}</span>
      <button onclick="AdminPage.goPage(1)" ${this.page >= totalPages ? 'disabled' : ''}>ถัดไป</button>
    `;
  },

  /** ทุกรายการที่ชนกับช่วงเวลานี้ในห้องนี้ (กติกาเดียวกับ backend: ไม่นับยกเลิก, รายการที่เสร็จแล้วใช้เวลาสิ้นสุดจริง) */
  findConflictsClient(room, date, start, end, excludeIds) {
    const ex = [].concat(excludeIds || []);
    return this.state.bookings.filter(r => {
      if (ex.includes(r.id) || r.room !== room || r.date !== date || r.status === 'ยกเลิก') return false;
      const effectiveEnd = r.actualEndTime || r.endTime;
      return start < effectiveEnd && end > r.startTime;
    });
  },

  /** รายการแรกที่ชน (ใช้ในหน้าต่างอนุมัติ) */
  findConflictClient(room, date, start, end, excludeId) {
    return this.findConflictsClient(room, date, start, end, excludeId)[0] || null;
  },

  roomCapacity(name) {
    const r = this.state.rooms.find(x => x.name === name);
    return r ? Number(r.capacity) : 0;
  },

  /** 1 แถวของตาราง + แถวเมนู "⋯" ที่ขยายได้ (คืนมาเป็น 1 หรือ 2 <tr> รวมกัน) */
  renderRow(b) {
    const badge = this.getBadgeClass(b.status);
    const time = b.actualEndTime
      ? `${escapeHtml(b.startTime)} - ${escapeHtml(b.endTime)} <span style="color:var(--done);">(จริง: ${escapeHtml(b.actualEndTime)})</span>`
      : `${escapeHtml(b.startTime)} - ${escapeHtml(b.endTime)}`;

    const equip = escapeHtml(b.equipment || '-') +
      (b.otherEquipment && b.otherEquipment !== '-'
        ? '<br>อื่นๆ: ' + escapeHtml(b.otherEquipment) : '');

    const isDone = this.isDone(b.status);
    const isCancelled = b.status === 'ยกเลิก';
    const canAct = !isDone && !isCancelled;
    const email = b.requesterEmail
      ? `<br><small style="color:var(--ink-faint);">${escapeHtml(b.requesterEmail)}</small>` : '';
    const noteLine = b.adminComment
      ? `<br><small style="color:var(--ink-faint);">หมายเหตุ: ${escapeHtml(b.adminComment)}</small>` : '';

    // ปุ่มหลัก 1 ปุ่ม/แถว ตามสถานะที่น่าจะเป็นขั้นต่อไป — ที่เหลือซ่อนไว้ในเมนู "⋯"
    let primary = '';
    if (b.status === 'รออนุมัติ') {
      primary = `<button class="btn-confirm" onclick="AdminPage.openConfirm('${b.id}')">อนุมัติ</button>`;
    } else if (canAct) {
      primary = `<button class="btn-complete" onclick="AdminPage.openComplete('${b.id}')">เสร็จสิ้น</button>`;
    }
    const menuOpen = this.expandedId === b.id;
    const menuBtn = `<button class="btn-more ${menuOpen ? 'open' : ''}" aria-label="เพิ่มเติม" onclick="AdminPage.toggleMenu('${b.id}')">⋯</button>`;

    const mainRow = `
      <tr class="${isDone ? 'row-done' : ''}" data-id="${escapeHtml(b.id)}" tabindex="0" title="คลิกเพื่อดูรายละเอียด">
        <td><strong>${escapeHtml(formatThaiDate(b.date))}</strong><br>
            <small style="color:var(--ink-faint);">แจ้ง: ${escapeHtml(b.timestamp || '-')}</small></td>
        <td>${time}</td>
        <td><strong>${escapeHtml(b.userName || '-')}</strong><br>
            <small style="color:var(--ink-soft);">${escapeHtml(b.department || '-')}</small>${email}${noteLine}</td>
        <td>${escapeHtml(b.room || '-')}</td>
        <td style="text-align:center;">${Number(b.attendees) || 0} คน</td>
        <td><small>${equip}</small></td>
        <td><span class="badge ${badge}">${escapeHtml(b.status)}</span></td>
        <td class="actions"><div class="actions-primary">${primary}${menuBtn}</div></td>
      </tr>
    `;

    if (!menuOpen) return mainRow;

    // v4.3: ย้ายห้อง/สลับห้อง รวมอยู่ในหน้าต่าง "แก้ไขรายการ" แล้ว
    const extraBtns = [
      `<button class="btn-edit" onclick="AdminPage.openEdit('${b.id}')">แก้ไขรายการ (วัน เวลา ห้อง ข้อมูล)</button>`,
      canAct ? `<button class="btn-cancel" onclick="AdminPage.openCancel('${b.id}')">ยกเลิก</button>` : '',
      `<button class="btn-delete" onclick="AdminPage.deleteBooking('${b.id}')">ลบ</button>`
    ].join('');

    const expandRow = `
      <tr class="row-expand">
        <td colspan="8"><div class="actions">${extraBtns}</div></td>
      </tr>
    `;
    return mainRow + expandRow;
  },

  getBadgeClass(status) {
    switch (status) {
      case 'ยืนยันแล้ว': return 'badge-confirmed';
      case 'ยกเลิก': return 'badge-cancelled';
      case 'รออนุมัติ': return 'badge-pending';
      case 'เสร็จสิ้น':
      case 'เสร็จก่อนเวลา': return 'badge-complete';
      default: return 'badge-pending';
    }
  },

  // ---- Confirm / อนุมัติ ----

  openConfirm(id) {
    const b = this.state.bookings.find(x => x.id === id);
    if (!b) return;
    this.expandedId = null;

    const options = this.state.rooms
      .map(r => `<option value="${escapeHtml(r.name)}" ${r.name === b.room ? 'selected' : ''}>${escapeHtml(r.name)} (${r.capacity})</option>`)
      .join('');

    Modal.show(`
      <h3>อนุมัติการจอง</h3>
      <p style="color:var(--ink-soft); font-size:13px;">
        ${escapeHtml(b.userName)} — ${b.requestedRoom && b.requestedRoom !== b.room
          ? `ห้องที่ขอ: <strong>${escapeHtml(b.requestedRoom)}</strong> · ปัจจุบัน: <strong>${escapeHtml(b.room)}</strong>`
          : `ห้องที่ขอ: <strong>${escapeHtml(b.room)}</strong>`}<br>
        วันที่: ${formatThaiDate(b.date)} เวลา ${escapeHtml(b.startTime)}-${escapeHtml(b.endTime)}
      </p>
      ${b.requestedRoom && b.requestedRoom !== b.room
        ? `<div class="note-box">ห้องถูกเปลี่ยนจากที่ผู้จองขอแล้ว — อีเมลยืนยันจะแจ้งว่า "ยืนยันการจอง (เปลี่ยนห้องจากที่ขอ)" พร้อมห้องที่ขอและห้องที่ได้</div>`
        : ''}
      <label>ห้องที่จะอนุมัติ</label>
      <select id="confirmRoom" onchange="AdminPage.onConfirmRoomChange('${b.id}')">${options}</select>
      <div id="confirmConflictBox"></div>
      <label id="confirmCommentLabel">หมายเหตุ (ไม่บังคับ)</label>
      <textarea id="confirmComment" rows="2" placeholder="จำเป็นถ้าอนุมัติคนละห้องกับที่ขอ..."></textarea>
      <div class="field-error" id="confirmErr"></div>
      <div class="modal-btns">
        <button class="close" onclick="Modal.close()">ปิด</button>
        <button class="save" onclick="AdminPage.doConfirm('${b.id}')">ยืนยันอนุมัติ</button>
      </div>
    `);
    this.onConfirmRoomChange(id);
  },

  /** อัปเดต UI ตอนเปลี่ยนห้องที่จะอนุมัติ: เช็คห้องว่าง + สลับ label เป็นบังคับถ้าเปลี่ยนห้อง */
  onConfirmRoomChange(id) {
    const b = this.state.bookings.find(x => x.id === id);
    const selRoom = $('confirmRoom').value;
    const changed = selRoom !== b.room;
    const conflict = changed ? this.findConflictClient(selRoom, b.date, b.startTime, b.endTime, b.id) : null;

    $('confirmConflictBox').innerHTML = conflict
      ? `<div class="conflict-box">ห้องนี้ไม่ว่างช่วงเวลานี้ — ชนกับ ${escapeHtml(conflict.userName)} (${escapeHtml(conflict.startTime)}-${escapeHtml(conflict.endTime)}) กรุณาเลือกห้องอื่น</div>`
      : '';
    $('confirmCommentLabel').textContent = changed ? 'เหตุผล (จำเป็น — เปลี่ยนห้องจากที่ขอ)' : 'หมายเหตุ (ไม่บังคับ)';
    $('confirmCommentLabel').classList.toggle('req-label', changed);
    $('confirmErr').textContent = '';
  },

  async doConfirm(id) {
    const b = this.state.bookings.find(x => x.id === id);
    const room = $('confirmRoom').value;
    const comment = $('confirmComment').value.trim();
    const changed = room !== b.room;
    const err = $('confirmErr');

    if (changed && this.findConflictClient(room, b.date, b.startTime, b.endTime, b.id)) {
      err.textContent = 'ห้องนี้ไม่ว่างช่วงเวลานี้ — กรุณาเลือกห้องอื่น';
      return;
    }
    if (changed && !comment) {
      err.textContent = 'กรุณาระบุเหตุผลที่อนุมัติคนละห้องกับที่ขอ (จะแนบไปกับอีเมลแจ้งผู้จอง)';
      return;
    }

    const json = await callAPI({
      action: 'bookings.confirm', id, room: changed ? room : undefined,
      comment, by: AdminAuth.name, apiKey: AdminAuth.key
    });
    this.handleResponse(json, () => {
      const updates = { status: 'ยืนยันแล้ว' };
      if (changed) { updates.requestedRoom = b.requestedRoom || b.room; updates.room = room; }
      if (comment) updates.adminComment = comment;
      this.patchBooking(id, updates);
    });
  },

  openCancel(id) {
    const b = this.state.bookings.find(x => x.id === id);
    if (!b) return;
    this.expandedId = null;

    Modal.show(`
      <h3>ยกเลิกรายการจอง</h3>
      <p style="color:var(--ink-soft); font-size:13px;">
        ${escapeHtml(b.userName)} — ${escapeHtml(b.room)}<br>
        วันที่: ${formatThaiDate(b.date)} เวลา ${escapeHtml(b.startTime)}-${escapeHtml(b.endTime)}
      </p>
      <label class="req-label">เหตุผล (จะแนบไปกับอีเมลแจ้งผู้จอง ให้ทราบเหตุผลที่ยกเลิก)</label>
      <textarea id="cancelComment" rows="2" placeholder="เช่น ห้องไม่ว่างเนื่องจากงานเร่งด่วน / ขอยกเลิกตามคำร้องขอ..."></textarea>
      <div class="field-error" id="cancelErr"></div>
      <div class="modal-btns">
        <button class="close" onclick="Modal.close()">ปิด</button>
        <button class="save" onclick="AdminPage.doCancel('${b.id}')">ยืนยันยกเลิก</button>
      </div>
    `);
  },

  async doCancel(id) {
    const comment = $('cancelComment').value.trim();
    if (!comment) {
      $('cancelErr').textContent = 'กรุณาระบุเหตุผล (จำเป็นสำหรับแจ้งผู้จอง)';
      return;
    }
    const json = await callAPI({ action: 'bookings.cancel', id, comment, by: AdminAuth.name, apiKey: AdminAuth.key });
    this.handleResponse(json, () => this.patchBooking(id, { status: 'ยกเลิก', adminComment: comment }));
  },

  async deleteBooking(id) {
    if (!confirm('ลบถาวร? ไม่สามารถกู้คืนได้')) return;
    this.expandedId = null;
    const json = await callAPI({ action: 'bookings.delete', id, by: AdminAuth.name, apiKey: AdminAuth.key });
    this.handleResponse(json, () => {
      this.state.bookings = this.state.bookings.filter(b => b.id !== id);
    });
  },

  /** แก้ไขข้อมูล booking ใน state ในเครื่อง แล้ว render ใหม่ทันที (ไม่ยิง API ซ้ำ) */
  patchBooking(id, updates) {
    const b = this.state.bookings.find(x => x.id === id);
    if (b) Object.assign(b, updates);
  },

  handleResponse(json, onSuccessPatch) {
    if (json.success) {
      showAlert('success', json.data?.message || json.message || 'สำเร็จ');
      if (onSuccessPatch) onSuccessPatch();
      this.renderStatsFromState();
      this.renderTable();
      Modal.close();
    } else if (json.error?.code === 'UNAUTHORIZED') {
      AdminAuth.clear();
      AdminAuth.showGate('รหัสผ่านไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่');
    } else {
      const detail = json.error?.details?.message || '';
      showAlert('error', json.message + (detail ? ' — ' + detail : ''));
    }
  },

  // ---- รายละเอียดเต็ม (คลิกที่แถวในตาราง) ----

  /** คลิกที่แถว = เปิดรายละเอียด (ไม่ทำงานถ้าคลิกโดนปุ่ม/ลิงก์ หรือกำลังลากคลุมข้อความ) */
  onRowClick(e) {
    if (e.target.closest('button, a, input, select')) return;
    const sel = window.getSelection ? window.getSelection().toString() : '';
    if (sel) return;
    const tr = e.target.closest('tr[data-id]');
    if (tr) this.openDetail(tr.dataset.id);
  },

  openDetail(id) {
    const b = this.state.bookings.find(x => x.id === id);
    if (!b) return;

    const val = v => (v === undefined || v === null || v === '' || v === '-') ? '-' : escapeHtml(v);

    let time = `${escapeHtml(b.startTime)} - ${escapeHtml(b.endTime)} น.`;
    if (b.actualEndTime) {
      time += `<br><span style="color:var(--complete);">เสร็จจริง ${escapeHtml(b.actualEndTime)} น.`;
      const [h1, m1] = String(b.actualEndTime).split(':').map(Number);
      const [h2, m2] = String(b.endTime).split(':').map(Number);
      const early = (h2 * 60 + m2) - (h1 * 60 + m1);
      if (early > 0) time += ` (คืนห้องก่อนเวลา ${early} นาที)`;
      time += '</span>';
    }

    const email = b.requesterEmail
      ? `<a href="mailto:${escapeHtml(b.requesterEmail)}">${escapeHtml(b.requesterEmail)}</a>` : '-';

    Modal.show(`
      <div class="detail-head">
        <div>
          <h3>รายละเอียดการจอง</h3>
          <p class="detail-id">รหัส ${escapeHtml(b.id)}</p>
        </div>
        <span class="badge ${this.getBadgeClass(b.status)}">${escapeHtml(b.status)}</span>
      </div>
      <dl class="detail-list">
        <dt>วันที่ใช้งาน</dt><dd>${formatThaiDate(b.date)}</dd>
        <dt>เวลา</dt><dd>${time}</dd>
        <dt>ห้อง</dt><dd>${val(b.room)}</dd>
        <dt>ผู้ขอใช้</dt><dd>${val(b.userName)}</dd>
        <dt>ฝ่าย/แผนก</dt><dd>${val(b.department)}</dd>
        <dt>อีเมลผู้แจ้ง</dt><dd>${email}</dd>
        <dt>วัตถุประสงค์</dt><dd>${val(b.purpose)}</dd>
        <dt>ผู้เข้าร่วม</dt><dd>${b.attendees || 0} คน</dd>
        <dt>อุปกรณ์</dt><dd>${val(b.equipment)}</dd>
        <dt>อื่นๆ</dt><dd>${val(b.otherEquipment)}</dd>
        <dt>วันที่แจ้ง</dt><dd>${val(b.timestamp)}</dd>
        <dt>แก้ไขล่าสุด</dt><dd>${val(b.lastEdited)}${b.editedBy ? ' โดย ' + escapeHtml(b.editedBy) : ''}</dd>
        <dt>หมายเหตุ Admin</dt><dd>${val(b.adminComment)}</dd>
      </dl>
      <div class="history-title">ประวัติและเหตุผล</div>
      <div class="history" id="detailHistory"><p class="history-empty">กำลังโหลด...</p></div>
      <div class="modal-btns">
        <button class="close" onclick="Modal.close()">ปิด</button>
        <button class="save" onclick="AdminPage.openEdit('${escapeHtml(b.id)}')">แก้ไขรายการ</button>
      </div>
    `);
    this.loadHistory(b.id, 'detailHistory');
  },

  // ---- Complete ----

  openComplete(id) {
    const b = this.state.bookings.find(x => x.id === id);
    if (!b) return;
    this.expandedId = null;

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');

    Modal.show(`
      <h3>บันทึกเสร็จสิ้น</h3>
      <p style="color:var(--ink-soft); font-size:13px;">
        ${escapeHtml(b.userName)} — ${escapeHtml(b.room)}<br>
        จองไว้: ${escapeHtml(b.startTime)} - ${escapeHtml(b.endTime)}
      </p>
      <label>เวลาสิ้นสุดจริง (ถ้าเสร็จก่อนเวลา ใส่เวลาก่อน endTime)</label>
      ${timeSelectHTML('actualEnd', `${hh}:${mm}`)}
      <label>หมายเหตุ (ไม่บังคับ)</label>
      <textarea id="completeComment" rows="2" placeholder="เช่น คืนห้องก่อนเวลาเพราะประชุมเสร็จเร็ว..."></textarea>
      <div class="modal-btns">
        <button class="close" onclick="Modal.close()">ยกเลิก</button>
        <button class="save" onclick="AdminPage.doComplete('${b.id}')">บันทึก</button>
      </div>
    `);
  },

  async doComplete(id) {
    const actualEndTime = getTimeValue('actualEnd');
    const comment = $('completeComment').value.trim();
    const json = await callAPI({
      action: 'bookings.complete', id, actualEndTime, comment, by: AdminAuth.name, apiKey: AdminAuth.key
    });
    this.handleResponse(json, () => {
      if (json.data) {
        const updates = { status: json.data.status, actualEndTime: json.data.actualEnd };
        if (comment) updates.adminComment = comment;
        this.patchBooking(id, updates);
      }
    });
  },

  // ---- Edit (v4.3: หน้าเดียวจบ — วัน เวลา ห้อง สลับ/บังคับย้าย ผู้จอง อุปกรณ์ เหตุผล ประวัติ) ----

  EQUIP_LIST: ['LCD PROJECTOR', 'NOTEBOOK', 'ลำโพง/ไมโครโฟนปลาดาว', 'ZOOM PROGRAM'],
  PURPOSE_LIST: ['ประชุมภายใน', 'ออนไลน์'],
  EDIT_TIME_OPTS: { hourStart: 6, hourEnd: 20, minuteStep: 5 },

  openEdit(id) {
    const b = this.state.bookings.find(x => x.id === id);
    if (!b) return;
    this.expandedId = null;

    const closed = this.isDone(b.status) || b.status === 'ยกเลิก';
    const items = String(b.equipment || '').split(',').map(s => s.trim())
      .filter(s => s && !s.startsWith('อื่นๆ:'));
    const other = (b.otherEquipment && b.otherEquipment !== '-') ? b.otherEquipment : '';
    const purposes = (!b.purpose || this.PURPOSE_LIST.includes(b.purpose))
      ? this.PURPOSE_LIST : this.PURPOSE_LIST.concat([b.purpose]);
    this._edit = { id, room: b.room, resolution: null, conflicts: [], closed };

    Modal.show(`
      <div class="detail-head">
        <div>
          <h3>แก้ไขรายการ</h3>
          <p class="detail-id">รหัส ${escapeHtml(b.id)} · ${escapeHtml(b.userName || '-')}</p>
        </div>
        <span class="badge ${this.getBadgeClass(b.status)}">${escapeHtml(b.status)}</span>
      </div>
      ${closed ? `<div class="note-box">รายการนี้${escapeHtml(b.status)}แล้ว แก้ได้เฉพาะข้อมูลผู้จองและอุปกรณ์</div>` : ''}
      ${b.status === 'ยืนยันแล้ว' ? `<div class="note-box note-ok">รายการนี้ยืนยันแล้ว — บันทึกการแก้ไขแล้ว ระบบจะส่งอีเมล <b>"ยืนยันการจองอีกครั้ง"</b> พร้อมรายละเอียดที่เปลี่ยน ไปที่ ${escapeHtml(b.requesterEmail || 'ผู้จอง')}</div>` : ''}

      <section class="edit-sec">
        <h4 class="edit-sec-title">วันและเวลา</h4>
        <label for="editDateBtn">วันที่</label>
        ${DatePicker.html('editDate', b.date)}
        <div class="edit-grid2">
          <div><label>เวลาเริ่ม</label>${timeSelectHTML('editStart', b.startTime, this.EDIT_TIME_OPTS)}</div>
          <div><label>เวลาสิ้นสุด</label>${timeSelectHTML('editEnd', b.endTime, this.EDIT_TIME_OPTS)}</div>
        </div>
      </section>

      <section class="edit-sec">
        <h4 class="edit-sec-title">ห้อง</h4>
        <p class="edit-hint">ห้องปัจจุบัน: <b>${escapeHtml(b.room)}</b> · ว่าง/ไม่ว่าง คิดจากวันและเวลาด้านบน · เลือกห้องที่ไม่ว่างได้ แล้วเลือกวิธีจัดการรายการเดิม (สลับ / ย้ายอัตโนมัติ / รออนุมัติ)</p>
        <div class="room-pick" id="editRoomList"></div>
        <div id="editConflictBox"></div>
      </section>

      <section class="edit-sec">
        <h4 class="edit-sec-title">ผู้จอง</h4>
        <div class="edit-grid2">
          <div><label for="editUser">ผู้ขอใช้</label><input type="text" id="editUser" value="${escapeHtml(b.userName || '')}"></div>
          <div><label for="editDept">ฝ่าย/แผนก</label><input type="text" id="editDept" value="${escapeHtml(b.department || '')}"></div>
        </div>
        <label for="editEmail">อีเมลผู้แจ้ง</label>
        <input type="email" id="editEmail" value="${escapeHtml(b.requesterEmail || '')}" placeholder="name@nissei.co.th">
        <div class="edit-grid2">
          <div><label for="editAttendees">จำนวนผู้เข้าร่วม</label><input type="number" id="editAttendees" value="${Number(b.attendees) || 1}" min="1"></div>
          <div><label>วัตถุประสงค์</label>
            <div class="chip-choice">${purposes.map(pp =>
              `<label><input type="radio" name="editPurpose" value="${escapeHtml(pp)}"${pp === b.purpose ? ' checked' : ''}> ${escapeHtml(pp)}</label>`).join('')}</div>
          </div>
        </div>
      </section>

      <section class="edit-sec">
        <h4 class="edit-sec-title">อุปกรณ์</h4>
        <div class="chip-choice">${this.EQUIP_LIST.map(eq =>
          `<label><input type="checkbox" name="editEquip" value="${escapeHtml(eq)}"${items.includes(eq) ? ' checked' : ''}> ${escapeHtml(eq)}</label>`).join('')}</div>
        <label for="editOther">อื่นๆ (โปรดระบุ)</label>
        <input type="text" id="editOther" value="${escapeHtml(other)}" placeholder="เว้นว่างได้">
      </section>

      <section class="edit-sec">
        <h4 class="edit-sec-title">เหตุผลที่แก้ไข</h4>
        <label class="req-label" for="editComment">เหตุผล (แนบไปกับอีเมลแจ้งผู้จอง และเก็บไว้ในประวัติ)</label>
        <textarea id="editComment" rows="2" placeholder="เช่น แก้ไขเวลาตามคำร้องขอ / ห้องเดิมมีงานซ่อมบำรุง..."></textarea>
        <div class="history-title">ประวัติและเหตุผลก่อนหน้า</div>
        <div class="history" id="editHistory"><p class="history-empty">กำลังโหลด...</p></div>
      </section>

      <div class="field-error" id="editErr" role="alert"></div>
      <div class="modal-btns">
        <button class="close" onclick="Modal.close()">ปิด</button>
        <button class="save" id="editSaveBtn" onclick="AdminPage.doEdit()">บันทึกการแก้ไข</button>
      </div>
    `, { wide: true });

    const timeIds = ['editStartHour', 'editStartMin', 'editEndHour', 'editEndMin'];
    if (closed) {
      DatePicker.setDisabled('editDate', true);
      timeIds.forEach(i => { $(i).disabled = true; });
    }
    timeIds.concat(['editDate']).forEach(i => $(i).addEventListener('change', () => this.renderEditRooms()));
    $('editAttendees').addEventListener('input', () => this.renderEditRooms());
    this.renderEditRooms();
    this.loadHistory(id, 'editHistory');
  },

  editSlot() {
    return { date: DatePicker.get('editDate'), start: getTimeValue('editStart'), end: getTimeValue('editEnd') };
  },

  /** การ์ดห้องทุกห้อง + สถานะว่าง/ไม่ว่าง ตามวันเวลาที่เลือกอยู่ในฟอร์ม */
  renderEditRooms() {
    const e = this._edit;
    if (!e || !$('editRoomList')) return;
    const b = this.state.bookings.find(x => x.id === e.id);
    const { date, start, end } = this.editSlot();
    const timeOk = date && start && end && start < end;
    const att = parseInt($('editAttendees').value, 10) || 0;

    $('editRoomList').innerHTML = this.state.rooms.map(r => {
      const conflicts = timeOk && !e.closed ? this.findConflictsClient(r.name, date, start, end, b.id) : [];
      const tooSmall = att > Number(r.capacity);
      const sel = e.room === r.name;
      const [tag, cls] = tooSmall ? ['ที่นั่งไม่พอ', 'busy'] : conflicts.length ? ['ไม่ว่าง', 'busy'] : ['ว่าง', 'free'];
      return `
        <button type="button" class="room-pick-card${sel ? ' selected' : ''}" data-room="${escapeHtml(r.name)}"
                onclick="AdminPage.pickEditRoom(this.dataset.room)" aria-pressed="${sel}"${e.closed ? ' disabled' : ''}>
          <span class="room-pick-head"><span>${escapeHtml(r.name)}</span><span class="${cls}">${tag}</span></span>
          <span class="room-pick-cap">ความจุ ${Number(r.capacity)} ที่นั่ง${r.name === b.room ? ' · ห้องปัจจุบัน' : ''}</span>
          ${conflicts.length ? `<span class="room-pick-conflict">ชนกับ: ${conflicts.map(c =>
            `${escapeHtml(c.userName)} (${escapeHtml(c.startTime)}-${escapeHtml(c.endTime)})`).join(', ')}</span>` : ''}
        </button>`;
    }).join('');
    this.renderEditConflict();
  },

  /** ห้องที่เลือกไม่ว่าง → ให้เลือกวิธีจัดการรายการเดิม (สลับ / ย้ายอัตโนมัติ / รออนุมัติ) */
  renderEditConflict() {
    const e = this._edit;
    const box = $('editConflictBox');
    const b = this.state.bookings.find(x => x.id === e.id);
    const { date, start, end } = this.editSlot();
    const timeOk = date && start && end && start < end;
    const slotChanged = date !== b.date || start !== b.startTime || end !== b.endTime || e.room !== b.room;
    const conflicts = timeOk && !e.closed && slotChanged
      ? this.findConflictsClient(e.room, date, start, end, b.id) : [];

    e.conflicts = conflicts;
    if (!conflicts.length) { e.resolution = null; box.innerHTML = ''; return; }

    const roomChanged = e.room !== b.room;
    let swapOk = false, swapWhy = '';
    if (!roomChanged) swapWhy = 'ใช้ได้เมื่อเปลี่ยนห้อง';
    else if (conflicts.length !== 1) swapWhy = 'ชนมากกว่า 1 รายการ';
    else {
      const c = conflicts[0];
      if (Number(c.attendees) > this.roomCapacity(b.room)) swapWhy = `${b.room} จุไม่พอสำหรับ ${c.attendees} คน`;
      else if (this.findConflictsClient(b.room, c.date, c.startTime, c.endTime, [b.id, c.id]).length) swapWhy = `${b.room} ไม่ว่างในเวลาของ ${c.userName}`;
      else swapOk = true;
    }
    if (e.resolution === 'swap' && !swapOk) e.resolution = null;

    const who = conflicts.length === 1 ? `<b>${escapeHtml(conflicts[0].userName)}</b>` : `รายการเดิมทั้ง ${conflicts.length} รายการ`;
    const opt = (v, label, ok, why) => `
      <label class="res-option${ok ? '' : ' is-disabled'}">
        <input type="radio" name="editRes" value="${v}"${e.resolution === v ? ' checked' : ''}${ok ? '' : ' disabled'} onchange="AdminPage.setEditResolution('${v}')">
        <span>${label}${!ok && why ? ` <small>(${escapeHtml(why)})</small>` : ''}</span>
      </label>`;

    box.innerHTML = `
      <div class="conflict-box">
        <div>${escapeHtml(e.room)} มีรายการในช่วงนี้แล้ว: ${conflicts.map(c =>
          `<b>${escapeHtml(c.userName)}</b> ${escapeHtml(c.startTime)}-${escapeHtml(c.endTime)} (${escapeHtml(c.status)})`).join(', ')}</div>
        <div class="conflict-q">เลือกวิธีจัดการรายการเดิม:</div>
        ${opt('swap', `สลับห้องกับ ${who} — ไปใช้ ${escapeHtml(b.room)} แทน`, swapOk, swapWhy)}
        ${opt('bump', `ย้าย ${who} ไปห้องว่างอื่นที่จุพอ ให้อัตโนมัติ`, true)}
        ${opt('pending', `เปลี่ยน ${who} เป็น "รออนุมัติ" แล้วจัดสรรใหม่เอง`, true)}
      </div>`;
  },

  pickEditRoom(name) {
    if (!this._edit || this._edit.closed) return;
    this._edit.room = name;
    this._edit.resolution = null;
    this.renderEditRooms();
  },

  setEditResolution(v) { this._edit.resolution = v; },

  async doEdit() {
    const e = this._edit;
    const b = this.state.bookings.find(x => x.id === e.id);
    const err = $('editErr');
    err.textContent = '';
    const fail = (msg, focusId) => { err.textContent = msg; if (focusId && $(focusId)) $(focusId).focus(); };

    const { date, start, end } = this.editSlot();
    const userName = $('editUser').value.trim();
    const department = $('editDept').value.trim();
    const email = $('editEmail').value.trim();
    const att = parseInt($('editAttendees').value, 10);
    const purposeEl = document.querySelector('input[name="editPurpose"]:checked');
    const comment = $('editComment').value.trim();

    if (!date) return fail('กรุณาเลือกวันที่', 'editDateBtn');
    if (!start || !end) return fail('กรุณาเลือกเวลาเริ่ม-สิ้นสุดให้ครบทั้งชั่วโมงและนาที', 'editStartHour');
    if (start >= end) return fail('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม', 'editEndHour');
    if (!userName) return fail('กรุณากรอกชื่อผู้ขอใช้', 'editUser');
    if (!department) return fail('กรุณากรอกฝ่าย/แผนก', 'editDept');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('รูปแบบอีเมลไม่ถูกต้อง', 'editEmail');
    if (!Number.isInteger(att) || att < 1) return fail('จำนวนผู้เข้าร่วมต้องเป็นตัวเลขตั้งแต่ 1 ขึ้นไป', 'editAttendees');
    if (att > this.roomCapacity(e.room)) return fail(`${e.room} จุได้ ${this.roomCapacity(e.room)} คน — เลือกห้องที่ใหญ่ขึ้น`);
    if (e.conflicts.length && !e.resolution) return fail('ห้องนี้ไม่ว่างในช่วงเวลานี้ — เลือกวิธีจัดการรายการเดิม หรือเปลี่ยนห้อง/เวลา');
    if (!comment) return fail('กรุณาระบุเหตุผลที่แก้ไข (จะแนบไปกับอีเมลแจ้งผู้จอง)', 'editComment');

    const equipment = Array.from(document.querySelectorAll('input[name="editEquip"]:checked')).map(x => x.value);
    const other = $('editOther').value.trim();
    if (other) equipment.push('อื่นๆ: ' + other);

    const btn = $('editSaveBtn');
    btn.disabled = true;
    btn.textContent = 'กำลังบันทึก...';
    try {
      const json = await callAPI({
        action: 'bookings.edit', id: e.id,
        date, startTime: start, endTime: end, room: e.room,
        userName, department, requesterEmail: email, attendees: att,
        purpose: purposeEl ? purposeEl.value : b.purpose,
        equipment, otherEquipment: other,
        resolution: e.conflicts.length ? e.resolution : undefined,
        comment, by: AdminAuth.name, apiKey: AdminAuth.key
      });

      if (json.success) {
        Modal.close();
        showAlert('success', (json.data && json.data.message) || 'บันทึกการแก้ไขสำเร็จ');
        await this.loadData();   // โหลดใหม่ทั้งชุด — การสลับ/ย้ายอัตโนมัติกระทบรายการอื่นด้วย
        return;
      }
      if (json.error && json.error.code === 'UNAUTHORIZED') { Modal.close(); this.handleResponse(json); return; }

      const d = (json.error && json.error.details) || {};
      let msg = json.message + (d.message ? ' — ' + d.message : '');
      if (Array.isArray(d.conflictWith)) {
        msg += ' — ชนกับ ' + d.conflictWith.map(c => `${c.user} (${c.start}-${c.end})`).join(', ') +
               ' · ข้อมูลอาจเปลี่ยนไปแล้ว ปิดหน้าต่างแล้วกดรีเฟรช';
      }
      if (d.capacity) msg += ` — ห้องจุได้ ${d.capacity} คน`;
      if (json.error && json.error.code === 'UNKNOWN_ACTION') msg = 'ระบบหลังบ้านยังเป็นเวอร์ชันเก่า — ต้อง Deploy Apps Script เป็นเวอร์ชันใหม่ก่อน';
      fail(msg);
    } catch (ex) {
      fail('บันทึกไม่สำเร็จ: ' + ex.message);
    } finally {
      if ($('editSaveBtn')) { btn.disabled = false; btn.textContent = 'บันทึกการแก้ไข'; }
    }
  },

  /** ประวัติ + เหตุผลทุกครั้ง จากชีต AuditLog (ใหม่สุดก่อน) */
  async loadHistory(id, elId) {
    const b = this.state.bookings.find(x => x.id === id);
    const fallback = () => (b && b.adminComment)
      ? `<div class="history-item"><div class="history-meta">หมายเหตุล่าสุด (บันทึกก่อนมีประวัติ)</div><div class="history-reason">${escapeHtml(b.adminComment)}</div></div>`
      : '<p class="history-empty">ยังไม่มีประวัติ</p>';
    try {
      const json = await callAPI({ action: 'bookings.history', id, apiKey: AdminAuth.key });
      const el = $(elId);
      if (!el) return;                       // ปิดหน้าต่างไปแล้ว
      if (!json.success) {
        el.innerHTML = fallback() + (json.error && json.error.code === 'UNKNOWN_ACTION'
          ? '<p class="history-empty">ดูประวัติได้หลัง Deploy Apps Script เวอร์ชันใหม่</p>' : '');
        return;
      }
      const h = (json.data && json.data.history) || [];
      el.innerHTML = h.length ? h.map(x => `
        <div class="history-item">
          <div class="history-meta"><b>${escapeHtml(x.action)}</b> · ${escapeHtml(x.time)}${x.by ? ' · โดย ' + escapeHtml(x.by) : ''}</div>
          ${x.reason ? `<div class="history-reason">เหตุผล: ${escapeHtml(x.reason)}</div>` : ''}
          ${x.details ? `<div class="history-details">${escapeHtml(x.details)}</div>` : ''}
        </div>`).join('') : fallback();
    } catch (ex) {
      if ($(elId)) $(elId).innerHTML = fallback() + `<p class="history-empty">โหลดประวัติไม่สำเร็จ: ${escapeHtml(ex.message)}</p>`;
    }
  },

  // ---- Export Excel ----

  EXPORT_HEADER: [
    'ลำดับ', 'รหัสจอง', 'วันที่ใช้งาน', 'เวลาเริ่ม', 'เวลาสิ้นสุด', 'เวลาสิ้นสุดจริง',
    'ผู้ขอใช้', 'ฝ่าย/แผนก', 'อีเมลผู้แจ้ง', 'วัตถุประสงค์', 'ผู้เข้าร่วม (คน)',
    'ห้อง', 'อุปกรณ์', 'อื่นๆ', 'สถานะ', 'วันที่แจ้ง', 'แก้ไขล่าสุด', 'แก้ไขโดย', 'หมายเหตุ Admin'
  ],

  /** 'YYYY-MM-DD' → เลขวันที่แบบ Excel (ทำให้กรอง/เรียงตามวันที่ใน Excel ได้จริง ไม่ใช่ข้อความ) */
  excelDate(dateStr) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
    if (!m) return dateStr || '';
    return Math.round((Date.UTC(+m[1], m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86400000);
  },

  /** แปลงรายการจอง → แถวของตาราง export (dateAsSerial=true สำหรับ .xlsx, false สำหรับ CSV) */
  buildExportRows(rows, dateAsSerial) {
    return rows.map((b, i) => [
      i + 1,
      b.id,
      dateAsSerial ? this.excelDate(b.date) : formatThaiDate(b.date),
      b.startTime || '',
      b.endTime || '',
      b.actualEndTime || '',
      b.userName || '',
      b.department || '',
      b.requesterEmail || '',
      b.purpose || '',
      Number(b.attendees) || 0,
      b.room || '',
      b.equipment || '',
      (b.otherEquipment && b.otherEquipment !== '-') ? b.otherEquipment : '',
      b.status || '',
      b.timestamp || '',
      b.lastEdited || '',
      b.editedBy || '',
      b.adminComment || ''
    ]);
  },

  /** คำอธิบายตัวกรองที่ใช้อยู่ (ใส่ในชีต "สรุป") */
  describeFilters() {
    const parts = [];
    const st = $('filterStatus').value;
    if (st) parts.push('สถานะ: ' + (st === '__done' ? 'เสร็จแล้ว (เสร็จสิ้น + เสร็จก่อนเวลา)' : st));
    if ($('filterRoom').value) parts.push('ห้อง: ' + $('filterRoom').value);
    if ($('filterDate').value) parts.push('วันที่: ' + formatThaiDate($('filterDate').value));
    if ($('searchBox').value.trim()) parts.push('ค้นหา: ' + $('searchBox').value.trim());
    return parts.length ? parts.join(' | ') : 'ทั้งหมด (ไม่มีตัวกรอง)';
  },

  /** สร้าง Workbook 2 ชีต: "รายการจอง" + "สรุปสถานะ"  (รับ XLSX เข้ามาเพื่อให้ทดสอบได้) */
  buildWorkbook(XLSX, rows) {
    // --- ชีต 1: รายการจอง ---
    const ws = XLSX.utils.aoa_to_sheet([this.EXPORT_HEADER, ...this.buildExportRows(rows, true)]);
    ws['!cols'] = [6, 20, 13, 10, 12, 14, 22, 20, 28, 14, 14, 18, 30, 22, 14, 20, 20, 16, 30]
      .map(wch => ({ wch }));
    ws['!autofilter'] = { ref: ws['!ref'] };
    for (let r = 1; r <= rows.length; r++) {                    // คอลัมน์ C = วันที่ใช้งาน
      const cell = ws[XLSX.utils.encode_cell({ r, c: 2 })];
      if (cell && cell.t === 'n') cell.z = 'dd/mm/yyyy';
    }

    // --- ชีต 2: สรุปสถานะ ---
    const c = this.countByStatus(rows);
    const done = c['เสร็จสิ้น'] + c['เสร็จก่อนเวลา'];
    const now = new Date();
    const hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

    const summary = [
      ['สรุปรายการจองห้องประชุม'],
      ['ส่งออกเมื่อ', `${formatThaiDate(todayStr())} ${hhmm} น.`],
      ['ตัวกรอง', this.describeFilters()],
      [],
      ['สถานะ', 'จำนวน'],
      ['รออนุมัติ', c['รออนุมัติ']],
      ['ยืนยันแล้ว', c['ยืนยันแล้ว']],
      ['เสร็จสิ้น', c['เสร็จสิ้น']],
      ['เสร็จก่อนเวลา', c['เสร็จก่อนเวลา']],
      ['ยกเลิก', c['ยกเลิก']],
      ['เสร็จแล้ว (เสร็จสิ้น + เสร็จก่อนเวลา)', done],
      ['รวมทั้งหมด', rows.length],
      [],
      ['ห้อง', 'ทั้งหมด', 'เสร็จแล้ว']
    ];
    const roomNames = this.state.rooms.map(r => r.name);
    rows.forEach(b => { if (b.room && !roomNames.includes(b.room)) roomNames.push(b.room); });
    roomNames.forEach(name => {
      const inRoom = rows.filter(b => b.room === name);
      summary.push([name, inRoom.length, inRoom.filter(b => this.isDone(b.status)).length]);
    });

    const ws2 = XLSX.utils.aoa_to_sheet(summary);
    ws2['!cols'] = [{ wch: 38 }, { wch: 40 }, { wch: 12 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'รายการจอง');
    XLSX.utils.book_append_sheet(wb, ws2, 'สรุปสถานะ');
    return wb;
  },

  /** สำรอง: ถ้าโหลดไลบรารี Excel ไม่ได้ ให้ส่งออกเป็น CSV (ใส่ BOM ให้ Excel อ่านภาษาไทยถูก) */
  exportCSV(rows, filename) {
    const esc = v => {
      let t = String(v ?? '');
      if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;                 // กันสูตร Excel ที่แฝงมาในข้อความ
      return /[",\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
    };
    const lines = [this.EXPORT_HEADER, ...this.buildExportRows(rows, false)]
      .map(r => r.map(esc).join(','));
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },

  /** ส่งออกรายการที่เห็นในตาราง (ตามตัวกรองปัจจุบัน) เป็นไฟล์ Excel */
  exportExcel() {
    const rows = this.getFiltered();
    if (rows.length === 0) { showAlert('error', 'ไม่มีรายการให้ส่งออก'); return; }

    const now = new Date();
    const stamp = todayStr() + '_' +
      String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');

    if (typeof XLSX === 'undefined') {
      this.exportCSV(rows, `meeting-bookings_${stamp}.csv`);
      showAlert('success', `ส่งออก ${rows.length} รายการเป็น CSV แล้ว (โหลดไลบรารี Excel ไม่ได้ จึงใช้ CSV แทน — เปิดใน Excel ได้ตามปกติ)`);
      return;
    }

    try {
      const wb = this.buildWorkbook(XLSX, rows);
      XLSX.writeFile(wb, `meeting-bookings_${stamp}.xlsx`);
      showAlert('success', `ส่งออก ${rows.length} รายการเป็นไฟล์ Excel แล้ว`);
    } catch (err) {
      showAlert('error', 'ส่งออกไม่สำเร็จ: ' + err.message);
    }
  },

  // ---- Filters ----

  clearFilters() {
    $('filterStatus').value = '';
    $('filterRoom').value = '';
    DatePicker.set('filterDate', '');
    $('searchBox').value = '';
    this.page = 1;
    this.renderTable();
  }
};

// ==========================================================
// 🪟 MODAL (ใช้ในหน้า Admin)
// ==========================================================
const Modal = {
  /** opts.wide = หน้าต่างกว้าง (ใช้กับแก้ไขรายการ) */
  show(html, opts) {
    const content = $('modalContent');
    if (!content) return;
    DatePicker.close();
    content.classList.toggle('modal-wide', !!(opts && opts.wide));
    content.innerHTML = html;
    content.scrollTop = 0;
    $('modalBg').classList.add('show');
  },
  close() {
    DatePicker.close();
    const bg = $('modalBg');
    if (bg) bg.classList.remove('show');
  }
};

// ==========================================================
// 🚀 AUTO INIT — ตรวจว่าอยู่หน้าไหน แล้ว init ให้อัตโนมัติ
// ==========================================================
document.addEventListener('DOMContentLoaded', function() {
  DatePicker.init();

  // ถ้ามีฟอร์มจอง = อยู่หน้า Index
  if ($('bookingForm')) {
    IndexPage.init();
  }

  // ถ้ามีตาราง = อยู่หน้า Admin
  if ($('tableBody')) {
    DatePicker.mount('filterDateWrap', 'filterDate', '', { clearable: true, placeholder: 'เลือกวันที่' });
    AdminAuth.bindGate();

    if (AdminAuth.isSet) {
      AdminAuth.hideGate();
      AdminPage.init();
    } else {
      AdminAuth.showGate();
    }

    // ผูก event filter
    AdminPage.bindStatCards();
    $('filterStatus').addEventListener('change', () => AdminPage.renderTable());
    $('filterRoom').addEventListener('change', () => AdminPage.renderTable());
    $('filterDate').addEventListener('change', () => { AdminPage.page = 1; AdminPage.renderTable(); });
    $('searchBox').addEventListener('input', debounce(() => { AdminPage.page = 1; AdminPage.renderTable(); }, 200));

    // คลิกแถวในตาราง = เปิดรายละเอียด (Enter ก็ได้เมื่อโฟกัสที่แถว) / กด Esc = ปิดหน้าต่าง
    $('tableBody').addEventListener('click', e => AdminPage.onRowClick(e));
    $('tableBody').addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.matches('tr[data-id]')) AdminPage.openDetail(e.target.dataset.id);
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') Modal.close(); });

    // Modal click backdrop = ปิด
    $('modalBg').addEventListener('click', e => {
      if (e.target.id === 'modalBg') Modal.close();
    });
  }
});
