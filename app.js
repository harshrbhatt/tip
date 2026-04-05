/* ============================================
   TIP — Telecom Intelligence Platform
   Application Logic v3 — Zero Defaults, 
   Real-time Dashboard, LLM Integration
   ============================================ */
import { initSupabaseAuth } from './src/auth.js';


(() => {
    'use strict';

    // ---- State ----
    const state = {
        uploadedFiles: [],
        parsedData: [],
        charts: {},
        analyzedData: null,
        llmApiKey: localStorage.getItem('tip_llm_key') || '',
        llmProvider: localStorage.getItem('tip_llm_provider') || 'groq',
    };

    // ---- DOM References ----
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    // ---- Navigation ----
    function initNav() {
        $$('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const screen = item.dataset.screen;
                switchScreen(screen);
            });
        });
    }

    function switchScreen(name) {
        $$('.nav-item').forEach(n => n.classList.remove('active'));
        $$('.screen').forEach(s => s.classList.remove('active'));
        const navItem = $(`[data-screen="${name}"]`);
        const screen = $(`#screen-${name}`);
        if (navItem) navItem.classList.add('active');
        if (screen) {
            screen.classList.add('active');
            if (name === 'history') renderHistory();
            if (name === 'dashboard') {
                requestAnimationFrame(() => {
                    renderDashboardFromData(state.analyzedData);
                });
            }
            if (name === 'editor') {
                if (state.parsedData && state.parsedData.length > 0) {
                    if (editorData.length === 0) editorData = state.parsedData.map(r => ({...r}));
                    if (state.uploadedFiles[0]) editorFileName = state.uploadedFiles[0].name.replace(/\.[^.]+$/, '');
                    renderEditorTable(editorData);
                }
            }
        }
    }

    // ---- Date Badge ----
    function setDate() {
        const el = $('#currentDate');
        if (el) {
            el.textContent = new Date().toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
            });
        }
    }

    // ---- File Upload ----
    function initUpload() {
        const dropzone = $('#dropzone');
        const fileInput = $('#fileInput');
        const proceedBtn = $('#proceedBtn');

        dropzone.addEventListener('click', () => fileInput.click());
        dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
        dropzone.addEventListener('drop', (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
        fileInput.addEventListener('change', () => { handleFiles(fileInput.files); fileInput.value = ''; });
        proceedBtn.addEventListener('click', () => generateInsights());
    }

    function handleFiles(fileList) {
        Array.from(fileList).forEach(file => {
            const ext = file.name.split('.').pop().toLowerCase();
            if (!['xlsx', 'xls', 'csv'].includes(ext)) return;
            if (state.uploadedFiles.find(f => f.name === file.name)) return;

            const fileObj = { file, name: file.name, size: file.size, ext, status: 'processing', data: null };
            state.uploadedFiles.push(fileObj);
            renderFileItem(fileObj);
            parseFile(fileObj);
        });
        updateProceedBtn();
    }

    function renderFileItem(fileObj) {
        const list = $('#fileList');
        const item = document.createElement('div');
        item.className = 'file-item';
        item.id = `file-${sanitize(fileObj.name)}`;
        item.innerHTML = `
            <div class="file-icon ${fileObj.ext}">${fileObj.ext}</div>
            <div class="file-info">
                <div class="file-name">${fileObj.name}</div>
                <div class="file-meta">${formatSize(fileObj.size)}</div>
            </div>
            <div class="file-status processing" id="status-${sanitize(fileObj.name)}">
                <svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-dasharray="30 70"/></svg>
                Processing...
            </div>
            <button class="file-view-btn" id="view-${sanitize(fileObj.name)}" onclick="window.TIP.viewFile('${fileObj.name}')" style="display:none;">View</button>
            <button class="file-remove" onclick="window.TIP.removeFile('${fileObj.name}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <div class="file-progress" id="progress-${sanitize(fileObj.name)}" style="width:0%"></div>
        `;
        list.appendChild(item);
        let prog = 0;
        const interval = setInterval(() => {
            prog += Math.random() * 25 + 10;
            if (prog >= 100) { prog = 100; clearInterval(interval); }
            const bar = $(`#progress-${sanitize(fileObj.name)}`);
            if (bar) bar.style.width = prog + '%';
        }, 200);
    }

    function parseFile(fileObj) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.SheetNames[0];
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
                fileObj.data = jsonData;
                fileObj.status = 'success';
                state.parsedData.push(...jsonData);

                addUploadToHistory(fileObj.name, fileObj.size, fileObj.ext, jsonData.length);

                // REAL-TIME: auto-analyze and update dashboard
                state.analyzedData = analyzeData(state.parsedData);
                // If dashboard is currently visible, update it live
                if ($('#screen-dashboard').classList.contains('active')) {
                    requestAnimationFrame(() => renderDashboardFromData(state.analyzedData));
                }

                setTimeout(() => {
                    const statusEl = $(`#status-${sanitize(fileObj.name)}`);
                    if (statusEl) {
                        statusEl.className = 'file-status success';
                        statusEl.innerHTML = `
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                            ${jsonData.length} rows
                        `;
                    }
                    // Show View button
                    const viewBtn = $(`#view-${sanitize(fileObj.name)}`);
                    if (viewBtn) viewBtn.style.display = 'inline-flex';
                    updateProceedBtn();
                }, 800);
            } catch (err) {
                fileObj.status = 'error';
                const statusEl = $(`#status-${sanitize(fileObj.name)}`);
                if (statusEl) {
                    statusEl.className = 'file-status';
                    statusEl.style.color = '#F4726D';
                    statusEl.textContent = 'Parse error';
                }
            }
        };
        reader.readAsArrayBuffer(fileObj.file);
    }

    function updateProceedBtn() {
        const btn = $('#proceedBtn');
        const successFiles = state.uploadedFiles.filter(f => f.status === 'success');
        btn.style.display = successFiles.length > 0 ? 'flex' : 'none';
    }

    window.TIP = {
        removeFile(name) {
            const file = state.uploadedFiles.find(f => f.name === name);
            if (file && file.data) {
                state.parsedData = state.parsedData.filter(row => !file.data.includes(row));
            }
            state.uploadedFiles = state.uploadedFiles.filter(f => f.name !== name);
            const el = $(`#file-${sanitize(name)}`);
            if (el) el.remove();
            updateProceedBtn();
            state.analyzedData = state.parsedData.length > 0 ? analyzeData(state.parsedData) : null;
            if ($('#screen-dashboard').classList.contains('active')) {
                requestAnimationFrame(() => renderDashboardFromData(state.analyzedData));
            }
        },
        viewFile(name) {
            const file = state.uploadedFiles.find(f => f.name === name);
            if (!file || !file.data || file.data.length === 0) return;
            openSheetViewer(file.name, file.data);
        }
    };

    // ============================================
    // DATA ANALYSIS ENGINE
    // ============================================
    function findColumn(headers, keywords) {
        const lHeaders = headers.map(h => h.toLowerCase().replace(/[_\-\s]+/g, ''));
        for (const kw of keywords) {
            const k = kw.toLowerCase().replace(/[_\-\s]+/g, '');
            const idx = lHeaders.findIndex(h => h.includes(k));
            if (idx >= 0) return headers[idx];
        }
        return null;
    }

    function analyzeData(rows) {
        if (!rows || rows.length === 0) return null;
        const headers = Object.keys(rows[0]);
        const revenueCol = findColumn(headers, ['revenue', 'rev', 'sales', 'amount', 'income']);
        const regionCol  = findColumn(headers, ['region', 'zone', 'area', 'state', 'circle', 'location']);
        const planCol    = findColumn(headers, ['plan', 'plantype', 'plan_type', 'segment', 'type', 'category']);
        const subsCol    = findColumn(headers, ['subscriber', 'users', 'user', 'subs', 'customers', 'count']);
        const churnCol   = findColumn(headers, ['churn', 'churnrate', 'churn_rate', 'attrition']);
        const arpuCol    = findColumn(headers, ['arpu', 'avgrevenue', 'avg_revenue']);
        const monthCol   = findColumn(headers, ['month', 'date', 'period', 'time', 'quarter']);

        const toNum = (v) => { if (v == null) return 0; const n = parseFloat(String(v).replace(/[₹,\s%]/g, '')); return isNaN(n) ? 0 : n; };

        let totalRevenue = 0, totalSubs = 0, totalChurnWeighted = 0, totalArpuWeighted = 0;
        let churnCount = 0, arpuCount = 0;
        const revenueByMonth = {}, revenueByRegion = {}, subsByRegion = {}, churnByRegion = {};
        const subsByPlan = {}, revenueByPlan = {};

        rows.forEach(r => {
            if (revenueCol) totalRevenue += toNum(r[revenueCol]);
            if (subsCol) totalSubs += toNum(r[subsCol]);
            if (churnCol) { totalChurnWeighted += toNum(r[churnCol]); churnCount++; }
            if (arpuCol) { totalArpuWeighted += toNum(r[arpuCol]); arpuCount++; }
            if (monthCol && revenueCol) { const m = String(r[monthCol] || 'Unknown'); revenueByMonth[m] = (revenueByMonth[m] || 0) + toNum(r[revenueCol]); }
            if (regionCol) {
                const reg = String(r[regionCol] || 'Unknown');
                if (revenueCol) revenueByRegion[reg] = (revenueByRegion[reg] || 0) + toNum(r[revenueCol]);
                if (subsCol) subsByRegion[reg] = (subsByRegion[reg] || 0) + toNum(r[subsCol]);
                if (churnCol) { if (!churnByRegion[reg]) churnByRegion[reg] = { sum: 0, count: 0 }; churnByRegion[reg].sum += toNum(r[churnCol]); churnByRegion[reg].count++; }
            }
            if (planCol) {
                const plan = String(r[planCol] || 'Unknown');
                if (subsCol) subsByPlan[plan] = (subsByPlan[plan] || 0) + toNum(r[subsCol]);
                if (revenueCol) revenueByPlan[plan] = (revenueByPlan[plan] || 0) + toNum(r[revenueCol]);
            }
        });

        return {
            totalRows: rows.length, headers,
            revenueCol, regionCol, planCol, subsCol, churnCol, arpuCol, monthCol,
            totalRevenue, totalSubs,
            avgChurn: churnCount > 0 ? totalChurnWeighted / churnCount : 0,
            avgArpu: arpuCount > 0 ? totalArpuWeighted / arpuCount : 0,
            revenueByMonth, revenueByRegion, subsByRegion, churnByRegion, subsByPlan, revenueByPlan,
        };
    }

    // ============================================
    // GENERATE INSIGHTS
    // ============================================
    function generateInsights() {
        state.analyzedData = analyzeData(state.parsedData);
        if (state.analyzedData) {
            const fileCount = state.uploadedFiles.filter(f => f.status === 'success').length;
            addAnalysisToHistory(fileCount, state.analyzedData.totalRows, {
                revenue: state.analyzedData.totalRevenue.toFixed(1),
                churn: state.analyzedData.avgChurn.toFixed(1),
            });
            renderInsightsFromData(state.analyzedData);
            renderRecommendationsFromData(state.analyzedData);
        }
        switchScreen('dashboard');
    }

    // ============================================
    // DASHBOARD — DYNAMIC METRIC CARDS
    // Cards adapt labels & values based on
    // which columns exist in the uploaded data
    // ============================================
    function renderDashboardFromData(data) {
        // Helper to set card label + tooltip dynamically
        function setCard(cardId, label, tooltip, value, change) {
            const card = $(`#${cardId}`);
            if (!card) return;
            const labelEl = card.querySelector('.metric-label');
            if (labelEl) {
                // Keep the info icon, replace only text
                const iconSvg = labelEl.querySelector('.info-icon');
                const iconHTML = iconSvg ? ` ${iconSvg.outerHTML}` : '';
                labelEl.innerHTML = label + iconHTML;
            }
            if (tooltip) card.setAttribute('data-tooltip', tooltip);
            const changeEl = card.querySelector('.metric-change');
            if (changeEl && change !== undefined) {
                const isPos = change >= 0;
                changeEl.className = `metric-change ${isPos ? 'positive' : 'negative'}`;
                changeEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="${isPos ? '23 6 13.5 15.5 8.5 10.5 1 18' : '23 18 13.5 8.5 8.5 13.5 1 6'}"/></svg> ${isPos ? '+' : ''}${change}%`;
            }
        }

        if (!data) {
            // ZERO DEFAULTS — no data uploaded
            $('#metricRevenue').textContent = '₹0';
            $('#metricUsers').textContent = '0';
            $('#metricChurn').textContent = '0%';
            $('#metricARPU').textContent = '₹0';
            setCard('metric-revenue', 'Total Revenue', 'Sum of all revenue from uploaded data');
            setCard('metric-users', 'Total Subscribers', 'Total active users across all plans');
            setCard('metric-churn', 'Churn Rate', '% of users leaving. Lower is better');
            setCard('metric-arpu', 'ARPU', 'Avg revenue per user');
            Object.values(state.charts).forEach(c => { if (c) c.destroy(); });
            state.charts = {};
            ['revenueChart', 'segmentChart', 'regionChart'].forEach(id => {
                const ctx = $(`#${id}`);
                if (ctx) { const c2d = ctx.getContext('2d'); c2d.clearRect(0, 0, ctx.width, ctx.height); }
            });
            const insightsList = $('#insightsList');
            if (insightsList) insightsList.innerHTML = '<div class="insight-item"><span class="insight-icon">📊</span><span class="insight-text">Upload data files to see AI-generated insights here.</span></div>';
            return;
        }

        // ---- CARD 1: Revenue or primary numeric metric ----
        if (data.revenueCol) {
            setCard('metric-revenue', data.revenueCol, `Sum of "${data.revenueCol}" column`);
            animateValue('metricRevenue', 0, data.totalRevenue, 1200, (v) => smartRevenue(v));
        } else {
            setCard('metric-revenue', 'Total Records', 'Total data rows in uploaded files');
            animateValue('metricRevenue', 0, data.totalRows, 1000, (v) => formatNumber(Math.round(v)));
        }

        // ---- CARD 2: Subscribers or row count ----
        if (data.subsCol) {
            setCard('metric-users', data.subsCol, `Sum of "${data.subsCol}" column`);
            animateValue('metricUsers', 0, data.totalSubs, 1200, (v) => formatNumber(Math.round(v)));
        } else {
            const regionCount = Object.keys(data.revenueByRegion).length;
            if (data.regionCol && regionCount > 0) {
                setCard('metric-users', 'Regions', `Unique "${data.regionCol}" values`);
                animateValue('metricUsers', 0, regionCount, 800, (v) => Math.round(v).toString());
            } else {
                setCard('metric-users', 'Data Rows', 'Total records in uploaded files');
                animateValue('metricUsers', 0, data.totalRows, 1000, (v) => formatNumber(Math.round(v)));
            }
        }

        // ---- CARD 3: Churn or plan segments ----
        if (data.churnCol) {
            setCard('metric-churn', data.churnCol, `Average of "${data.churnCol}" column`);
            animateValue('metricChurn', 0, data.avgChurn, 1000, (v) => `${v.toFixed(1)}%`);
        } else {
            const planCount = Object.keys(data.subsByPlan).length;
            if (data.planCol && planCount > 0) {
                setCard('metric-churn', 'Plan Types', `Unique "${data.planCol}" values`);
                animateValue('metricChurn', 0, planCount, 800, (v) => Math.round(v).toString());
            } else {
                setCard('metric-churn', 'Columns', 'Number of data columns detected');
                animateValue('metricChurn', 0, data.headers.length, 800, (v) => Math.round(v).toString());
            }
        }

        // ---- CARD 4: ARPU or month count ----
        if (data.arpuCol) {
            setCard('metric-arpu', data.arpuCol, `Average of "${data.arpuCol}" column`);
            animateValue('metricARPU', 0, data.avgArpu, 1000, (v) => smartRevenue(v));
        } else if (data.revenueCol && data.subsCol && data.totalSubs > 0) {
            setCard('metric-arpu', 'Calc. ARPU', 'Revenue ÷ Subscribers');
            const calcArpu = data.totalRevenue / data.totalSubs * 10000000;
            animateValue('metricARPU', 0, calcArpu, 1000, (v) => smartRevenue(v));
        } else {
            const monthCount = Object.keys(data.revenueByMonth).length;
            if (data.monthCol && monthCount > 0) {
                setCard('metric-arpu', 'Periods', `Unique "${data.monthCol}" values`);
                animateValue('metricARPU', 0, monthCount, 800, (v) => Math.round(v).toString());
            } else {
                setCard('metric-arpu', 'Files', 'Successfully uploaded files');
                const fileCount = state.uploadedFiles.filter(f => f.status === 'success').length;
                animateValue('metricARPU', 0, fileCount, 800, (v) => Math.round(v).toString());
            }
        }

        renderRevenueChart(data);
        renderSegmentChart(data);
        renderRegionChart(data);
        renderARPUChart(data);
        renderChurnHeatChart(data);
        renderScatterChart(data);
        renderPlanRevChart(data);
        populateFilterDropdowns(data);
    }

    function animateValue(id, start, end, duration, formatter) {
        const el = $(`#${id}`);
        if (!el) return;
        const startTime = performance.now();
        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = start + (end - start) * eased;
            el.textContent = formatter(current);
            if (progress < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    }

    function formatNumber(n) {
        if (n >= 10000000) return (n / 10000000).toFixed(2) + ' Cr';
        if (n >= 100000) return (n / 100000).toFixed(2) + ' L';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return n.toLocaleString();
    }

    // Smart revenue display — auto-selects best unit
    function smartRevenue(v) {
        if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`;
        if (v >= 100000) return `₹${(v / 100000).toFixed(2)} L`;
        if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
        if (v >= 1) return `₹${v.toFixed(2)}`;
        return `₹${v.toFixed(2)}`;
    }

    // ---- Charts ----
    function renderRevenueChart(data) {
        const ctx = $('#revenueChart');
        if (!ctx) return;
        if (state.charts.revenue) state.charts.revenue.destroy();
        let labels, values;
        const monthEntries = Object.entries(data.revenueByMonth);
        if (monthEntries.length > 1) {
            labels = monthEntries.map(e => e[0]);
            values = monthEntries.map(e => parseFloat(e[1].toFixed(1)));
        } else {
            const regEntries = Object.entries(data.revenueByRegion);
            labels = regEntries.map(e => e[0]);
            values = regEntries.map(e => parseFloat(e[1].toFixed(1)));
        }
        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 260);
        gradient.addColorStop(0, 'rgba(79, 142, 247, 0.15)');
        gradient.addColorStop(1, 'rgba(79, 142, 247, 0.0)');
        state.charts.revenue = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets: [{ label: 'Revenue', data: values, borderColor: '#4F8EF7', backgroundColor: gradient, borderWidth: 2.5, pointRadius: 4, pointBackgroundColor: '#4F8EF7', pointBorderColor: '#fff', pointBorderWidth: 2, pointHitRadius: 20, pointHoverRadius: 7, fill: true, tension: 0.4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1F2937', titleFont: { family: 'Inter', size: 12 }, bodyFont: { family: 'Inter', size: 13, weight: '600' }, padding: 12, cornerRadius: 10, displayColors: false, callbacks: { label: (c) => `₹${c.parsed.y} Cr` } } }, scales: { x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11 }, color: '#9BA3B5' } }, y: { grid: { color: '#F1F3F9' }, border: { display: false }, ticks: { font: { family: 'Inter', size: 11 }, color: '#9BA3B5', callback: (v) => `₹${v}` } } }, interaction: { intersect: false, mode: 'index' } }
        });
    }

    function renderSegmentChart(data) {
        const ctx = $('#segmentChart');
        if (!ctx) return;
        if (state.charts.segment) state.charts.segment.destroy();
        let labels, values;
        const planEntries = Object.entries(data.subsByPlan);
        if (planEntries.length > 0) {
            labels = planEntries.map(e => e[0]);
            const total = planEntries.reduce((s, e) => s + e[1], 0);
            values = planEntries.map(e => parseFloat(((e[1] / total) * 100).toFixed(1)));
        } else {
            const revPlanEntries = Object.entries(data.revenueByPlan);
            if (revPlanEntries.length > 0) {
                labels = revPlanEntries.map(e => e[0]);
                const total = revPlanEntries.reduce((s, e) => s + e[1], 0);
                values = revPlanEntries.map(e => parseFloat(((e[1] / total) * 100).toFixed(1)));
            } else { labels = ['N/A']; values = [100]; }
        }
        const colors = ['#4F8EF7', '#6C63FF', '#2ECDA7', '#F5A623', '#F4726D', '#9BA3B5', '#a78bfa', '#34d399'];
        state.charts.segment = new Chart(ctx, {
            type: 'doughnut',
            data: { labels, datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length), borderWidth: 0, hoverOffset: 8 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, borderRadius: 3, useBorderRadius: true, padding: 16, font: { family: 'Inter', size: 11.5, weight: '500' }, color: '#6B7280' } }, tooltip: { backgroundColor: '#1F2937', titleFont: { family: 'Inter', size: 12 }, bodyFont: { family: 'Inter', size: 13, weight: '600' }, padding: 12, cornerRadius: 10, callbacks: { label: (c) => ` ${c.label}: ${c.parsed}%` } } } }
        });
    }

    function renderRegionChart(data) {
        const ctx = $('#regionChart');
        if (!ctx) return;
        if (state.charts.region) state.charts.region.destroy();
        const regionEntries = Object.entries(data.revenueByRegion).sort((a, b) => b[1] - a[1]);
        const labels = regionEntries.map(e => e[0]);
        const values = regionEntries.map(e => parseFloat(e[1].toFixed(1)));
        const barColors = ['rgba(79,142,247,0.85)', 'rgba(108,99,255,0.85)', 'rgba(46,205,167,0.85)', 'rgba(245,166,35,0.85)', 'rgba(244,114,109,0.85)', 'rgba(155,163,181,0.6)', 'rgba(167,139,250,0.8)', 'rgba(52,211,153,0.8)'];
        state.charts.region = new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets: [{ label: 'Revenue (₹ Cr)', data: values, backgroundColor: barColors.slice(0, labels.length), borderRadius: 8, borderSkipped: false, barPercentage: 0.55 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1F2937', titleFont: { family: 'Inter', size: 12 }, bodyFont: { family: 'Inter', size: 13, weight: '600' }, padding: 12, cornerRadius: 10, displayColors: false, callbacks: { label: (c) => `₹${c.parsed.y} Cr` } } }, scales: { x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11 }, color: '#9BA3B5' } }, y: { grid: { color: '#F1F3F9' }, border: { display: false }, ticks: { font: { family: 'Inter', size: 11 }, color: '#9BA3B5', callback: (v) => `₹${v}` } } } }
        });
    }

    // ---- ARPU Trend Chart ----
    function renderARPUChart(data) {
        const ctx = $('#arpuChart'); if (!ctx) return;
        if (state.charts.arpu) state.charts.arpu.destroy();
        const months = Object.entries(data.revenueByMonth);
        if (months.length < 2 && data.avgArpu === 0) return;
        const labels = months.length > 1 ? months.map(e => e[0]) : Object.keys(data.revenueByRegion);
        const values = months.length > 1
            ? months.map(e => data.totalSubs > 0 ? parseFloat((e[1] / data.totalSubs * 10000000).toFixed(0)) : data.avgArpu)
            : Object.values(data.revenueByRegion).map(() => parseFloat(data.avgArpu.toFixed(0)));
        const chartType = (ctx.closest('.chart-card')?.dataset.chartType) || 'line';
        state.charts.arpu = new Chart(ctx, {
            type: chartType === 'area' ? 'line' : chartType,
            data: { labels, datasets: [{ label: 'ARPU (₹)', data: values, borderColor: '#2ECDA7', backgroundColor: chartType === 'bar' ? 'rgba(46,205,167,0.75)' : 'rgba(46,205,167,0.1)', borderWidth: 2.5, pointRadius: 4, pointBackgroundColor: '#2ECDA7', fill: chartType !== 'bar', tension: 0.4, borderRadius: chartType === 'bar' ? 8 : 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1F2937', padding: 12, cornerRadius: 10, displayColors: false, callbacks: { label: c => `₹${c.parsed.y}` } } }, scales: { x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11 }, color: '#9BA3B5' } }, y: { grid: { color: '#F1F3F9' }, border: { display: false }, ticks: { font: { family: 'Inter', size: 11 }, color: '#9BA3B5', callback: v => `₹${v}` } } } }
        });
    }

    // ---- Churn Heatmap / Regional Churn Bar ----
    function renderChurnHeatChart(data) {
        const ctx = $('#churnHeatChart'); if (!ctx) return;
        if (state.charts.churnHeat) state.charts.churnHeat.destroy();
        if (!data.churnCol || Object.keys(data.churnByRegion).length === 0) return;
        const entries = Object.entries(data.churnByRegion).map(([r, v]) => ({ region: r, churn: v.sum / v.count })).sort((a, b) => b.churn - a.churn);
        const labels = entries.map(e => e.region);
        const values = entries.map(e => parseFloat(e.churn.toFixed(2)));
        const chartType = (ctx.closest('.chart-card')?.dataset.chartType) || 'bar';
        const colors = values.map(v => v > data.avgChurn ? 'rgba(244,114,109,0.8)' : 'rgba(46,205,167,0.8)');
        state.charts.churnHeat = new Chart(ctx, {
            type: chartType === 'radar' ? 'radar' : 'bar',
            data: { labels, datasets: [{ label: 'Churn %', data: values, backgroundColor: chartType === 'radar' ? 'rgba(244,114,109,0.2)' : colors, borderColor: chartType === 'radar' ? '#F4726D' : colors, borderWidth: 2, borderRadius: chartType === 'bar' ? 6 : 0 }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1F2937', padding: 12, cornerRadius: 10, callbacks: { label: c => `${c.parsed.x || c.parsed.y}%` } } }, scales: chartType === 'radar' ? {} : { x: { grid: { color: '#F1F3F9' }, ticks: { callback: v => `${v}%`, color: '#9BA3B5', font: { size: 11 } } }, y: { grid: { display: false }, ticks: { color: '#9BA3B5', font: { size: 11 } } } } }
        });
    }

    // ---- Revenue vs Churn Scatter ----
    function renderScatterChart(data) {
        const ctx = $('#scatterChart'); if (!ctx) return;
        if (state.charts.scatter) state.charts.scatter.destroy();
        if (!data.churnCol || Object.keys(data.revenueByRegion).length === 0) return;
        const points = Object.keys(data.revenueByRegion).map(r => ({
            x: parseFloat((data.revenueByRegion[r] || 0).toFixed(2)),
            y: data.churnByRegion[r] ? parseFloat((data.churnByRegion[r].sum / data.churnByRegion[r].count).toFixed(2)) : 0,
            label: r
        }));
        state.charts.scatter = new Chart(ctx, {
            type: 'scatter',
            data: { datasets: [{ label: 'Regions', data: points, backgroundColor: '#4F8EF7', borderColor: '#fff', borderWidth: 2, pointRadius: 8, pointHoverRadius: 11 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1F2937', padding: 12, cornerRadius: 10, callbacks: { label: c => `${c.raw.label}: Rev ₹${c.raw.x} Cr | Churn ${c.raw.y}%` } } }, scales: { x: { title: { display: true, text: 'Revenue (₹ Cr)', color: '#9BA3B5', font: { size: 11 } }, grid: { color: '#F1F3F9' }, ticks: { color: '#9BA3B5' } }, y: { title: { display: true, text: 'Churn Rate (%)', color: '#9BA3B5', font: { size: 11 } }, grid: { color: '#F1F3F9' }, ticks: { color: '#9BA3B5', callback: v => `${v}%` } } } }
        });
    }

    // ---- Plan Revenue Chart ----
    function renderPlanRevChart(data) {
        const ctx = $('#planRevChart'); if (!ctx) return;
        if (state.charts.planRev) state.charts.planRev.destroy();
        const entries = Object.entries(data.revenueByPlan).sort((a, b) => b[1] - a[1]);
        if (entries.length === 0) return;
        const labels = entries.map(e => e[0]);
        const values = entries.map(e => parseFloat(e[1].toFixed(2)));
        const colors = ['rgba(79,142,247,0.85)', 'rgba(108,99,255,0.85)', 'rgba(46,205,167,0.85)', 'rgba(245,166,35,0.85)', 'rgba(244,114,109,0.85)', 'rgba(155,163,181,0.6)'];
        const chartType = (ctx.closest('.chart-card')?.dataset.chartType) || 'bar';
        state.charts.planRev = new Chart(ctx, {
            type: chartType,
            data: { labels, datasets: [{ label: 'Revenue (₹ Cr)', data: values, backgroundColor: colors.slice(0, labels.length), borderWidth: 0, borderRadius: chartType === 'bar' ? 8 : 0, hoverOffset: chartType !== 'bar' ? 8 : 0 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: chartType === 'doughnut' ? '65%' : undefined, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 14, font: { size: 11.5, family: 'Inter' }, color: '#6B7280' } }, tooltip: { backgroundColor: '#1F2937', padding: 12, cornerRadius: 10, callbacks: { label: c => ` ${c.label}: ₹${c.parsed?.y ?? c.parsed} Cr` } } }, scales: chartType === 'bar' ? { x: { grid: { display: false }, ticks: { color: '#9BA3B5', font: { size: 11 } } }, y: { grid: { color: '#F1F3F9' }, border: { display: false }, ticks: { color: '#9BA3B5', callback: v => `₹${v}` } } } : {} }
        });
    }

    // ============================================
    // CHART TYPE SWITCHER
    // ============================================
    const chartDataCache = {}; // stores last data per canvasId

    function initChartTypeSwitchers() {
        $$('.chart-type-btns').forEach(group => {
            const targetId = group.dataset.target;
            group.querySelectorAll('.ctype-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    group.querySelectorAll('.ctype-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const type = btn.dataset.type;
                    const card = btn.closest('.chart-card');
                    if (card) card.dataset.chartType = type;
                    const d = state.analyzedData;
                    if (!d) return;
                    if (targetId === 'revenueChart') renderRevenueChart(d);
                    else if (targetId === 'segmentChart') renderSegmentChart(d);
                    else if (targetId === 'regionChart') renderRegionChart(d);
                    else if (targetId === 'arpuChart') renderARPUChart(d);
                    else if (targetId === 'churnHeatChart') renderChurnHeatChart(d);
                    else if (targetId === 'planRevChart') renderPlanRevChart(d);
                });
            });
        });
    }

    // ============================================
    // GLOBAL DASHBOARD FILTERS
    // ============================================
    const filterState = { period: 'all', region: 'all', plan: 'all' };

    function populateFilterDropdowns(data) {
        const regionSel = $('#regionFilterSelect');
        const planSel = $('#planFilterSelect');
        if (!regionSel || !planSel) return;
        const regions = Object.keys(data.revenueByRegion);
        const plans = Object.keys(data.subsByPlan);
        regionSel.innerHTML = '<option value="all">All Regions</option>' + regions.map(r => `<option value="${r}">${r}</option>`).join('');
        planSel.innerHTML = '<option value="all">All Plans</option>' + plans.map(p => `<option value="${p}">${p}</option>`).join('');
    }

    function getFilteredData() {
        let rows = state.parsedData;
        const d = state.analyzedData;
        if (!d || rows.length === 0) return rows;
        if (filterState.region !== 'all' && d.regionCol) rows = rows.filter(r => String(r[d.regionCol] || '') === filterState.region);
        if (filterState.plan !== 'all' && d.planCol) rows = rows.filter(r => String(r[d.planCol] || '') === filterState.plan);
        if (filterState.period !== 'all' && d.monthCol) {
            const allMonths = [...new Set(state.parsedData.map(r => String(r[d.monthCol] || '')))].filter(Boolean);
            const cutoff = allMonths.slice(-parseInt(filterState.period));
            rows = rows.filter(r => cutoff.includes(String(r[d.monthCol] || '')));
        }
        return rows;
    }

    function applyGlobalFilters() {
        const filtered = getFilteredData();
        const reanalyzed = analyzeData(filtered);
        if (reanalyzed) {
            renderRevenueChart(reanalyzed);
            renderSegmentChart(reanalyzed);
            renderRegionChart(reanalyzed);
            renderARPUChart(reanalyzed);
            renderChurnHeatChart(reanalyzed);
            renderScatterChart(reanalyzed);
            renderPlanRevChart(reanalyzed);
            renderInsightsFromData(reanalyzed);
        }
    }

    function initGlobalFilters() {
        $$('[data-period]').forEach(btn => {
            btn.addEventListener('click', () => {
                $$('[data-period]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                filterState.period = btn.dataset.period;
                applyGlobalFilters();
            });
        });
        const regionSel = $('#regionFilterSelect');
        const planSel = $('#planFilterSelect');
        if (regionSel) regionSel.addEventListener('change', () => { filterState.region = regionSel.value; applyGlobalFilters(); });
        if (planSel) planSel.addEventListener('change', () => { filterState.plan = planSel.value; applyGlobalFilters(); });
        const resetBtn = $('#filterResetBtn');
        if (resetBtn) resetBtn.addEventListener('click', () => {
            filterState.period = 'all'; filterState.region = 'all'; filterState.plan = 'all';
            $$('[data-period]').forEach(b => { b.classList.toggle('active', b.dataset.period === 'all'); });
            if (regionSel) regionSel.value = 'all';
            if (planSel) planSel.value = 'all';
            applyGlobalFilters();
        });
    }

    // ============================================
    // FULLSCREEN CHART MODAL
    // ============================================
    let fullscreenChartInstance = null;

    function initFullscreenModal() {
        const closeBtn = $('#closeFullscreen');
        const modal = $('#fullscreenModal');
        if (closeBtn) closeBtn.addEventListener('click', closeFullscreenModal);
        if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeFullscreenModal(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal?.style.display === 'flex') closeFullscreenModal(); });
    }

    function closeFullscreenModal() {
        const modal = $('#fullscreenModal');
        if (modal) modal.style.display = 'none';
        if (fullscreenChartInstance) { fullscreenChartInstance.destroy(); fullscreenChartInstance = null; }
    }


    // ---- Recommendations ----
    function renderRecommendationsFromData(data) {
        const grid = $('#recoGrid');
        if (!grid) return;
        const recos = [];
        if (data.avgChurn > 3) recos.push({ icon: '💳', priority: 'high', title: 'Launch retention campaign for high-churn segments', desc: `Average churn is ${data.avgChurn.toFixed(1)}%. Target at-risk users with cashbacks.`, impact: 'Reduce churn ~1.5%', effort: 'Low' });
        if (Object.keys(data.churnByRegion).length > 0) {
            let worst = '', worstVal = 0;
            for (const [r, v] of Object.entries(data.churnByRegion)) { const avg = v.sum / v.count; if (avg > worstVal) { worstVal = avg; worst = r; } }
            if (worstVal > data.avgChurn + 1) recos.push({ icon: '🔄', priority: 'high', title: `Activate churn prevention in ${worst}`, desc: `${worst} has ${worstVal.toFixed(1)}% churn — ${(worstVal - data.avgChurn).toFixed(1)}% above average.`, impact: `Reduce ${worst} churn 2%`, effort: 'Medium' });
        }
        if (Object.keys(data.revenueByRegion).length > 1) {
            const sorted = Object.entries(data.revenueByRegion).sort((a, b) => b[1] - a[1]);
            recos.push({ icon: '📡', priority: 'high', title: `Boost investment in ${sorted[sorted.length-1][0]}`, desc: `${sorted[sorted.length-1][0]} generates ₹${sorted[sorted.length-1][1].toFixed(1)} Cr vs ${sorted[0][0]}'s ₹${sorted[0][1].toFixed(1)} Cr.`, impact: `Est. ₹${((sorted[0][1] - sorted[sorted.length-1][1]) * 0.2).toFixed(0)} Cr uplift`, effort: 'High' });
        }
        if (Object.keys(data.subsByPlan).length > 1) recos.push({ icon: '📱', priority: 'medium', title: 'Migrate top segment users to premium plans', desc: 'Create upgrade paths with first-month discounts to drive ARPU growth.', impact: 'ARPU uplift 15-20%', effort: 'Medium' });
        if (data.avgArpu > 0 && data.avgArpu < 250) recos.push({ icon: '💰', priority: 'medium', title: 'Implement data bundle upselling', desc: `Current ARPU of ₹${Math.round(data.avgArpu)} can be improved with personalized bundles.`, impact: 'ARPU +₹30-50', effort: 'Low' });
        recos.push({ icon: '🤝', priority: 'medium', title: 'Bundle OTT partnerships for retention', desc: 'Bundled entertainment reduces churn by 35% per industry data.', impact: 'Churn reduction ~2%', effort: 'Medium' });
        recos.push({ icon: '📊', priority: 'low', title: 'Implement AI-driven dynamic pricing', desc: 'Adjust plan costs based on regional demand and competition.', impact: '5-8% margin gain', effort: 'High' });
        recos.push({ icon: '🎯', priority: 'low', title: 'Launch subscriber referral program', desc: 'Incentivize referrals with data rewards for organic growth.', impact: '5-8K new subs/mo', effort: 'Low' });

        $('#recoTotal').textContent = recos.length;
        $('#recoHigh').textContent = recos.filter(r => r.priority === 'high').length;
        $('#recoMedium').textContent = recos.filter(r => r.priority === 'medium').length;
        $('#recoLow').textContent = recos.filter(r => r.priority === 'low').length;

        grid.innerHTML = recos.map(r => `
            <div class="reco-card priority-${r.priority}" data-priority="${r.priority}">
                <div class="reco-card-header"><div class="reco-card-icon">${r.icon}</div><span class="reco-priority-tag ${r.priority}">${r.priority}</span></div>
                <div class="reco-card-title">${r.title}</div>
                <div class="reco-card-desc">${r.desc}</div>
                <div class="reco-card-meta">
                    <span class="reco-impact"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg> ${r.impact}</span>
                    <span class="reco-impact"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${r.effort} effort</span>
                    <button class="reco-action-btn">View Details</button>
                </div>
            </div>
        `).join('');
        $$('.reco-filters .chip').forEach(chip => {
            chip.addEventListener('click', () => {
                $$('.reco-filters .chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                const filter = chip.dataset.filter;
                $$('.reco-card').forEach(card => { card.style.display = (filter === 'all' || card.dataset.priority === filter) ? '' : 'none'; });
            });
        });
    }

    // ============================================
    // AI CHAT — ADVANCED LLM INTEGRATION
    // With conversation memory, raw data context,
    // computed statistics, and domain expertise
    // ============================================

    // Conversation memory — stores full chat history for multi-turn context
    const conversationHistory = [];

    function initChat() {
        const input = $('#chatInput');
        const sendBtn = $('#chatSendBtn');

        input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
        sendBtn.addEventListener('click', sendMessage);
        $$('.suggestion-chip').forEach(chip => { chip.addEventListener('click', () => { input.value = chip.dataset.question; sendMessage(); }); });

        // API key settings
        const settingsBtn = $('#apiSettingsBtn');
        const modal = $('#apiKeyModal');
        const saveBtn = $('#saveApiKey');
        const closeBtn = $('#closeApiModal');
        const keyInput = $('#apiKeyInput');
        const providerSelect = $('#llmProviderSelect');

        const authModal = $('#adminAuthModal');
        const googleAuthBtn = $('#googleAuthBtn');
        const closeAuthBtn = $('#closeAuthModal');
        
        if (closeAuthBtn) closeAuthBtn.addEventListener('click', () => { if (authModal) authModal.style.display = 'none'; });
        if (authModal) authModal.addEventListener('click', (e) => { if (e.target === authModal) authModal.style.display = 'none'; });
        
        if (googleAuthBtn) googleAuthBtn.addEventListener('click', () => {
            // Open the simulated SSO popup page
            const w = 450;
            const h = 600;
            const left = (window.screen.width / 2) - (w / 2);
            const top = (window.screen.height / 2) - (h / 2);
            const ssoPopup = window.open('sso.html', 'Google Sign In', `width=${w},height=${h},top=${top},left=${left},toolbar=no,menubar=no,scrollbars=no,resizable=no`);
            
            // Listen for the cross-window message from sso.html
            const authListener = (event) => {
                if (event.data === 'google_auth_success') {
                    // Success! Grant admin privileges
                    sessionStorage.setItem('tip_admin_auth', 'true');
                    if (authModal) authModal.style.display = 'none';
                    if (modal) {
                        modal.style.display = 'flex';
                        keyInput.value = state.llmApiKey;
                        providerSelect.value = state.llmProvider;
                    }
                    window.removeEventListener('message', authListener);
                }
            };
            window.addEventListener('message', authListener);
        });

        if (settingsBtn) settingsBtn.addEventListener('click', () => {
            if (sessionStorage.getItem('tip_admin_auth') !== 'true') {
                if (authModal) authModal.style.display = 'flex';
                return;
            }
            modal.style.display = 'flex';
            keyInput.value = state.llmApiKey;
            providerSelect.value = state.llmProvider;
        });
        if (closeBtn) closeBtn.addEventListener('click', () => modal.style.display = 'none');
        if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
        if (saveBtn) saveBtn.addEventListener('click', () => {
            state.llmApiKey = keyInput.value.trim();
            state.llmProvider = providerSelect.value;
            localStorage.setItem('tip_llm_key', state.llmApiKey);
            localStorage.setItem('tip_llm_provider', state.llmProvider);
            modal.style.display = 'none';
            const statusEl = $('#apiStatus');
            if (statusEl) {
                statusEl.textContent = state.llmApiKey ? '✅ API key saved — LLM connected' : '⚠️ No API key — using local AI';
                statusEl.style.display = 'block';
                setTimeout(() => statusEl.style.display = 'none', 3000);
            }
        });
    }

    async function sendMessage() {
        const input = $('#chatInput');
        const text = input.value.trim();
        if (!text) return;

        const welcome = $('.chat-welcome');
        if (welcome) welcome.style.display = 'none';

        appendMessage('user', text);
        input.value = '';
        input.style.height = 'auto';
        addChatToHistory(text);

        // Add to conversation memory
        conversationHistory.push({ role: 'user', content: text });

        const typingId = appendTyping();

        try {
            let response;
            if (state.llmApiKey) {
                response = await callLLM(text);
            } else {
                await delay(800 + Math.random() * 600);
                response = generateLocalResponse(text);
            }
            removeTyping(typingId);
            appendMessage('assistant', response);

            // Store assistant response in conversation memory
            conversationHistory.push({ role: 'assistant', content: response.replace(/<[^>]*>/g, '') });
            // Keep last 20 messages for context window
            while (conversationHistory.length > 20) conversationHistory.shift();
        } catch (err) {
            removeTyping(typingId);
            const errMsg = `<strong>⚠️ Connection Error</strong><br><br>${err.message}<br><br>💡 <strong>Quick fixes:</strong><br>• Check your API key in <strong>LLM Settings</strong> (⚙️)<br>• Try a different provider (Groq is free)<br>• The local AI can still answer basic questions without an API key`;
            appendMessage('assistant', errMsg);
        }
    }

    function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

    // ============================================
    // BUILD DEEP DATA CONTEXT FOR LLM
    // Includes raw data, computed stats, trends
    // ============================================
    function buildDataContext() {
        const d = state.analyzedData;
        if (!d) return 'STATUS: No telecom data has been uploaded yet. Ask the user to upload their CSV/Excel files first.';

        const rows = state.parsedData;
        const toNum = (v) => { if (v == null) return 0; const n = parseFloat(String(v).replace(/[₹,\s%]/g, '')); return isNaN(n) ? 0 : n; };

        // ---- Section 1: Summary Statistics ----
        let context = `
=== TELECOM DATASET OVERVIEW ===
Total records: ${d.totalRows}
Columns: ${d.headers.join(', ')}
Files uploaded: ${state.uploadedFiles.filter(f => f.status === 'success').map(f => f.name).join(', ')}

=== KEY METRICS (computed from uploaded data) ===
• Total Revenue: ₹${d.totalRevenue.toFixed(2)} Cr
• Total Subscribers: ${d.totalSubs > 0 ? d.totalSubs.toLocaleString() : 'N/A'}
• Average Churn Rate: ${d.avgChurn.toFixed(2)}%
• Average ARPU: ₹${d.avgArpu.toFixed(0)}
`;

        // ---- Section 2: Revenue breakdown ----
        if (Object.keys(d.revenueByMonth).length > 0) {
            const months = Object.entries(d.revenueByMonth);
            const values = months.map(e => e[1]);
            const firstVal = values[0], lastVal = values[values.length - 1];
            const growth = firstVal > 0 ? (((lastVal - firstVal) / firstVal) * 100) : 0;
            context += `
=== REVENUE TREND (Monthly) ===
${months.map(([m, v]) => `${m}: ₹${v.toFixed(2)} Cr`).join('\n')}
Peak month: ${months.find(e => e[1] === Math.max(...values))?.[0]} (₹${Math.max(...values).toFixed(2)} Cr)
Lowest month: ${months.find(e => e[1] === Math.min(...values))?.[0]} (₹${Math.min(...values).toFixed(2)} Cr)
Growth rate (first→last): ${growth.toFixed(1)}%
Monthly average: ₹${(values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)} Cr
`;
        }

        // ---- Section 3: Regional analysis ----
        if (Object.keys(d.revenueByRegion).length > 0) {
            const regions = Object.entries(d.revenueByRegion).sort((a, b) => b[1] - a[1]);
            const totalRev = regions.reduce((s, e) => s + e[1], 0);
            context += `
=== REGIONAL PERFORMANCE ===
${regions.map(([r, v], i) => {
    const subs = d.subsByRegion[r] || 0;
    const churn = d.churnByRegion[r] ? (d.churnByRegion[r].sum / d.churnByRegion[r].count).toFixed(1) : 'N/A';
    const share = ((v / totalRev) * 100).toFixed(1);
    return `${i + 1}. ${r}: Revenue ₹${v.toFixed(2)} Cr (${share}% share) | Subs: ${subs.toLocaleString()} | Churn: ${churn}%`;
}).join('\n')}
Revenue concentration: Top 3 regions = ${((regions.slice(0, 3).reduce((s, e) => s + e[1], 0) / totalRev) * 100).toFixed(0)}% of total
`;
        }

        // ---- Section 4: Churn deep-dive ----
        if (Object.keys(d.churnByRegion).length > 0) {
            const churnData = Object.entries(d.churnByRegion).map(([r, v]) => ({ region: r, churn: v.sum / v.count })).sort((a, b) => b.churn - a.churn);
            const highChurn = churnData.filter(c => c.churn > d.avgChurn);
            context += `
=== CHURN ANALYSIS ===
Overall average churn: ${d.avgChurn.toFixed(2)}%
${churnData.map(c => `${c.region}: ${c.churn.toFixed(2)}% ${c.churn > d.avgChurn ? '⚠️ ABOVE AVG' : '✅ BELOW AVG'}`).join('\n')}
Regions above average churn: ${highChurn.map(c => c.region).join(', ') || 'None'}
Churn spread (max - min): ${(churnData[0].churn - churnData[churnData.length - 1].churn).toFixed(2)}%
`;
        }

        // ---- Section 5: Plan/Segment analysis ----
        if (Object.keys(d.subsByPlan).length > 0) {
            const plans = Object.entries(d.subsByPlan).sort((a, b) => b[1] - a[1]);
            const totalSubs = plans.reduce((s, e) => s + e[1], 0);
            context += `
=== USER SEGMENTATION (by Plan Type) ===
${plans.map(([p, v]) => {
    const rev = d.revenueByPlan[p] || 0;
    const revPerUser = v > 0 ? (rev / v * 10000000).toFixed(0) : 0; // Convert Cr to per-user
    return `${p}: ${v.toLocaleString()} subs (${((v / totalSubs) * 100).toFixed(1)}%) | Revenue: ₹${rev.toFixed(2)} Cr | Rev/user: ₹${revPerUser}`;
}).join('\n')}
`;
        }

        // ---- Section 6: RAW DATA SAMPLE (for detailed queries) ----
        if (rows.length > 0) {
            // Send first 5 rows + every nth row to give LLM variety
            const sampleSize = Math.min(30, rows.length);
            const step = Math.max(1, Math.floor(rows.length / sampleSize));
            const sampleRows = [];
            for (let i = 0; i < rows.length && sampleRows.length < sampleSize; i += step) {
                sampleRows.push(rows[i]);
            }
            context += `
=== RAW DATA SAMPLE (${sampleRows.length} of ${rows.length} rows) ===
${JSON.stringify(sampleRows, null, 0)}
`;
        }

        // ---- Section 7: Cross-analysis insights ----
        if (d.revenueCol && d.churnCol && d.regionCol) {
            context += `
=== COMPUTED CORRELATIONS & INSIGHTS ===
`;
            // Revenue vs Churn per region
            const regionData = Object.keys(d.revenueByRegion).map(r => ({
                region: r,
                revenue: d.revenueByRegion[r] || 0,
                churn: d.churnByRegion[r] ? d.churnByRegion[r].sum / d.churnByRegion[r].count : 0,
                subs: d.subsByRegion[r] || 0,
            }));

            const highRevLowChurn = regionData.filter(r => r.revenue > d.totalRevenue / Object.keys(d.revenueByRegion).length && r.churn < d.avgChurn);
            const lowRevHighChurn = regionData.filter(r => r.revenue < d.totalRevenue / Object.keys(d.revenueByRegion).length && r.churn > d.avgChurn);

            if (highRevLowChurn.length > 0) context += `Star performers (high revenue + low churn): ${highRevLowChurn.map(r => r.region).join(', ')}\n`;
            if (lowRevHighChurn.length > 0) context += `Problem areas (low revenue + high churn): ${lowRevHighChurn.map(r => r.region).join(', ')}\n`;

            // Revenue per subscriber by region
            const revPerSub = regionData.filter(r => r.subs > 0).map(r => ({
                region: r.region,
                revPerSub: (r.revenue / r.subs * 10000000).toFixed(0) // Cr to per-user
            })).sort((a, b) => b.revPerSub - a.revPerSub);
            if (revPerSub.length > 0) context += `Revenue per subscriber: ${revPerSub.map(r => `${r.region}: ₹${r.revPerSub}`).join(', ')}\n`;
        }

        return context.trim();
    }

    // ============================================
    // LLM API CALL — with full context & memory
    // ============================================
    async function callLLM(userQuestion) {
        const dataContext = buildDataContext();

        const systemPrompt = `You are TIP AI — an elite telecom data analyst and strategic advisor. You have deep expertise in telecommunications, data analytics, customer retention, revenue optimization, and market strategy.

CORE CAPABILITIES:
1. STATISTICAL ANALYSIS — correlation, trend detection, percentile analysis, growth forecasting
2. CUSTOMER INTELLIGENCE — churn prediction, segmentation, lifetime value, behavioral patterns
3. REVENUE OPTIMIZATION — ARPU enhancement, pricing strategy, regional performance
4. STRATEGIC ADVISORY — actionable recommendations with ROI estimates, competitive insights
5. REAL-TIME DATA — all answers MUST reference the actual uploaded data below, not hypothetical data

RESPONSE FORMAT:
- Use HTML formatting: <strong> for bold, <br> for line breaks
- Structure with clear headings and bullet points (use • character)
- Include specific numbers from the data (never make up or hallucinate data)
- End with actionable recommendations or next steps
- Keep responses comprehensive but focused (300-500 words ideal)
- Use emojis sparingly for visual anchoring: 📈 📉 💡 ⚠️ 🎯 ✅

IMPORTANT RULES:
- ALWAYS base answers on the actual data provided below
- If asked something not in the data, clearly state what is and isn't available
- For statistical questions, show your calculations
- For business questions, provide data-backed reasoning
- Support follow-up questions using conversation context
- If the user asks a general telecom question, answer using industry knowledge AND relate it back to their specific data

${dataContext}`;

        const provider = state.llmProvider;
        let apiUrl, headers, body;

        // Build message array with conversation history
        const messages = [{ role: 'system', content: systemPrompt }];

        // Add conversation history (last 16 messages for context window)
        const recentHistory = conversationHistory.slice(-16);
        recentHistory.forEach(msg => {
            messages.push({ role: msg.role, content: msg.content });
        });

        // Add current question if not already the last message
        if (messages[messages.length - 1]?.content !== userQuestion) {
            messages.push({ role: 'user', content: userQuestion });
        }

        if (provider === 'groq') {
            apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
            headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.llmApiKey}` };
            body = JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages,
                temperature: 0.6,
                max_tokens: 2048,
                top_p: 0.9,
            });
        } else if (provider === 'openai') {
            apiUrl = 'https://api.openai.com/v1/chat/completions';
            headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.llmApiKey}` };
            body = JSON.stringify({
                model: 'gpt-4o-mini',
                messages,
                temperature: 0.6,
                max_tokens: 2048,
            });
        } else if (provider === 'gemini') {
            // Gemini needs a different format — combine system + history into a single conversation
            const geminiContents = [];
            // System instruction as first user message context
            const systemText = systemPrompt;

            // Build alternating user/model turns for Gemini
            // First turn includes system prompt
            let isFirstUser = true;
            for (const msg of messages.slice(1)) { // skip system message
                if (msg.role === 'user') {
                    const prefix = isFirstUser ? systemText + '\n\n---\nUser Question: ' : '';
                    isFirstUser = false;
                    geminiContents.push({ role: 'user', parts: [{ text: prefix + msg.content }] });
                } else if (msg.role === 'assistant') {
                    geminiContents.push({ role: 'model', parts: [{ text: msg.content }] });
                }
            }

            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${state.llmApiKey}`;
            headers = { 'Content-Type': 'application/json' };
            body = JSON.stringify({
                contents: geminiContents,
                generationConfig: { temperature: 0.6, maxOutputTokens: 2048, topP: 0.9 }
            });
        }

        const res = await fetch(apiUrl, { method: 'POST', headers, body });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error?.message || `API returned ${res.status}`);
        }

        const json = await res.json();
        let answer = '';

        if (provider === 'gemini') {
            answer = json.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini.';
        } else {
            answer = json.choices?.[0]?.message?.content || 'No response received.';
        }

        // Convert markdown formatting to HTML
        answer = answer
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/^### (.*$)/gm, '<strong style="font-size:1.05em">$1</strong>')
            .replace(/^## (.*$)/gm, '<strong style="font-size:1.1em">$1</strong>')
            .replace(/^# (.*$)/gm, '<strong style="font-size:1.15em">$1</strong>')
            .replace(/^- /gm, '• ')
            .replace(/\n/g, '<br>');

        return answer;
    }

    // ---- Enhanced Local AI fallback (no API key) ----
    function generateLocalResponse(question) {
        const q = question.toLowerCase();
        const d = state.analyzedData;

        if (!d) {
            return `<strong>📊 No Data Uploaded Yet</strong><br><br>Upload your telecom data (CSV/Excel) from the <strong>Upload</strong> screen to enable analysis.<br><br><strong>What I can analyze:</strong><br>• Revenue trends & regional performance<br>• Churn rate analysis & predictions<br>• User segmentation & ARPU<br>• Custom queries about your data<br><br>💡 <strong>Pro tip:</strong> Connect a free LLM via ⚙️ <strong>LLM Settings</strong> for advanced conversational AI (Groq is free!)`;
        }

        // Churn questions
        if (q.includes('churn') || q.includes('retention') || q.includes('attrition')) {
            let detail = '';
            if (Object.keys(d.churnByRegion).length > 0) {
                const sorted = Object.entries(d.churnByRegion).map(([r, v]) => ({ r, c: v.sum / v.count })).sort((a, b) => b.c - a.c);
                detail = sorted.map(({ r, c }) => `• <strong>${r}:</strong> ${c.toFixed(1)}% ${c > d.avgChurn ? '⚠️' : '✅'}`).join('<br>');
            }
            return `<strong>📉 Churn Rate Analysis</strong><br><br>Average churn: <strong>${d.avgChurn.toFixed(1)}%</strong> ${d.avgChurn > 5 ? '(⚠️ High — industry avg is 2-3%)' : d.avgChurn > 3 ? '(moderate)' : '(✅ Healthy)'}<br><br>${detail ? '<strong>By Region:</strong><br>' + detail + '<br><br>' : ''}<strong>💡 Recommendations:</strong><br>• Target high-churn regions with loyalty rewards<br>• Implement early warning system for at-risk users<br>• Bundle OTT services (reduces churn by ~35%)<br><br><em>🔗 Connect an LLM (⚙️) for deeper predictive analysis</em>`;
        }

        // Revenue questions
        if (q.includes('revenue')) {
            if (q.includes('region') || q.includes('top') || q.includes('best') || q.includes('worst')) {
                const sorted = Object.entries(d.revenueByRegion).sort((a, b) => b[1] - a[1]);
                const total = sorted.reduce((s, e) => s + e[1], 0);
                const detail = sorted.map(([r, v], i) => `${['🥇', '🥈', '🥉'][i] || '•'} <strong>${r}:</strong> ₹${v.toFixed(1)} Cr (${((v / total) * 100).toFixed(1)}%)`).join('<br>');
                const gap = sorted[0][1] - sorted[sorted.length - 1][1];
                return `<strong>🗺️ Revenue by Region</strong><br><br>Total: <strong>₹${total.toFixed(1)} Cr</strong><br><br>${detail}<br><br>📊 <strong>Gap analysis:</strong> ₹${gap.toFixed(1)} Cr between top and bottom regions.<br>💡 Invest in ${sorted[sorted.length - 1][0]} — even 20% gap closure = ₹${(gap * 0.2).toFixed(1)} Cr uplift.`;
            }
            if (q.includes('trend') || q.includes('month') || q.includes('growth')) {
                const months = Object.entries(d.revenueByMonth);
                if (months.length > 1) {
                    const values = months.map(e => e[1]);
                    const growth = ((values[values.length - 1] - values[0]) / values[0] * 100);
                    const detail = months.map(([m, v]) => `• <strong>${m}:</strong> ₹${v.toFixed(1)} Cr`).join('<br>');
                    return `<strong>📈 Revenue Trend</strong><br><br>${detail}<br><br>📊 Peak: <strong>₹${Math.max(...values).toFixed(1)} Cr</strong> | Low: <strong>₹${Math.min(...values).toFixed(1)} Cr</strong><br>📈 Overall growth: <strong>${growth.toFixed(1)}%</strong> (${growth > 0 ? '↗️ positive' : '↘️ declining'})`;
                }
            }
            return `<strong>💰 Revenue Overview</strong><br><br>Total: <strong>₹${d.totalRevenue.toFixed(1)} Cr</strong> across ${d.totalRows} records<br>Regions: <strong>${Object.keys(d.revenueByRegion).length}</strong><br>Months: <strong>${Object.keys(d.revenueByMonth).length}</strong><br><br>Ask me about <em>"revenue by region"</em>, <em>"revenue trends"</em>, or <em>"growth rate"</em> for deeper analysis.`;
        }

        // Segment/plan questions
        if (q.includes('prepaid') || q.includes('postpaid') || q.includes('5g') || q.includes('segment') || q.includes('plan') || q.includes('user')) {
            const plans = Object.entries(d.subsByPlan).sort((a, b) => b[1] - a[1]);
            if (plans.length > 0) {
                const total = plans.reduce((s, e) => s + e[1], 0);
                const detail = plans.map(([p, v]) => {
                    const rev = d.revenueByPlan[p] || 0;
                    return `📱 <strong>${p}:</strong> ${formatNumber(v)} users (${((v / total) * 100).toFixed(0)}%) — Revenue: ₹${rev.toFixed(1)} Cr`;
                }).join('<br>');
                return `<strong>📱 User Segmentation</strong><br><br>Total subscribers: <strong>${formatNumber(total)}</strong><br><br>${detail}<br><br>💡 <strong>Strategy:</strong> Migrate ${plans[0][0]} users to premium plans with first-month discounts for ARPU growth.`;
            }
        }

        // ARPU questions
        if (q.includes('arpu') || q.includes('average revenue per')) {
            return `<strong>💰 ARPU Analysis</strong><br><br>Average ARPU: <strong>₹${Math.round(d.avgArpu)}</strong><br><br>${d.avgArpu > 250 ? '✅ Above industry average (₹150-200)' : d.avgArpu > 150 ? '📊 Within industry range' : '⚠️ Below industry average — optimize pricing'}<br><br><strong>To improve ARPU:</strong><br>• Personalized data bundle upselling<br>• Value-added services (OTT, cloud storage)<br>• Dynamic pricing based on usage patterns<br>• Premium plan migration campaigns`;
        }

        // Comparison / vs questions
        if (q.includes('compare') || q.includes('vs') || q.includes('versus') || q.includes('difference')) {
            return `<strong>📊 Data Comparison</strong><br><br>• Revenue: <strong>₹${d.totalRevenue.toFixed(1)} Cr</strong><br>• Subscribers: <strong>${formatNumber(d.totalSubs)}</strong><br>• Churn: <strong>${d.avgChurn.toFixed(1)}%</strong><br>• ARPU: <strong>₹${Math.round(d.avgArpu)}</strong><br>• Regions: <strong>${Object.keys(d.revenueByRegion).length}</strong><br>• Segments: <strong>${Object.keys(d.subsByPlan).length}</strong><br><br>🔗 Connect an LLM (⚙️) for advanced comparative analysis with industry benchmarks!`;
        }

        // Summary / overview / help
        return `<strong>📊 Telecom Intelligence Summary</strong><br><br>Your dataset: <strong>${d.totalRows} records</strong><br><br>• 💰 Revenue: <strong>₹${d.totalRevenue.toFixed(1)} Cr</strong><br>• 👥 Subscribers: <strong>${d.totalSubs > 0 ? formatNumber(d.totalSubs) : d.totalRows + ' rows'}</strong><br>• 📉 Churn: <strong>${d.avgChurn.toFixed(1)}%</strong><br>• 💵 ARPU: <strong>₹${Math.round(d.avgArpu)}</strong><br>• 🗺️ Regions: <strong>${Object.keys(d.revenueByRegion).length}</strong><br>• 📱 Segments: <strong>${Object.keys(d.subsByPlan).length}</strong><br><br><strong>Try asking:</strong><br>• <em>"Analyze churn rate by region"</em><br>• <em>"Which region has the highest revenue?"</em><br>• <em>"Show revenue growth trends"</em><br>• <em>"Compare prepaid vs postpaid"</em><br>• <em>"What strategies can reduce churn?"</em><br><br>🚀 <strong>Upgrade tip:</strong> Connect a free LLM via ⚙️ for advanced analysis, forecasting, and strategic recommendations!`;
    }

    function appendMessage(role, text) {
        const container = $('#chatMessages');
        const msg = document.createElement('div');
        msg.className = `chat-msg ${role}`;
        msg.innerHTML = `<div class="chat-avatar">${role === 'user' ? 'HB' : '⚡'}</div><div class="chat-bubble">${text}</div>`;
        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
    }

    function appendTyping() {
        const container = $('#chatMessages');
        const id = 'typing-' + Date.now();
        const msg = document.createElement('div');
        msg.className = 'chat-msg assistant';
        msg.id = id;
        msg.innerHTML = `<div class="chat-avatar">⚡</div><div class="chat-bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;
        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
        return id;
    }

    function removeTyping(id) { const el = $(`#${id}`); if (el) el.remove(); }

    // ============================================
    // HELPERS
    // ============================================
    function sanitize(str) { return str.replace(/[^a-zA-Z0-9]/g, '_'); }
    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(2) + ' MB';
    }

    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
    `;
    document.head.appendChild(style);

    // ============================================
    // HISTORY MODULE
    // ============================================
    const HISTORY_KEY = 'tip_history';
    function getHistory() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || { uploads: [], activities: [], chatCount: 0, totalRows: 0 }; } catch { return { uploads: [], activities: [], chatCount: 0, totalRows: 0 }; } }
    function saveHistory(h) { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch {} }

    function addUploadToHistory(fileName, fileSize, ext, rowCount) {
        const h = getHistory();
        if (h.uploads.find(u => u.name === fileName && (Date.now() - u.timestamp) < 60000)) return;
        h.uploads.unshift({ name: fileName, size: fileSize, ext, rows: rowCount, timestamp: Date.now() });
        if (h.uploads.length > 50) h.uploads = h.uploads.slice(0, 50);
        h.totalRows += rowCount;
        h.activities.unshift({ type: 'upload', title: `Uploaded ${fileName}`, desc: `${rowCount} rows • ${formatSize(fileSize)}`, timestamp: Date.now() });
        if (h.activities.length > 100) h.activities = h.activities.slice(0, 100);
        saveHistory(h);
    }

    function addAnalysisToHistory(fileCount, totalRows, metrics) {
        const h = getHistory();
        h.activities.unshift({ type: 'analysis', title: `Analyzed ${fileCount} file${fileCount > 1 ? 's' : ''}`, desc: `${totalRows} rows • Revenue: ₹${metrics.revenue} Cr • Churn: ${metrics.churn}%`, timestamp: Date.now() });
        if (h.activities.length > 100) h.activities = h.activities.slice(0, 100);
        saveHistory(h);
    }

    function addChatToHistory(question) {
        const h = getHistory();
        h.chatCount++;
        h.activities.unshift({ type: 'chat', title: 'AI Query', desc: question.length > 80 ? question.substring(0, 80) + '...' : question, timestamp: Date.now() });
        if (h.activities.length > 100) h.activities = h.activities.slice(0, 100);
        saveHistory(h);
    }

    function formatTimeAgo(ts) {
        const diff = Date.now() - ts;
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
        return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function renderHistory(dayFilter) {
        const h = getHistory();
        const now = Date.now();
        const msFilter = dayFilter ? dayFilter * 86400000 : Infinity;

        // Filter data by time range
        const filteredUploads = h.uploads.filter(u => (now - u.timestamp) < msFilter);
        const filteredActivities = h.activities.filter(a => (now - a.timestamp) < msFilter);

        // Stats (always show totals)
        $('#histTotalFiles').textContent = h.uploads.length;
        $('#histTotalSessions').textContent = h.activities.filter(a => a.type === 'analysis').length;
        $('#histTotalChats').textContent = h.chatCount;
        $('#histTotalRows').textContent = h.totalRows > 1000 ? (h.totalRows / 1000).toFixed(1) + 'K' : h.totalRows;

        // Uploads list
        const uploadList = $('#historyUploadList');
        const uploadsEmpty = $('#historyUploadsEmpty');
        uploadList.querySelectorAll('.history-upload-item').forEach(el => el.remove());
        if (filteredUploads.length > 0) {
            if (uploadsEmpty) uploadsEmpty.style.display = 'none';
            filteredUploads.slice(0, 15).forEach((u, i) => {
                const item = document.createElement('div');
                item.className = 'history-upload-item';
                item.style.animationDelay = `${i * 0.05}s`;
                item.innerHTML = `<div class="history-file-icon ${u.ext}">${u.ext}</div><div class="history-file-info"><div class="history-file-name">${u.name}</div><div class="history-file-details"><span>${formatSize(u.size)}</span><span>${formatTimeAgo(u.timestamp)}</span></div></div><div class="history-file-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>${u.rows} rows</div>`;
                uploadList.appendChild(item);
            });
        } else { if (uploadsEmpty) uploadsEmpty.style.display = 'flex'; }

        // Timeline
        const timeline = $('#historyTimeline');
        const timelineEmpty = $('#historyTimelineEmpty');
        timeline.querySelectorAll('.timeline-item').forEach(el => el.remove());
        if (filteredActivities.length > 0) {
            if (timelineEmpty) timelineEmpty.style.display = 'none';
            filteredActivities.slice(0, 20).forEach((a, i) => {
                const item = document.createElement('div');
                item.className = 'timeline-item';
                item.style.animationDelay = `${i * 0.04}s`;
                item.innerHTML = `<div class="timeline-dot ${a.type}"></div><div class="timeline-content"><div class="timeline-header"><span class="timeline-title">${a.title}</span><span class="timeline-time">${formatTimeAgo(a.timestamp)}</span></div><div class="timeline-desc">${a.desc}</div></div>`;
                timeline.appendChild(item);
            });
        } else { if (timelineEmpty) timelineEmpty.style.display = 'flex'; }
    }

    let currentHistoryFilter = null;

    function initHistory() {
        // Clear all
        const clearBtn = $('#clearHistoryBtn');
        if (clearBtn) clearBtn.addEventListener('click', () => {
            if (confirm('Clear all history?')) {
                localStorage.removeItem(HISTORY_KEY);
                renderHistory();
            }
        });

        // Time filter chips
        $$('[data-history-filter]').forEach(chip => {
            chip.addEventListener('click', () => {
                $$('[data-history-filter]').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                const val = chip.dataset.historyFilter;
                currentHistoryFilter = val === 'all' ? null : parseInt(val);
                renderHistory(currentHistoryFilter);
            });
        });

        renderHistory();
    }

    // ============================================
    // SHEET DATA VIEWER
    // ============================================
    let sheetViewerData = [];

    function openSheetViewer(fileName, data) {
        sheetViewerData = data;
        const viewer = $('#sheetViewer');
        const body = $('#sheetViewerBody');
        const search = $('#sheetSearch');

        $('#sheetViewerFileName').textContent = fileName;
        $('#sheetRowBadge').textContent = `${data.length} rows`;
        if (search) search.value = '';

        renderSheetTable(data);
        viewer.style.display = 'flex';
    }

    function renderSheetTable(data, highlight) {
        const body = $('#sheetViewerBody');
        if (!data || data.length === 0) {
            body.innerHTML = '<div style="padding:40px;text-align:center;color:#9BA3B5;">No data to display</div>';
            return;
        }

        const headers = Object.keys(data[0]);
        const hl = highlight ? highlight.toLowerCase() : '';

        let html = '<table class="sheet-table"><thead><tr><th>#</th>';
        headers.forEach(h => { html += `<th>${h}</th>`; });
        html += '</tr></thead><tbody>';

        data.forEach((row, i) => {
            const rowStr = Object.values(row).join(' ').toLowerCase();
            const isMatch = hl && rowStr.includes(hl);
            const show = !hl || isMatch;
            if (!show) return;
            html += `<tr${isMatch ? ' class="highlight"' : ''}>`;
            html += `<td>${i + 1}</td>`;
            headers.forEach(h => {
                let val = row[h] ?? '';
                html += `<td title="${String(val).replace(/"/g, '&quot;')}">${val}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        body.innerHTML = html;
    }

    function initSheetViewer() {
        const viewer = $('#sheetViewer');
        const closeBtn = $('#closeSheetViewer');
        const search = $('#sheetSearch');

        if (closeBtn) closeBtn.addEventListener('click', () => { viewer.style.display = 'none'; });
        if (viewer) viewer.addEventListener('click', (e) => { if (e.target === viewer) viewer.style.display = 'none'; });

        // Live search with debounce
        let searchTimer;
        if (search) search.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                const q = search.value.trim();
                renderSheetTable(sheetViewerData, q);
                // Update badge with filtered count
                const badge = $('#sheetRowBadge');
                if (q) {
                    const shown = $('#sheetViewerBody').querySelectorAll('tbody tr').length;
                    badge.textContent = `${shown} of ${sheetViewerData.length} rows`;
                } else {
                    badge.textContent = `${sheetViewerData.length} rows`;
                }
            }, 200);
        });

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && viewer.style.display === 'flex') {
                viewer.style.display = 'none';
            }
        });
    }

    // ============================================
    // AI INSIGHTS REFRESH
    // ============================================
    async function fetchAIMarketInsights(data) {
        if (!state.llmApiKey) return [];
        const prompt = `You are a senior telecom analyst. Based on this data summary and your knowledge of market studies, TRAI reports, GSMA data, McKinsey and Ericsson telecom reports, ITU publications, and industry benchmarks, generate exactly 5 actionable INSIGHT bullet points for an Indian telecom operator.

Data: Revenue ₹${data.totalRevenue.toFixed(1)} Cr, Subscribers ${data.totalSubs}, Avg Churn ${data.avgChurn.toFixed(1)}%, ARPU ₹${Math.round(data.avgArpu)}, Regions: ${Object.keys(data.revenueByRegion).join(', ')}, Plan types: ${Object.keys(data.subsByPlan).join(', ')}.

Respond ONLY with a JSON array like:
[{"icon":"📊","text":"<insight here>","source":"<Source Name Year>","type":""},{...}]
Types can be: success, warning, danger, or empty string. No markdown, no explanation — just the JSON array.`;
        try {
            const prevKey = state.llmApiKey;
            const prevProvider = state.llmProvider;
            const tempQuestion = '__ai_insights__';
            const dataContext = `Telecom data summary:\nRevenue: ₹${data.totalRevenue.toFixed(1)} Cr\nChurn: ${data.avgChurn.toFixed(1)}%\nARPU: ₹${Math.round(data.avgArpu)}`;
            const provider = state.llmProvider;
            let apiUrl, headers, body;
            const messages = [{ role: 'system', content: prompt }, { role: 'user', content: 'Generate 5 market insights now.' }];
            if (provider === 'groq') {
                apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
                headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.llmApiKey}` };
                body = JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, temperature: 0.5, max_tokens: 1024 });
            } else if (provider === 'openai') {
                apiUrl = 'https://api.openai.com/v1/chat/completions';
                headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.llmApiKey}` };
                body = JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.5, max_tokens: 1024 });
            } else if (provider === 'gemini') {
                apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${state.llmApiKey}`;
                headers = { 'Content-Type': 'application/json' };
                body = JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt + '\n\nGenerate 5 market insights now.' }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 1024 } });
            }
            const res = await fetch(apiUrl, { method: 'POST', headers, body });
            if (!res.ok) return [];
            const json = await res.json();
            let raw = provider === 'gemini' ? json.candidates?.[0]?.content?.parts?.[0]?.text : json.choices?.[0]?.message?.content;
            raw = (raw || '').trim();
            const match = raw.match(/\[.*\]/s);
            if (!match) return [];
            return JSON.parse(match[0]);
        } catch { return []; }
    }

    async function renderInsightsFromData(data) {
        const list = $('#insightsList');
        if (!list) return;
        const insights = [];
        if (data.totalRevenue > 0) insights.push({ icon: '📈', text: `<strong>Total Revenue: ${smartRevenue(data.totalRevenue)}</strong> across ${data.totalRows} records.`, type: 'success' });
        if (Object.keys(data.revenueByRegion).length > 0) {
            const sorted = Object.entries(data.revenueByRegion).sort((a, b) => b[1] - a[1]);
            insights.push({ icon: '🗺️', text: `<strong>${sorted[0][0]} leads with ${smartRevenue(sorted[0][1])}</strong>, while ${sorted[sorted.length-1][0]} is lowest at ${smartRevenue(sorted[sorted.length-1][1])}.`, type: '' });
        }
        if (data.avgChurn > 0) insights.push({ icon: data.avgChurn > 5 ? '⚠️' : '📉', text: `<strong>Average Churn: ${data.avgChurn.toFixed(1)}%</strong> — ${data.avgChurn > 5 ? 'above benchmark, needs attention.' : 'within acceptable range.'}`, type: data.avgChurn > 5 ? 'warning' : '' });
        if (Object.keys(data.churnByRegion).length > 0) {
            let worst = '', worstVal = 0;
            for (const [r, v] of Object.entries(data.churnByRegion)) { const avg = v.sum / v.count; if (avg > worstVal) { worstVal = avg; worst = r; } }
            if (worstVal > data.avgChurn) insights.push({ icon: '🔴', text: `<strong>${worst} has highest churn at ${worstVal.toFixed(1)}%</strong> — targeted retention recommended.`, type: 'danger' });
        }
        if (Object.keys(data.subsByPlan).length > 0) {
            const plans = Object.entries(data.subsByPlan).sort((a, b) => b[1] - a[1]);
            const total = plans.reduce((s, e) => s + e[1], 0);
            insights.push({ icon: '📱', text: `<strong>${plans[0][0]} is the dominant segment</strong> with ${((plans[0][1] / total) * 100).toFixed(0)}% of subscribers.`, type: 'success' });
        }
        if (data.avgArpu > 0) insights.push({ icon: '💰', text: `<strong>Average ARPU: ₹${Math.round(data.avgArpu)}</strong>. ${data.avgArpu > 200 ? 'Above industry average.' : 'Consider upselling strategies.'}`, type: data.avgArpu > 200 ? 'success' : '' });

        list.innerHTML = insights.map(i => `<div class="insight-item ${i.type}"><span class="insight-icon">${i.icon}</span><div><span class="insight-text">${i.text}</span></div></div>`).join('');

        if (state.llmApiKey) {
            for (let i = 0; i < 3; i++) {
                const sk = document.createElement('div'); sk.className = 'insight-skeleton'; list.appendChild(sk);
            }
            const aiInsights = await fetchAIMarketInsights(data);
            list.querySelectorAll('.insight-skeleton').forEach(s => s.remove());
            aiInsights.forEach(ins => {
                const el = document.createElement('div'); el.className = `insight-item ${ins.type || ''}`;
                el.innerHTML = `<span class="insight-icon">${ins.icon || '🌐'}</span><div><span class="insight-text">${ins.text}</span><span class="insight-source-badge">📚 ${ins.source || 'Market Research'}</span></div>`;
                list.appendChild(el);
            });
        }
    }

    function initInsightsRefresh() {
        const btn = $('#refreshInsightsBtn');
        if (btn) btn.addEventListener('click', async () => {
            if (!state.analyzedData) return;
            btn.textContent = '⏳';
            await renderInsightsFromData(state.analyzedData);
            btn.textContent = '↺';
        });
    }

    // ============================================
    // DATA EDITOR
    // ============================================
    let editorData = [];       // working copy
    let editorHistory = [];    // undo stack
    let editorFuture = [];     // redo stack
    let editorFileName = 'edited_data';
    let editorFilterActive = false;
    let editorFilteredRows = null;

    function editorSnapshot() {
        editorHistory.push(JSON.stringify(editorData));
        if (editorHistory.length > 50) editorHistory.shift();
        editorFuture = [];
    }

    function editorStatus(msg) {
        const el = $('#editorStatus');
        if (!el) return;
        el.textContent = msg; el.classList.add('visible');
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove('visible'), 2500);
    }

    function renderEditorTable(rows) {
        const wrap = $('#editorTableWrap');
        const empty = $('#editorEmpty');
        if (!wrap) return;
        if (!rows || rows.length === 0) {
            if (empty) empty.style.display = 'flex';
            return;
        }
        if (empty) empty.style.display = 'none';
        const headers = Object.keys(rows[0]);

        // Populate sort/filter selects
        const sortSel = $('#editorSortCol');
        const filterSel = $('#editorFilterCol');
        if (sortSel) sortSel.innerHTML = '<option value="">Sort by column...</option>' + headers.map(h => `<option value="${h}">${h}</option>`).join('');
        if (filterSel) filterSel.innerHTML = '<option value="">Filter column...</option>' + headers.map(h => `<option value="${h}">${h}</option>`).join('');

        let html = '<table class="editor-table"><thead><tr>';
        html += '<th><input type="checkbox" id="selectAllRows" class="editor-row-checkbox"></th>';
        headers.forEach(h => {
            html += `<th title="Double-click to rename"><div class="col-header"><span ondblclick="window.TIP.renameColStart(this,'${h}')">${h}</span></div></th>`;
        });
        html += '</tr></thead><tbody>';

        rows.forEach((row, i) => {
            html += `<tr data-row="${i}"><td><input type="checkbox" class="editor-row-checkbox row-check" data-row="${i}"></td>`;
            headers.forEach(h => {
                const val = row[h] ?? '';
                html += `<td><span class="cell-inner" contenteditable="true" data-row="${i}" data-col="${h}" onblur="window.TIP.cellEdit(this)">${String(val).replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span></td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table>';
        wrap.innerHTML = html;

        // Select all checkbox
        const selAll = $('#selectAllRows');
        if (selAll) selAll.addEventListener('change', () => {
            $$('.row-check').forEach(cb => {
                cb.checked = selAll.checked;
                cb.closest('tr').classList.toggle('row-selected', selAll.checked);
            });
        });
        $$('.row-check').forEach(cb => cb.addEventListener('change', () => {
            cb.closest('tr').classList.toggle('row-selected', cb.checked);
        }));
    }

    function initEditor() {
        // Load current data on switch to editor screen
        const origSwitch = switchScreen;

        // Add Row
        const addRowBtn = $('#editorAddRow');
        if (addRowBtn) addRowBtn.addEventListener('click', () => {
            if (editorData.length === 0) return;
            editorSnapshot();
            const headers = Object.keys(editorData[0]);
            const newRow = {}; headers.forEach(h => newRow[h] = '');
            editorData.push(newRow);
            renderEditorTable(editorData);
            editorStatus(`✅ Row added (${editorData.length} rows)`);
        });

        // Add Column
        const addColBtn = $('#editorAddCol');
        if (addColBtn) addColBtn.addEventListener('click', () => {
            if (editorData.length === 0) return;
            const name = prompt('Column name:');
            if (!name || !name.trim()) return;
            editorSnapshot();
            editorData = editorData.map(r => ({ ...r, [name.trim()]: '' }));
            renderEditorTable(editorData);
            editorStatus(`✅ Column "${name.trim()}" added`);
        });

        // Delete Rows
        const delRowBtn = $('#editorDeleteRows');
        if (delRowBtn) delRowBtn.addEventListener('click', () => {
            const selected = [].slice.call($$('.row-check:checked')).map(cb => parseInt(cb.dataset.row));
            if (selected.length === 0) { alert('Select rows to delete (use checkboxes).'); return; }
            editorSnapshot();
            editorData = editorData.filter((_, i) => !selected.includes(i));
            renderEditorTable(editorData);
            editorStatus(`🗑 ${selected.length} row(s) deleted`);
        });

        // Undo
        const undoBtn = $('#editorUndo');
        if (undoBtn) undoBtn.addEventListener('click', () => {
            if (editorHistory.length === 0) return;
            editorFuture.push(JSON.stringify(editorData));
            editorData = JSON.parse(editorHistory.pop());
            renderEditorTable(editorData);
            editorStatus('↩ Undone');
        });

        // Redo
        const redoBtn = $('#editorRedo');
        if (redoBtn) redoBtn.addEventListener('click', () => {
            if (editorFuture.length === 0) return;
            editorHistory.push(JSON.stringify(editorData));
            editorData = JSON.parse(editorFuture.pop());
            renderEditorTable(editorData);
            editorStatus('↪ Redone');
        });

        // Find & Replace toggle
        const findBtn = $('#editorFindReplace');
        const findBar = $('#editorFindBar');
        if (findBtn && findBar) findBtn.addEventListener('click', () => { findBar.style.display = findBar.style.display === 'none' ? 'flex' : 'none'; });
        const closeFindBar = $('#editorCloseFindBar');
        if (closeFindBar) closeFindBar.addEventListener('click', () => { if (findBar) findBar.style.display = 'none'; });

        // Replace All
        const replaceBtn = $('#editorReplaceBtn');
        if (replaceBtn) replaceBtn.addEventListener('click', () => {
            const find = ($('#editorFindInput')?.value || '').toLowerCase();
            const replace = $('#editorReplaceInput')?.value || '';
            if (!find) return;
            editorSnapshot();
            let count = 0;
            editorData = editorData.map(row => {
                const newRow = {};
                for (const [k, v] of Object.entries(row)) {
                    const str = String(v ?? '');
                    if (str.toLowerCase().includes(find)) { newRow[k] = str.replace(new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), replace); count++; }
                    else newRow[k] = v;
                }
                return newRow;
            });
            renderEditorTable(editorData);
            $('#editorFindCount').textContent = `${count} replacement(s) made`;
            editorStatus(`✅ ${count} replacement(s) made`);
        });

        // Sort / Filter toggle
        const sortBtn = $('#editorSort');
        const filterBtn = $('#editorFilter');
        const controlsBar = $('#editorControlsBar');
        if (sortBtn && controlsBar) sortBtn.addEventListener('click', () => { controlsBar.style.display = controlsBar.style.display === 'none' ? 'flex' : 'none'; });
        if (filterBtn && controlsBar) filterBtn.addEventListener('click', () => { controlsBar.style.display = controlsBar.style.display === 'none' ? 'flex' : 'none'; });

        const sortAscBtn = $('#editorSortAsc');
        const sortDescBtn = $('#editorSortDesc');
        if (sortAscBtn) sortAscBtn.addEventListener('click', () => { const col = $('#editorSortCol')?.value; if (!col) return; editorSnapshot(); editorData.sort((a, b) => String(a[col]||'').localeCompare(String(b[col]||''), undefined, { numeric: true })); renderEditorTable(editorData); editorStatus(`↑ Sorted by ${col}`); });
        if (sortDescBtn) sortDescBtn.addEventListener('click', () => { const col = $('#editorSortCol')?.value; if (!col) return; editorSnapshot(); editorData.sort((a, b) => String(b[col]||'').localeCompare(String(a[col]||''), undefined, { numeric: true })); renderEditorTable(editorData); editorStatus(`↓ Sorted by ${col} (desc)`); });

        const applyFilterBtn = $('#editorApplyFilter');
        if (applyFilterBtn) applyFilterBtn.addEventListener('click', () => {
            const col = $('#editorFilterCol')?.value; if (!col) return;
            const op = $('#editorFilterOp')?.value || 'contains';
            const val = ($('#editorFilterVal')?.value || '').toLowerCase();
            editorFilteredRows = editorData.filter(row => {
                const cell = String(row[col] ?? '').toLowerCase();
                if (op === 'contains') return cell.includes(val);
                if (op === 'equals') return cell === val;
                if (op === 'gt') return parseFloat(cell) > parseFloat(val);
                if (op === 'lt') return parseFloat(cell) < parseFloat(val);
                if (op === 'empty') return cell.trim() === '';
                if (op === 'notempty') return cell.trim() !== '';
                return true;
            });
            editorFilterActive = true;
            renderEditorTable(editorFilteredRows);
            editorStatus(`🔍 ${editorFilteredRows.length} rows match filter`);
        });

        const clearFilterBtn = $('#editorClearFilter');
        if (clearFilterBtn) clearFilterBtn.addEventListener('click', () => { editorFilterActive = false; editorFilteredRows = null; renderEditorTable(editorData); editorStatus('Filter cleared'); });

        // Quick clean
        const removeDupesBtn = $('#editorRemoveDupes');
        if (removeDupesBtn) removeDupesBtn.addEventListener('click', () => {
            editorSnapshot();
            const seen = new Set();
            const before = editorData.length;
            editorData = editorData.filter(row => { const key = JSON.stringify(row); if (seen.has(key)) return false; seen.add(key); return true; });
            renderEditorTable(editorData);
            editorStatus(`✅ ${before - editorData.length} duplicate(s) removed`);
        });

        const fillEmptyBtn = $('#editorFillEmpty');
        if (fillEmptyBtn) fillEmptyBtn.addEventListener('click', () => {
            if (editorData.length === 0) return;
            const strategy = prompt('Fill empty cells with:\n1 = zero\n2 = column mean\n3 = custom value\nEnter 1, 2, or 3:');
            if (!strategy) return;
            editorSnapshot();
            const headers = Object.keys(editorData[0]);
            if (strategy === '1') { editorData = editorData.map(r => { const n = {...r}; headers.forEach(h => { if (n[h] === '' || n[h] == null) n[h] = 0; }); return n; }); }
            else if (strategy === '2') {
                const means = {};
                headers.forEach(h => { const nums = editorData.map(r => parseFloat(r[h])).filter(v => !isNaN(v)); means[h] = nums.length ? (nums.reduce((a,b)=>a+b,0)/nums.length).toFixed(2) : ''; });
                editorData = editorData.map(r => { const n = {...r}; headers.forEach(h => { if (n[h] === '' || n[h] == null) n[h] = means[h]; }); return n; });
            } else if (strategy === '3') {
                const custom = prompt('Enter custom fill value:'); if (custom == null) return;
                editorData = editorData.map(r => { const n = {...r}; headers.forEach(h => { if (n[h] === '' || n[h] == null) n[h] = custom; }); return n; });
            }
            renderEditorTable(editorData);
            editorStatus('✅ Empty cells filled');
        });

        const trimBtn = $('#editorTrimSpaces');
        if (trimBtn) trimBtn.addEventListener('click', () => {
            editorSnapshot();
            editorData = editorData.map(r => { const n = {}; for (const [k, v] of Object.entries(r)) n[k] = typeof v === 'string' ? v.trim() : v; return n; });
            renderEditorTable(editorData);
            editorStatus('✂️ Whitespace trimmed');
        });

        // Export CSV
        const csvBtn = $('#editorDownloadCSV');
        if (csvBtn) csvBtn.addEventListener('click', () => {
            if (editorData.length === 0) return;
            const headers = Object.keys(editorData[0]);
            const lines = [headers.join(','), ...editorData.map(r => headers.map(h => `"${String(r[h]??'').replace(/"/g,'""')}"`).join(','))];
            const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = editorFileName + '_edited.csv'; a.click();
            editorStatus('📥 CSV downloaded');
        });

        // Export XLSX
        const xlsxBtn = $('#editorDownloadXLSX');
        if (xlsxBtn) xlsxBtn.addEventListener('click', () => {
            if (editorData.length === 0) return;
            const ws = XLSX.utils.json_to_sheet(editorData);
            const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Data');
            XLSX.writeFile(wb, editorFileName + '_edited.xlsx');
            editorStatus('📥 XLSX downloaded');
        });

        // Apply to Dashboard
        const applyBtn = $('#applyEditorBtn');
        if (applyBtn) applyBtn.addEventListener('click', () => {
            if (editorData.length === 0) return;
            state.parsedData = editorData.map(r => ({...r}));
            state.analyzedData = analyzeData(state.parsedData);
            renderInsightsFromData(state.analyzedData);
            renderRecommendationsFromData(state.analyzedData);
            switchScreen('dashboard');
            editorStatus('✅ Applied to Dashboard');
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', e => {
            const editorActive = $('#screen-editor')?.classList.contains('active');
            if (!editorActive) return;
            if (e.ctrlKey && e.key === 'z') { e.preventDefault(); $('#editorUndo')?.click(); }
            if (e.ctrlKey && e.key === 'y') { e.preventDefault(); $('#editorRedo')?.click(); }
            if (e.ctrlKey && e.key === 'f') { e.preventDefault(); $('#editorFindReplace')?.click(); }
        });
    }

    // Expose cell edit + rename to global scope (needed for inline HTML handlers)
    window.TIP = Object.assign(window.TIP || {}, {
        cellEdit(span) {
            const row = parseInt(span.dataset.row);
            const col = span.dataset.col;
            if (isNaN(row) || !col || !editorData[row]) return;
            const newVal = span.textContent;
            if (String(editorData[row][col] ?? '') === newVal) return;
            editorSnapshot(); editorData[row][col] = newVal;
        },
        renameColStart(span, oldName) {
            const input = document.createElement('input');
            input.className = 'col-rename-input';
            input.value = oldName;
            span.replaceWith(input);
            input.focus(); input.select();
            const finish = () => {
                const newName = input.value.trim() || oldName;
                if (newName !== oldName) {
                    editorSnapshot();
                    editorData = editorData.map(r => { const n = {}; for (const [k, v] of Object.entries(r)) n[k === oldName ? newName : k] = v; return n; });
                    renderEditorTable(editorData);
                    editorStatus(`✅ Column renamed to "${newName}"`);
                } else { renderEditorTable(editorData); }
            };
            input.addEventListener('blur', finish);
            input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } if (e.key === 'Escape') { renderEditorTable(editorData); } });
        },
        downloadChart(canvasId) {
            const canvas = $(`#${canvasId}`);
            if (!canvas) return;
            const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = canvasId + '.png'; a.click();
        },
        fullscreenChart(canvasId, title) {
            const srcCanvas = $(`#${canvasId}`);
            if (!srcCanvas) return;
            const srcChart = Object.values(state.charts).find(c => c && c.canvas === srcCanvas);
            if (!srcChart) return;
            const modal = $('#fullscreenModal');
            const fsCanvas = $('#fullscreenCanvas');
            const fsTitle = $('#fullscreenTitle');
            if (!modal || !fsCanvas) return;
            if (fsTitle) fsTitle.textContent = title || 'Chart';
            if (fullscreenChartInstance) fullscreenChartInstance.destroy();
            fullscreenChartInstance = new Chart(fsCanvas, { type: srcChart.config.type, data: JSON.parse(JSON.stringify(srcChart.config.data)), options: { ...JSON.parse(JSON.stringify(srcChart.config.options)), responsive: true, maintainAspectRatio: false } });
            modal.style.display = 'flex';
        }
    });

    // ---- Theme & Material You Expressive Dark Mode ----
    function initTheme() {
        const toggleBtn = $('#themeToggle');
        if (!toggleBtn) return;
        const sun = toggleBtn.querySelector('.sun-icon');
        const moon = toggleBtn.querySelector('.moon-icon');
        
        const setTheme = (isDark) => {
            document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
            localStorage.setItem('tip_theme', isDark ? 'dark' : 'light');
            if (sun && moon) {
                sun.style.display = isDark ? 'none' : 'block';
                moon.style.display = isDark ? 'block' : 'none';
            }
            
            // Material You Expressive Charts Adaptation
            Chart.defaults.color = isDark ? '#B2B8C6' : '#6B7280';
            Chart.defaults.scale.grid.color = isDark ? '#252830' : '#F1F3F9';
            if (state.charts) {
                Object.values(state.charts).forEach(chart => {
                    if (chart) {
                        if (chart.options.plugins.tooltip) {
                            chart.options.plugins.tooltip.backgroundColor = isDark ? '#1B1D22' : '#1F2937';
                            chart.options.plugins.tooltip.titleColor = isDark ? '#FFFFFF' : '#FFFFFF';
                        }
                        chart.update();
                    }
                });
            }
        };

        // Initialize state based on localStorage or OS Preference
        const saved = localStorage.getItem('tip_theme');
        if (saved) {
            setTheme(saved === 'dark');
        } else {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            setTheme(prefersDark);
        }

        toggleBtn.addEventListener('click', () => {
            const isCurrentlyDark = document.documentElement.getAttribute('data-theme') === 'dark';
            setTheme(!isCurrentlyDark);
        });
    }

    // ---- Initialize ----
    function init() {
        initTheme();
        initNav();
        setDate();
        initUpload();
        initChat();
        initHistory();
        initSheetViewer();
        initChartTypeSwitchers();
        initGlobalFilters();
        initFullscreenModal();
        initInsightsRefresh();
        initEditor();
    }

    // ============================================
    // INIT GATEWAY
    // ============================================
    document.addEventListener('DOMContentLoaded', () => {
        initSupabaseAuth(() => {
            if (!window.__tipAppReady) {
                init();
                window.__tipAppReady = true;
            }
        });
    });
})();
