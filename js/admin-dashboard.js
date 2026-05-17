/**

 * Painel admin — somente role "admin" em users/{uid}

 */

(function () {

  function formatDate(ts) {

    if (!ts) return "—";

    try {

      const d = ts.toDate ? ts.toDate() : new Date(ts);

      return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

    } catch (_) {

      return "—";

    }

  }



  function roleBadge(role) {

    const r = String(role || "user").trim().toLowerCase();

    if (r === "admin") return '<span class="admin-badge admin-badge--admin">admin</span>';

    return '<span class="admin-badge admin-badge--user">user</span>';

  }



  function accessBadge(libraryAccess, emailActive) {

    if (libraryAccess || emailActive) {

      return '<span class="admin-badge admin-badge--ok">liberado</span>';

    }

    return '<span class="admin-badge admin-badge--pending">pendente</span>';

  }



  function escAttr(s) {

    return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  }



  window.openAdminDashboard = async function openAdminDashboard() {

    const auth = window.getFirebaseAuth?.();

    const user = auth?.currentUser;

    if (!user || !window.isLabAdmin(user)) {

      alert("Acesso restrito ao administrador.");

      return;

    }



    const panel = document.getElementById("admin-dashboard");

    if (!panel) return;

    panel.hidden = false;

    panel.setAttribute("aria-hidden", "false");

    requestAnimationFrame(() => panel.classList.add("is-open"));

    document.body.classList.add("admin-dash-open");

    await loadAdminDashboard();

  };



  window.closeAdminDashboard = function closeAdminDashboard() {

    const panel = document.getElementById("admin-dashboard");

    if (!panel) return;

    panel.classList.remove("is-open");

    panel.setAttribute("aria-hidden", "true");

    document.body.classList.remove("admin-dash-open");

    setTimeout(() => {

      panel.hidden = true;

    }, 260);

  };



  async function loadAdminDashboard() {

    const db = window.getFirebaseDb?.();

    const tbody = document.getElementById("admin-users-body");

    const statsEl = document.getElementById("admin-stats");

    if (!db || !tbody) return;



    tbody.innerHTML =

      '<tr><td colspan="6" class="admin-loading">Carregando usuários…</td></tr>';



    try {

      let snap;
      try {
        snap = await db.collection("users").orderBy("createdAt", "desc").limit(200).get();
      } catch (idxErr) {
        snap = await db.collection("users").limit(200).get();
      }

      const rows = [];

      let total = 0;

      let admins = 0;

      let liberados = 0;



      for (const doc of snap.docs) {

        total++;

        const d = doc.data() || {};

        const role = String(d.role || "user").trim().toLowerCase();

        if (role === "admin") admins++;

        const email = d.email || "—";

        let emailActive = false;

        if (email && email !== "—") {

          try {

            const ea = await db.collection("email_access").doc(email).get();

            emailActive = ea.exists && ea.data()?.active === true;

          } catch (_) {}

        }

        if (d.libraryAccess || emailActive) liberados++;



        const canGrant = role !== "admin";

        const uid = escAttr(doc.id);

        const em = escAttr(email);

        rows.push(`<tr data-uid="${uid}" data-email="${em}">

          <td>${email}</td>

          <td>${roleBadge(d.role)}</td>

          <td>${accessBadge(d.libraryAccess, emailActive)}</td>

          <td>${formatDate(d.createdAt)}</td>

          <td class="admin-uid" title="${doc.id}">${doc.id.slice(0, 8)}…</td>

          <td class="admin-actions">

            ${

              canGrant

                ? `<button type="button" class="admin-btn admin-btn--grant" data-uid="${uid}" data-email="${em}" onclick="adminGrantAccess(this.dataset.uid, this.dataset.email)">Liberar</button>

                   <button type="button" class="admin-btn admin-btn--revoke" data-uid="${uid}" data-email="${em}" onclick="adminRevokeAccess(this.dataset.uid, this.dataset.email)">Revogar</button>`

                : '<span class="admin-muted">—</span>'

            }

          </td>

        </tr>`);

      }



      tbody.innerHTML =

        rows.length > 0

          ? rows.join("")

          : '<tr><td colspan="6" class="admin-loading">Nenhum usuário em <code>users</code> ainda.</td></tr>';



      if (statsEl) {

        const aguardando = Math.max(0, total - liberados - admins);

        statsEl.innerHTML = `

          <div class="admin-stat"><strong>${total}</strong><span>contas</span></div>

          <div class="admin-stat"><strong>${liberados}</strong><span>com acesso</span></div>

          <div class="admin-stat"><strong>${aguardando}</strong><span>aguardando</span></div>

          <div class="admin-stat"><strong>${admins}</strong><span>admins</span></div>`;

      }

    } catch (e) {

      console.error(e);

      tbody.innerHTML = `<tr><td colspan="6" class="admin-error">Erro ao carregar: ${e.message}. Publique as regras do Firestore e confira se seu usuário tem <code>role: admin</code>.</td></tr>`;

    }

  }



  window.adminGrantAccess = async function adminGrantAccess(uid, email) {

    const db = window.getFirebaseDb?.();

    const auth = window.getFirebaseAuth?.();

    if (!db || !auth?.currentUser || !window.isLabAdmin(auth.currentUser)) return;

    if (!email || email === "—") {

      alert("E-mail inválido.");

      return;

    }

    const key = email.trim().toLowerCase();

    try {

      const now = firebase.firestore.FieldValue.serverTimestamp();

      await db.collection("users").doc(uid).set(

        { libraryAccess: true, role: "user", updatedAt: now },

        { merge: true }

      );

      await db.collection("email_access").doc(key).set(

        { active: true, email: key, role: "user", updatedAt: now },

        { merge: true }

      );

      await loadAdminDashboard();

    } catch (e) {

      alert("Não foi possível liberar: " + e.message);

    }

  };



  window.adminRevokeAccess = async function adminRevokeAccess(uid, email) {

    const db = window.getFirebaseDb?.();

    const auth = window.getFirebaseAuth?.();

    if (!db || !auth?.currentUser || !window.isLabAdmin(auth.currentUser)) return;

    if (!confirm("Revogar acesso ao laboratório deste usuário?")) return;

    const key = email?.trim().toLowerCase();

    try {

      const now = firebase.firestore.FieldValue.serverTimestamp();

      await db.collection("users").doc(uid).set(

        { libraryAccess: false, updatedAt: now },

        { merge: true }

      );

      if (key) {

        await db.collection("email_access").doc(key).set(

          { active: false, updatedAt: now },

          { merge: true }

        );

      }

      await loadAdminDashboard();

    } catch (e) {

      alert("Não foi possível revogar: " + e.message);

    }

  };

})();


