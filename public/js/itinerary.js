// itinerary.js — persists across reloads via localStorage

// ===== tiny helpers =====
const $ = (id) => document.getElementById(id);
const LA_TZ = "America/Los_Angeles";
const LS_KEY = "itinerary.trips.v1";

// ===== state =====
const state = { trips: [] };

// ===== time utils =====
function buildLocalDate(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    const d = new Date(`${dateStr}T${timeStr}`);
    return Number.isNaN(d.getTime()) ? null : d;
}
function formatLA(dt) {
    if (!dt) return "";
    return new Intl.DateTimeFormat("en-US", {
        timeZone: LA_TZ,
        weekday: "short",
        month: "short",
        day: "2-digit",
        hour: "numeric",
        minute: "2-digit"
    }).format(dt);
}
function stampFilename() {
    const p = Object.fromEntries(
        new Intl.DateTimeFormat("en-CA", {
            timeZone: LA_TZ,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
        })
            .formatToParts(new Date())
            .map((x) => [x.type, x.value])
    );
    return `itin-${p.year}${p.month}${p.day}-${p.hour}${p.minute}${p.second}.json`;
}

// ===== persistence =====
function saveState() {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(state.trips));
    } catch (e) {
        console.warn("Failed to save trips to localStorage:", e);
    }
}
function loadState() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) state.trips = parsed;
    } catch (e) {
        console.warn("Failed to load trips from localStorage:", e);
    }
}

// ===== render =====
let rowsBody, addBtn, saveBtn, inputs;
function cell(text, className = "") {
    const td = document.createElement("td");
    if (className) td.className = className;
    td.textContent = text ?? "";
    return td;
}
function actionCell() {
    const td = document.createElement("td");
    const del = document.createElement("button");
    del.textContent = "Delete";
    del.type = "button";
    del.dataset.action = "delete-row";
    td.appendChild(del);
    return td;
}
function render() {
    rowsBody.innerHTML = "";
    state.trips.forEach((t, i) => {
        const tr = document.createElement("tr");
        tr.dataset.index = String(i);

        const departDt = t?.depart?.isoUtc ? new Date(t.depart.isoUtc) : null;
        const arriveDt = t?.arrive?.isoUtc ? new Date(t.arrive.isoUtc) : null;

        tr.appendChild(cell(i + 1, "idx"));
        tr.appendChild(cell(t.train));
        tr.appendChild(cell(t.origin));
        tr.appendChild(cell(t.destination));
        tr.appendChild(cell(formatLA(departDt), "mono"));
        tr.appendChild(cell(formatLA(arriveDt), "mono"));
        tr.appendChild(cell(t.notes || ""));
        tr.appendChild(actionCell());

        rowsBody.appendChild(tr);
    });
}

// ===== data collection =====
function requiredOK() {
    return inputs.train.value.trim() && inputs.origin.value.trim() && inputs.dest.value.trim();
}
function collectTrip() {
    const departDt = buildLocalDate(inputs.departDate.value, inputs.departTime.value);
    const arriveDt = buildLocalDate(inputs.arriveDate.value, inputs.arriveTime.value);
    return {
        train: inputs.train.value.trim(),
        origin: inputs.origin.value.trim(),
        destination: inputs.dest.value.trim(),
        depart: {
            date: inputs.departDate.value || "",
            time: inputs.departTime.value || "",
            isoUtc: departDt ? departDt.toISOString() : ""
        },
        arrive: {
            date: inputs.arriveDate.value || "",
            time: inputs.arriveTime.value || "",
            isoUtc: arriveDt ? arriveDt.toISOString() : ""
        },
        notes: inputs.notes.value.trim(),
        createdAt: new Date().toISOString()
    };
}
function clearInputs() {
    inputs.train.value = "";
    inputs.origin.value = "";
    inputs.dest.value = "";
    inputs.departDate.value = "";
    inputs.departTime.value = "";
    inputs.arriveDate.value = "";
    inputs.arriveTime.value = "";
    inputs.notes.value = "";
    inputs.train.focus();
}

// ===== handlers =====
function onAdd(e) {
    e.preventDefault();
    if (!requiredOK()) {
        alert("Train, Origin, and Destination are required.");
        return;
    }
    state.trips.push(collectTrip());
    saveState(); // persist after add
    clearInputs();
    render();
}
function onDelete(target) {
    const tr = target.closest("tr");
    if (!tr) return;
    const idx = Number(tr.dataset.index);
    if (!Number.isInteger(idx)) return;
    state.trips.splice(idx, 1);
    saveState(); // persist after delete
    render();
}
function onSave(e) {
    e.preventDefault();
    if (!state.trips.length) {
        alert("No trips to save yet.");
        return;
    }
    const blob = new Blob([JSON.stringify({ trips: state.trips }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = stampFilename();
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
}

// ===== boot =====
document.addEventListener("DOMContentLoaded", () => {
    // wire DOM
    rowsBody = $("rowsBody");
    addBtn = $("addBtn");
    saveBtn = $("saveBtn");
    inputs = {
        train: $("inTrain"),
        origin: $("inOrigin"),
        dest: $("inDest"),
        departDate: $("inDepartDate"),
        departTime: $("inDepartTime"),
        arriveDate: $("inArriveDate"),
        arriveTime: $("inArriveTime"),
        notes: $("inNotes")
    };

    if (!rowsBody || !addBtn || !saveBtn) {
        console.warn("Missing essential elements. Check IDs for rowsBody/addBtn/saveBtn.");
        return;
    }

    // load persisted trips, then render
    loadState();
    render();

    // events
    addBtn.addEventListener("click", onAdd);
    saveBtn.addEventListener("click", onSave);
    rowsBody.addEventListener("click", (e) => {
        const t = e.target;
        if (t && t.dataset && t.dataset.action === "delete-row") onDelete(t);
    });
});
