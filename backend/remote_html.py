# -*- coding: utf-8 -*-
# Embedded HTML dashboard for the LGSS Remote Control Cockpit.
# This prevents PyInstaller packaging issues by keeping the HTML code directly in a python variable.

DASHBOARD_HTML = """<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LGSS Remote Cockpit</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Outfit', sans-serif;
      background-color: #0a0a0c;
      color: #e4e4e7;
      background-image: 
        radial-gradient(at 0% 0%, rgba(230, 81, 0, 0.05) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(212, 163, 115, 0.03) 0px, transparent 50%);
    }
    .glass {
      background: rgba(18, 18, 22, 0.8);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .btn-action {
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .status-led {
      box-shadow: 0 0 10px currentColor;
    }
  </style>
</head>
<body class="min-h-screen flex flex-col p-4 md:p-8 max-w-7xl mx-auto">

  <!-- Toast Alert -->
  <div id="toast" class="fixed top-6 right-6 z-50 transform translate-y-2 opacity-0 pointer-events-none transition-all duration-300 bg-red-900/90 border border-red-700 text-red-200 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2"></div>

  <!-- AUTH SCREEN -->
  <div id="auth-panel" class="flex-1 flex items-center justify-center py-20">
    <div class="w-full max-w-md glass rounded-3xl p-8 shadow-2xl relative overflow-hidden">
      <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-600 to-amber-500"></div>
      
      <div class="text-center mb-8">
        <div class="w-14 h-14 bg-orange-600/10 border border-orange-600/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-orange-500 shadow-lg">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
        </div>
        <h1 class="text-2xl font-extrabold text-white tracking-tight">LGSS REMOTE COCKPIT</h1>
        <p class="text-[10px] font-mono uppercase tracking-widest text-slate-500 mt-1">Uzak Sunucu Kontrol Paneli</p>
      </div>

      <form id="login-form" class="space-y-5">
        <div>
          <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Kullanıcı Adı</label>
          <input type="text" id="username" required class="w-full bg-[#121216] border border-white/5 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/40 text-slate-100 placeholder-slate-600 transition-all" placeholder="admin">
        </div>
        <div>
          <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Şifre</label>
          <input type="password" id="password" required class="w-full bg-[#121216] border border-white/5 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/40 text-slate-100 placeholder-slate-600 transition-all" placeholder="••••••••">
        </div>
        <button type="submit" id="btn-login" class="w-full bg-orange-600 hover:bg-orange-500 text-black font-extrabold py-3.5 px-4 rounded-xl text-xs uppercase tracking-widest transition-all duration-200 shadow-lg active:scale-[0.98] mt-3">Kimlik Doğrula</button>
      </form>
    </div>
  </div>

  <!-- DASHBOARD PANEL -->
  <div id="main-panel" class="hidden flex-1 flex flex-col gap-6">
    <!-- Header -->
    <header class="glass rounded-2xl px-6 py-4 flex items-center justify-between shadow-md">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-orange-600/10 border border-orange-600/30 rounded-xl flex items-center justify-center text-orange-500">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
        </div>
        <div>
          <h2 class="text-sm font-bold text-white tracking-wide">LGSS REMOTE COCKPIT</h2>
          <p class="text-[9px] font-mono uppercase tracking-wider text-slate-500">Dashboard</p>
        </div>
      </div>
      <button onclick="handleLogout()" class="border border-white/5 hover:border-red-700 hover:text-red-400 bg-surface/20 text-xs px-4 py-2 rounded-xl transition-all font-semibold">Çıkış Yap</button>
    </header>

    <!-- Content Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 items-start">
      
      <!-- Servers Column -->
      <div class="lg:col-span-1 space-y-4">
        <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Sunucular</h3>
        <div id="servers-list" class="space-y-4"></div>
      </div>

      <!-- Detail Console Column -->
      <div class="lg:col-span-2 space-y-4">
        <div id="details-card" class="hidden glass rounded-2xl p-6 shadow-md space-y-6">
          <div class="pb-4 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 id="active-server-name" class="text-lg font-black text-white tracking-wide">Sunucu Yükleniyor...</h2>
              <p id="active-server-id" class="text-[10px] font-mono text-slate-500 mt-0.5"></p>
            </div>
            
            <!-- Controls block -->
            <div id="active-server-controls" class="flex flex-wrap items-center gap-2"></div>
          </div>

          <!-- Tabs -->
          <div class="border-b border-white/5 flex gap-2">
            <button id="tab-btn-players" onclick="switchTab('players')" class="px-4 py-2 border-b-2 border-transparent text-xs font-semibold text-slate-400 hover:text-white transition-all uppercase tracking-wider">Oyuncular</button>
            <button id="tab-btn-logs" onclick="switchTab('logs')" class="px-4 py-2 border-b-2 border-transparent text-xs font-semibold text-slate-400 hover:text-white transition-all uppercase tracking-wider">Sohbet & Loglar</button>
          </div>

          <!-- Tab Content: Players -->
          <div id="tab-content-players" class="hidden space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Çevrimiçi Oyuncular</span>
              <button onclick="refreshActiveData()" class="text-xs text-orange-500 hover:text-orange-400 flex items-center gap-1.5 font-mono uppercase tracking-wider font-bold">Yenile</button>
            </div>
            <div id="players-container" class="space-y-2 max-h-[400px] overflow-y-auto pr-1"></div>
          </div>

          <!-- Tab Content: Logs -->
          <div id="tab-content-logs" class="hidden space-y-4">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <!-- Filters -->
              <div class="flex flex-wrap gap-1.5" id="log-filters">
                <button onclick="setLogFilter('all')" id="btn-filter-all" class="text-[9px] font-bold px-2.5 py-1.5 rounded-lg border border-white/5 bg-[#141418] hover:border-orange-500/35 transition-all text-slate-300">TÜMÜ</button>
                <button onclick="setLogFilter('chat')" id="btn-filter-chat" class="text-[9px] font-bold px-2.5 py-1.5 rounded-lg border border-white/5 bg-[#141418] hover:border-orange-500/35 transition-all text-slate-300">SOHBET</button>
                <button onclick="setLogFilter('kill')" id="btn-filter-kill" class="text-[9px] font-bold px-2.5 py-1.5 rounded-lg border border-white/5 bg-[#141418] hover:border-orange-500/35 transition-all text-slate-300">ÖLÜM</button>
                <button onclick="setLogFilter('admin')" id="btn-filter-admin" class="text-[9px] font-bold px-2.5 py-1.5 rounded-lg border border-white/5 bg-[#141418] hover:border-orange-500/35 transition-all text-slate-300">ADMİN</button>
              </div>
              <button onclick="refreshActiveData()" class="text-xs text-orange-500 hover:text-orange-400 flex items-center gap-1.5 font-mono uppercase tracking-wider font-bold self-end md:self-auto">Yenile</button>
            </div>
            <div id="logs-container" class="font-mono text-xs bg-[#07070a]/90 p-4 border border-white/5 rounded-2xl max-h-[400px] overflow-y-auto space-y-2 scrollbar-thin"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    let token = localStorage.getItem("remote_token") || "";
    let servers = [];
    let activeServerId = "";
    let activeTab = "players";
    let logFilter = "all";
    let apiBusy = false;

    // Toast show helper
    function showToast(msg, duration = 4000) {
      const el = document.getElementById("toast");
      el.innerText = msg;
      el.classList.remove("opacity-0", "translate-y-2", "pointer-events-none");
      el.classList.add("opacity-100", "translate-y-0");
      setTimeout(() => {
        el.classList.remove("opacity-100", "translate-y-0");
        el.classList.add("opacity-0", "translate-y-2", "pointer-events-none");
      }, duration);
    }

    // Toggle screen views
    function updateViews() {
      if (token) {
        document.getElementById("auth-panel").style.display = "none";
        document.getElementById("main-panel").style.display = "flex";
      } else {
        document.getElementById("auth-panel").style.display = "flex";
        document.getElementById("main-panel").style.display = "none";
      }
    }

    // Handle authentication
    document.getElementById("login-form").onsubmit = async (e) => {
      e.preventDefault();
      const u = document.getElementById("username").value.trim();
      const p = document.getElementById("password").value.trim();
      const btn = document.getElementById("btn-login");
      
      btn.disabled = true;
      btn.innerText = "Kimlik Doğrulanıyor...";
      
      try {
        const res = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: u, password: p })
        });
        
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.detail || "Geçersiz giriş bilgileri");
        }
        
        const data = await res.json();
        token = data.token;
        localStorage.setItem("remote_token", token);
        updateViews();
        await loadServers();
      } catch (err) {
        showToast(err.message);
      } finally {
        btn.disabled = false;
        btn.innerText = "Kimlik Doğrulanır";
      }
    };

    // Logout
    function handleLogout() {
      token = "";
      localStorage.removeItem("remote_token");
      updateViews();
    }

    // Fetch servers list
    async function loadServers(autoSelect = true) {
      if (!token) return;
      try {
        const res = await fetch("/api/servers", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.status === 401) {
          handleLogout();
          return;
        }
        servers = await res.json();
        renderServers();
        
        if (autoSelect && servers.length > 0 && !activeServerId) {
          selectServer(servers[0].id);
        }
      } catch (err) {
        showToast("Sunucular yüklenirken hata oluştu");
      }
    }

    // Select active server
    function selectServer(id) {
      activeServerId = id;
      const srv = servers.find(s => s.id === id);
      if (!srv) return;
      
      document.getElementById("details-card").classList.remove("hidden");
      document.getElementById("active-server-name").innerText = srv.name;
      document.getElementById("active-server-id").innerText = `ID: ${srv.id}`;
      
      renderActiveControls(srv);
      renderServers(); // redraw to update selected highlight
      switchTab(activeTab);
    }

    // Render active server control buttons
    function renderActiveControls(srv) {
      const container = document.getElementById("active-server-controls");
      const isRunning = srv.status === "Running";
      const isStopped = srv.status === "Stopped";
      
      container.innerHTML = `
        <button onclick="triggerAction('start')" ${!isStopped || apiBusy ? "disabled" : ""} class="btn-action bg-green-950/40 border border-green-700/40 text-green-400 hover:bg-green-900/35 hover:border-green-600 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed">BAŞLAT</button>
        <button onclick="triggerAction('stop')" ${!isRunning || apiBusy ? "disabled" : ""} class="btn-action bg-red-950/40 border border-red-700/40 text-red-400 hover:bg-red-900/35 hover:border-red-600 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed">DURDUR</button>
        <button onclick="triggerAction('restart')" ${!isRunning || apiBusy ? "disabled" : ""} class="btn-action bg-orange-950/40 border border-orange-700/40 text-orange-400 hover:bg-orange-900/35 hover:border-orange-600 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed">YENİDEN BAŞLAT</button>
      `;
    }

    // Trigger action (start/stop/restart)
    async function triggerAction(action) {
      if (!activeServerId || apiBusy) return;
      apiBusy = true;
      const srv = servers.find(s => s.id === activeServerId);
      if (srv) renderActiveControls({ ...srv, status: "Busy" });
      
      try {
        const res = await fetch(`/api/servers/${activeServerId}/${action}`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.detail || `İşlem başarısız oldu (${action})`);
        }
        showToast("Komut başarıyla gönderildi", 3000);
      } catch (err) {
        showToast(err.message);
      } finally {
        apiBusy = false;
        await loadServers(false);
        const updated = servers.find(s => s.id === activeServerId);
        if (updated) selectServer(activeServerId);
      }
    }

    // Render servers list
    function renderServers() {
      const container = document.getElementById("servers-list");
      container.innerHTML = "";
      
      servers.forEach(s => {
        const isSelected = s.id === activeServerId;
        const colorMap = {
          "Running": "text-green-400 bg-green-500/10 border-green-500/20",
          "Stopped": "text-zinc-500 bg-zinc-500/10 border-zinc-500/20",
          "Starting": "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
          "Updating": "text-blue-500 bg-blue-500/10 border-blue-500/20"
        };
        const ledColor = {
          "Running": "var(--success)",
          "Stopped": "var(--text-muted)",
          "Starting": "var(--warning)",
          "Updating": "var(--info)"
        };
        const statusColorClass = colorMap[s.status] || colorMap["Stopped"];
        const statusTextMap = { "Running": "ONLİNE", "Stopped": "OFFLİNE", "Starting": "BAŞLATILIYOR", "Updating": "GÜNCELLENİYOR" };
        const statusText = statusTextMap[s.status] || "OFFLİNE";

        const card = document.createElement("div");
        card.onclick = () => selectServer(s.id);
        card.className = `p-4.5 rounded-2xl transition-all duration-200 cursor-pointer border shadow-sm ${isSelected ? "border-orange-500 bg-orange-600/5 shadow-orange-950/20" : "border-white/5 bg-surface/20 hover:border-white/10 hover:bg-surface/30"}`;
        
        card.innerHTML = `
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <h4 class="text-sm font-bold text-white truncate">${s.name || s.folder_name}</h4>
              <p class="text-[10px] font-mono text-slate-500 truncate mt-0.5">PORT: ${s.game_port || "—"}</p>
            </div>
            <div class="flex items-center gap-2 px-2.5 py-1.5 border rounded-xl font-mono text-[9px] font-bold ${statusColorClass}">
              <span class="w-1.5 h-1.5 rounded-full status-led" style="background-color: ${s.status === "Running" ? "#4ade80" : s.status === "Starting" ? "#fbbf24" : s.status === "Updating" ? "#60a5fa" : "#71717a"}"></span>
              ${statusText}
            </div>
          </div>
        `;
        container.appendChild(card);
      });
    }

    // Switch active detail tab
    function switchTab(tab) {
      activeTab = tab;
      
      const btnPlayers = document.getElementById("tab-btn-players");
      const btnLogs = document.getElementById("tab-btn-logs");
      const contentPlayers = document.getElementById("tab-content-players");
      const contentLogs = document.getElementById("tab-content-logs");
      
      btnPlayers.classList.remove("border-orange-500", "text-orange-500");
      btnLogs.classList.remove("border-orange-500", "text-orange-500");
      contentPlayers.classList.add("hidden");
      contentLogs.classList.add("hidden");
      
      if (tab === "players") {
        btnPlayers.classList.add("border-orange-500", "text-orange-500");
        contentPlayers.classList.remove("hidden");
        loadPlayers();
      } else {
        btnLogs.classList.add("border-orange-500", "text-orange-500");
        contentLogs.classList.remove("hidden");
        loadLogs();
      }
    }

    // Refresh active tab
    function refreshActiveData() {
      if (!activeServerId) return;
      switchTab(activeTab);
    }

    // Load active server players list
    async function loadPlayers() {
      if (!activeServerId || !token) return;
      const container = document.getElementById("players-container");
      container.innerHTML = `<p class="text-xs text-slate-500 font-mono">Oyuncu listesi sorgulanıyor...</p>`;
      
      try {
        const res = await fetch(`/api/servers/${activeServerId}/players`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) throw new Error();
        const players = await res.json();
        
        const onlinePlayers = players.filter(p => p.is_online);
        if (onlinePlayers.length === 0) {
          container.innerHTML = `
            <div class="text-center p-8 border border-white/5 rounded-2xl bg-white/[0.01]">
              <p class="text-xs text-slate-500">Sunucuda çevrimiçi oyuncu bulunmuyor.</p>
            </div>
          `;
          return;
        }
        
        container.innerHTML = "";
        onlinePlayers.forEach(p => {
          const row = document.createElement("div");
          row.className = "flex items-center justify-between p-3 border border-white/5 bg-[#121216]/50 rounded-xl hover:border-white/10 transition-all";
          row.innerHTML = `
            <div class="min-w-0">
              <span class="text-xs font-bold text-white block truncate">${p.name}</span>
              <span class="text-[9px] font-mono text-slate-500 truncate block mt-0.5">${p.steam_id}</span>
            </div>
            ${p.squad ? `<span class="px-2 py-0.5 border border-orange-500/20 bg-orange-500/5 text-orange-400 font-mono text-[9px] rounded-lg">[${p.squad}]</span>` : ""}
          `;
          container.appendChild(row);
        });
      } catch {
        container.innerHTML = `<p class="text-xs text-red-400 font-mono">Oyuncu listesi yüklenemedi.</p>`;
      }
    }

    // Set logs type filter
    function setLogFilter(type) {
      logFilter = type;
      
      ["all", "chat", "kill", "admin"].forEach(f => {
        const btn = document.getElementById(`btn-filter-${f}`);
        btn.classList.remove("border-orange-500/40", "bg-orange-600/10", "text-orange-400");
      });
      document.getElementById(`btn-filter-${type}`).classList.add("border-orange-500/40", "bg-orange-600/10", "text-orange-400");
      
      loadLogs();
    }

    // Load active server logs list
    async function loadLogs() {
      if (!activeServerId || !token) return;
      const container = document.getElementById("logs-container");
      container.innerHTML = `<p class="text-xs text-slate-500 font-mono">Log verileri çekiliyor...</p>`;
      
      try {
        let url = `/api/servers/${activeServerId}/logs?limit=150`;
        if (logFilter !== "all") {
          url += `&type=${logFilter}`;
        }
        
        const res = await fetch(url, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) throw new Error();
        const logs = await res.json();
        
        if (logs.length === 0) {
          container.innerHTML = `<p class="text-xs text-slate-500 italic p-2">Eşleşen log bulunamadı.</p>`;
          return;
        }
        
        container.innerHTML = "";
        logs.forEach(l => {
          let badgeColor = "text-zinc-400 bg-zinc-500/10";
          if (l.type === "chat") badgeColor = "text-sky-400 bg-sky-500/10";
          if (l.type === "kill") badgeColor = "text-red-400 bg-red-500/10";
          if (l.type === "admin") badgeColor = "text-orange-400 bg-orange-500/10";
          
          const timeStr = l.ts ? new Date(l.ts).toLocaleTimeString() : "—";
          const rawMessage = l.message || l.raw || "";
          
          let lineText = "";
          if (l.type === "chat") {
            lineText = `[${l.channel || "CHAT"}] <span class="text-white font-bold">${l.player_name}</span>: ${rawMessage}`;
          } else if (l.type === "kill") {
            lineText = `<span class="text-red-400 font-bold">${l.killer_name}</span> killed <span class="text-slate-300">${l.victim_name}</span> with ${l.weapon || "?"}`;
          } else if (l.type === "admin") {
            lineText = `<span class="text-orange-400 font-bold">${l.player_name}</span> ran cmd: ${l.command} ${l.args || ""}`;
          } else {
            lineText = rawMessage;
          }

          const div = document.createElement("div");
          div.className = "flex items-start gap-2.5 py-1.5 border-b border-white/[0.02] last:border-0 hover:bg-white/[0.01] px-1 rounded-lg transition-all";
          div.innerHTML = `
            <span class="text-[9px] text-slate-600 font-mono mt-0.5 select-none shrink-0">${timeStr}</span>
            <span class="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider shrink-0 ${badgeColor}">${l.type}</span>
            <span class="text-slate-300 break-all leading-normal flex-1">${lineText}</span>
          `;
          container.appendChild(div);
        });
      } catch (err) {
        container.innerHTML = `<p class="text-xs text-red-400 font-mono">Log verileri yüklenemedi.</p>`;
      }
    }

    // Set logs type filter
    setLogFilter("all");

    // Init views on start
    updateViews();
    if (token) {
      loadServers();
    }

    // Auto-refresh every 20s
    setInterval(() => {
      if (token) {
        loadServers(false);
        if (activeServerId) {
          const srv = servers.find(s => s.id === activeServerId);
          if (srv && !apiBusy) {
            renderActiveControls(srv);
          }
          // Only refresh list if user is currently looking at tab
          if (activeTab === "players") {
            loadPlayers();
          }
        }
      }
    }, 20000);
  </script>
</body>
</html>
"""
