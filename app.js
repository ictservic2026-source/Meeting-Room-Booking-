// ==========================================================
// 🏢 ระบบจองห้องประชุม - Shared JavaScript (v4)
// ใช้ร่วมกันระหว่าง index.html และ admin.html
// ==========================================================

// ==========================================================
// ⚙️ CONFIG
// ==========================================================
const API_URL = "https://script.google.com/macros/s/AKfycbw5kOoeNm-1Ybqe9wibO3kGKFj-6Wrb_3FAlRau2ErpJ0iouFJCemWwIIEg_1_GP0xK/exec";

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

/** วันนี้ในรูปแบบ YYYY-MM-DD */
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

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

  const hourOpts = ['<option value="">--</option>'].concat(
    Array.from({ length: hourEnd - hourStart + 1 }, (_, i) => String(hourStart + i).padStart(2, '0'))
      .map(hh => `<option value="${hh}"${hh === h ? ' selected' : ''}>${hh}</option>`)
  ).join('');

  const minOpts = ['<option value="">--</option>'].concat(
    Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => String(i * minuteStep).padStart(2, '0'))
      .map(mm => `<option value="${mm}"${mm === m ? ' selected' : ''}>${mm}</option>`)
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
// 📄 INDEX PAGE — หน้าจอง (พนักงาน)
// ==========================================================
const IndexPage = {
  state: { rooms: [] },

  async init() {
    // ตั้งวันที่เริ่มต้น
    $('date').valueAsDate = new Date();
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
        $('date').valueAsDate = new Date();
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

  /** เสร็จแล้ว = "เสร็จสิ้น" หรือ "เสร็จก่อนเวลา" */
  isDone(status) { return status === 'เสร็จสิ้น' || status === 'เสร็จก่อนเวลา'; },

  async init() {
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

    const tbody = $('tableBody');
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--ink-faint);">ไม่มีรายการ</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(b => this.renderRow(b)).join('');
  },

  /** แถบสรุปเหนือตาราง: แสดงกี่รายการ / เสร็จแล้วกี่รายการ (นับตามตัวกรองที่เลือกอยู่) */
  renderResultBar(filtered) {
    const c = this.countByStatus(filtered);
    const done = c['เสร็จสิ้น'] + c['เสร็จก่อนเวลา'];
    $('resultCounts').innerHTML = `
      <span>แสดง <b>${filtered.length}</b> จาก ${this.state.bookings.length} รายการ</span>
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
          $('filterDate').value = $('filterDate').value === todayStr() ? '' : todayStr();
        } else {
          $('filterStatus').value = $('filterStatus').value === f ? '' : f;
        }
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

  /** 1 แถวของตาราง */
  renderRow(b) {
    const badge = this.getBadgeClass(b.status);
    const time = b.actualEndTime
      ? `${b.startTime} - ${b.endTime} <span style="color:var(--done);">(จริง: ${b.actualEndTime})</span>`
      : `${b.startTime} - ${b.endTime}`;

    const equip = escapeHtml(b.equipment || '-') +
      (b.otherEquipment && b.otherEquipment !== '-'
        ? '<br>อื่นๆ: ' + escapeHtml(b.otherEquipment) : '');

    const isDone = this.isDone(b.status);
    const isCancelled = b.status === 'ยกเลิก';
    const email = b.requesterEmail
      ? `<br><small style="color:var(--ink-faint);">${escapeHtml(b.requesterEmail)}</small>` : '';

    return `
      <tr class="${isDone ? 'row-done' : ''}" data-id="${escapeHtml(b.id)}" tabindex="0" title="คลิกเพื่อดูรายละเอียด">
        <td><strong>${formatThaiDate(b.date)}</strong><br>
            <small style="color:var(--ink-faint);">แจ้ง: ${escapeHtml(b.timestamp || '-')}</small></td>
        <td>${time}</td>
        <td><strong>${escapeHtml(b.userName || '-')}</strong><br>
            <small style="color:var(--ink-soft);">${escapeHtml(b.department || '-')}</small>${email}</td>
        <td>${escapeHtml(b.room || '-')}</td>
        <td style="text-align:center;">${b.attendees || 0} คน</td>
        <td><small>${equip}</small></td>
        <td><span class="badge ${badge}">${escapeHtml(b.status)}</span></td>
        <td class="actions">
          ${b.status !== 'ยืนยันแล้ว' && !isDone
            ? `<button class="btn-confirm" onclick="AdminPage.confirmBooking('${b.id}')">ยืนยัน</button>` : ''}
          ${!isCancelled && !isDone
            ? `<button class="btn-cancel" onclick="AdminPage.openCancel('${b.id}')">ยกเลิก</button>` : ''}
          ${!isCancelled && !isDone
            ? `<button class="btn-move" onclick="AdminPage.openMove('${b.id}')">ย้ายห้อง</button>` : ''}
          ${!isCancelled && !isDone
            ? `<button class="btn-swap" onclick="AdminPage.openSwap('${b.id}')">สลับ</button>` : ''}
          ${!isCancelled && !isDone
            ? `<button class="btn-complete" onclick="AdminPage.openComplete('${b.id}')">เสร็จสิ้น</button>` : ''}
          <button class="btn-edit" onclick="AdminPage.openEdit('${b.id}')">แก้ไข</button>
          <button class="btn-delete" onclick="AdminPage.deleteBooking('${b.id}')">ลบ</button>
        </td>
      </tr>
    `;
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

  // ---- Actions (ทุก action แนบ apiKey ของผู้ดูแล + อัปเดต state ในเครื่องแทนการโหลดใหม่ทั้งหมด) ----

  async confirmBooking(id) {
    if (!confirm('ยืนยันรายการนี้?')) return;
    const json = await callAPI({ action: 'bookings.confirm', id, by: AdminAuth.name, apiKey: AdminAuth.key });
    this.handleResponse(json, () => this.patchBooking(id, { status: 'ยืนยันแล้ว' }));
  },

  openCancel(id) {
    const b = this.state.bookings.find(x => x.id === id);
    if (!b) return;

    Modal.show(`
      <h3>ยกเลิกรายการจอง</h3>
      <p style="color:var(--ink-soft); font-size:13px;">
        ${escapeHtml(b.userName)} — ${escapeHtml(b.room)}<br>
        วันที่: ${formatThaiDate(b.date)} เวลา ${escapeHtml(b.startTime)}-${escapeHtml(b.endTime)}
      </p>
      <label>หมายเหตุ (จะแนบไปกับอีเมลแจ้งผู้จอง ให้ทราบเหตุผลที่ยกเลิก)</label>
      <textarea id="cancelComment" rows="2" placeholder="เช่น ห้องไม่ว่างเนื่องจากงานเร่งด่วน / ขอยกเลิกตามคำร้องขอ..."></textarea>
      <div class="modal-btns">
        <button class="close" onclick="Modal.close()">ปิด</button>
        <button class="save" onclick="AdminPage.doCancel('${b.id}')">ยืนยันยกเลิก</button>
      </div>
    `);
  },

  async doCancel(id) {
    const comment = $('cancelComment').value.trim();
    const json = await callAPI({ action: 'bookings.cancel', id, comment, by: AdminAuth.name, apiKey: AdminAuth.key });
    this.handleResponse(json, () => {
      const updates = { status: 'ยกเลิก' };
      if (comment) updates.adminComment = comment;
      this.patchBooking(id, updates);
    });
  },

  async deleteBooking(id) {
    if (!confirm('ลบถาวร? ไม่สามารถกู้คืนได้')) return;
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
      <div class="modal-btns">
        <button class="close" onclick="Modal.close()">ปิด</button>
        <button class="save" onclick="AdminPage.openEdit('${escapeHtml(b.id)}')">แก้ไข</button>
      </div>
    `);
  },

  // ---- Move ----

  openMove(id) {
    const b = this.state.bookings.find(x => x.id === id);
    if (!b) return;

    const options = this.state.rooms
      .filter(r => r.name !== b.room)
      .map(r => `<option value="${escapeHtml(r.name)}">${escapeHtml(r.name)} (${r.capacity})</option>`)
      .join('');

    Modal.show(`
      <h3>ย้ายห้อง</h3>
      <p style="color:var(--ink-soft); font-size:13px;">
        จาก: <strong>${escapeHtml(b.room)}</strong> →
        ผู้ใช้: ${escapeHtml(b.userName)} (${b.attendees} คน)<br>
        วันที่: ${formatThaiDate(b.date)} เวลา ${escapeHtml(b.startTime)}-${escapeHtml(b.endTime)}
      </p>
      <label>เลือกห้องปลายทาง</label>
      <select id="moveToRoom">${options}</select>
      <label>หมายเหตุ (จะแนบไปกับอีเมลแจ้งผู้จอง ให้ทราบเหตุผลที่ย้ายห้อง)</label>
      <textarea id="moveComment" rows="2" placeholder="เช่น ห้องเดิมมีงานซ่อมบำรุง / ห้องเดิมชนกับรายการอื่นที่สำคัญกว่า..."></textarea>
      <div class="modal-btns">
        <button class="close" onclick="Modal.close()">ยกเลิก</button>
        <button class="save" onclick="AdminPage.doMove('${b.id}')">ย้ายเลย</button>
      </div>
    `);
  },

  async doMove(id) {
    const toRoom = $('moveToRoom').value;
    if (!toRoom) return;
    const comment = $('moveComment').value.trim();
    const json = await callAPI({ action: 'bookings.move', id, toRoom, comment, by: AdminAuth.name, apiKey: AdminAuth.key });
    this.handleResponse(json, () => this.patchBooking(id, comment ? { room: toRoom, adminComment: comment } : { room: toRoom }));
  },

  // ---- Swap ----

  openSwap(id) {
    const b = this.state.bookings.find(x => x.id === id);
    if (!b) return;

    const others = this.state.bookings.filter(x =>
      x.id !== id && x.status !== 'ยกเลิก' &&
      x.status !== 'เสร็จสิ้น' && x.status !== 'เสร็จก่อนเวลา'
    );

    if (others.length === 0) {
      showAlert('error', 'ไม่มีรายการอื่นให้สลับ');
      return;
    }

    const options = others.map(x =>
      `<option value="${x.id}">${escapeHtml(x.userName)} — ${escapeHtml(x.room)} (${escapeHtml(x.startTime)}-${escapeHtml(x.endTime)}, ${formatThaiDate(x.date)})</option>`
    ).join('');

    Modal.show(`
      <h3>สลับห้องกับรายการอื่น</h3>
      <p style="color:var(--ink-soft); font-size:13px;">
        รายการ A: <strong>${escapeHtml(b.userName)}</strong> — ${escapeHtml(b.room)}
        (${escapeHtml(b.startTime)}-${escapeHtml(b.endTime)}, ${formatThaiDate(b.date)})
      </p>
      <label>เลือกรายการ B ที่จะสลับด้วย</label>
      <select id="swapWith">${options}</select>
      <label>หมายเหตุ (จะแนบไปกับอีเมลแจ้งผู้จองทั้งสองฝ่าย ให้ทราบเหตุผลที่สลับห้อง)</label>
      <textarea id="swapComment" rows="2" placeholder="เช่น สลับให้เหมาะกับจำนวนผู้เข้าร่วมของแต่ละฝ่าย..."></textarea>
      <div class="modal-btns">
        <button class="close" onclick="Modal.close()">ยกเลิก</button>
        <button class="save" onclick="AdminPage.doSwap('${b.id}')">สลับเลย</button>
      </div>
    `);
  },

  async doSwap(idA) {
    const idB = $('swapWith').value;
    if (!idB) return;
    const comment = $('swapComment').value.trim();
    const json = await callAPI({ action: 'bookings.swap', idA, idB, comment, by: AdminAuth.name, apiKey: AdminAuth.key });
    this.handleResponse(json, () => {
      const a = this.state.bookings.find(x => x.id === idA);
      const b = this.state.bookings.find(x => x.id === idB);
      if (a && b) {
        const tmp = a.room; a.room = b.room; b.room = tmp;
        if (comment) { a.adminComment = comment; b.adminComment = comment; }
      }
    });
  },

  // ---- Complete ----

  openComplete(id) {
    const b = this.state.bookings.find(x => x.id === id);
    if (!b) return;

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

  // ---- Edit ----

  openEdit(id) {
    const b = this.state.bookings.find(x => x.id === id);
    if (!b) return;

    Modal.show(`
      <h3>แก้ไขรายการ</h3>
      <label>วันที่</label>
      <input type="date" id="editDate" value="${b.date}">
      <label>เวลาเริ่ม</label>
      ${timeSelectHTML('editStart', b.startTime)}
      <label>เวลาสิ้นสุด</label>
      ${timeSelectHTML('editEnd', b.endTime)}
      <label>ผู้ขอใช้</label>
      <input type="text" id="editUser" value="${escapeHtml(b.userName || '')}">
      <label>ฝ่าย</label>
      <input type="text" id="editDept" value="${escapeHtml(b.department || '')}">
      <label>อีเมลผู้แจ้ง</label>
      <input type="email" id="editEmail" value="${escapeHtml(b.requesterEmail || '')}" placeholder="name@company.com">
      <label>จำนวนผู้เข้าร่วม</label>
      <input type="number" id="editAttendees" value="${b.attendees || 1}" min="1">
      <div class="modal-btns">
        <button class="close" onclick="Modal.close()">ยกเลิก</button>
        <button class="save" onclick="AdminPage.doEdit('${b.id}')">บันทึก</button>
      </div>
    `);
  },

  async doEdit(id) {
    const updates = {
      action: 'bookings.update',
      id: id,
      date: $('editDate').value,
      startTime: getTimeValue('editStart'),
      endTime: getTimeValue('editEnd'),
      userName: $('editUser').value.trim(),
      department: $('editDept').value.trim(),
      requesterEmail: $('editEmail').value.trim(),
      attendees: parseInt($('editAttendees').value, 10),
      by: AdminAuth.name,
      apiKey: AdminAuth.key
    };
    const json = await callAPI(updates);
    this.handleResponse(json, () => this.patchBooking(id, {
      date: updates.date, startTime: updates.startTime, endTime: updates.endTime,
      userName: updates.userName, department: updates.department,
      requesterEmail: updates.requesterEmail, attendees: updates.attendees
    }));
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
    $('filterDate').value = '';
    $('searchBox').value = '';
    this.renderTable();
  }
};

// ==========================================================
// 🪟 MODAL (ใช้ในหน้า Admin)
// ==========================================================
const Modal = {
  show(html) {
    const content = $('modalContent');
    if (!content) return;
    content.innerHTML = html;
    $('modalBg').classList.add('show');
  },
  close() {
    const bg = $('modalBg');
    if (bg) bg.classList.remove('show');
  }
};

// ==========================================================
// 🚀 AUTO INIT — ตรวจว่าอยู่หน้าไหน แล้ว init ให้อัตโนมัติ
// ==========================================================
document.addEventListener('DOMContentLoaded', function() {
  // ถ้ามีฟอร์มจอง = อยู่หน้า Index
  if ($('bookingForm')) {
    IndexPage.init();
  }

  // ถ้ามีตาราง = อยู่หน้า Admin
  if ($('tableBody')) {
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
    $('filterDate').addEventListener('change', () => AdminPage.renderTable());
    $('searchBox').addEventListener('input', debounce(() => AdminPage.renderTable(), 200));

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
