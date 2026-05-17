/**

 * Login Firebase + acesso ao laboratório

 * Admin: users/{uid}.role === "admin" (Firestore)

 * Cliente: email_access/{email}.active === true OU users/{uid}.libraryAccess === true

 */

(function () {

  let firebaseReady = false;

  let auth = null;

  let db = null;



  function showAuthMsg(text, type) {

    const el = document.getElementById("access-auth-msg");

    if (!el) return;

    el.textContent = text || "";

    el.className = "access-auth-msg" + (type ? " access-auth-msg--" + type : "");

  }



  function normalizeEmail(email) {

    return String(email || "")

      .trim()

      .toLowerCase();

  }



  function normalizeRole(role) {

    return String(role || "")

      .trim()

      .toLowerCase();

  }



  function isConfiguredAdmin(email) {

    const key = normalizeEmail(email);

    const list = (window.ADMIN_EMAILS || []).map(normalizeEmail).filter(Boolean);

    return list.includes(key);

  }



  window.isLabAdmin = function isLabAdmin(user) {

    if (!user?.email) return false;

    if (isConfiguredAdmin(user.email)) return true;

    return normalizeRole(window.__labUserProfile?.role) === "admin";

  };



  async function refreshLabUserProfile(user) {

    if (!user || !db) {

      window.__labUserProfile = null;

      return null;

    }

    try {

      const snap = await db.collection("users").doc(user.uid).get();

      window.__labUserProfile = snap.exists ? snap.data() : null;

      return window.__labUserProfile;

    } catch (e) {

      console.error("refreshLabUserProfile", e);

      window.__labUserProfile = null;

      return null;

    }

  }



  async function ensureUserDoc(user) {

    if (!user || !db) return;

    const ref = db.collection("users").doc(user.uid);

    const snap = await ref.get();

    const email = normalizeEmail(user.email);

    const now = firebase.firestore.FieldValue.serverTimestamp();



    if (!snap.exists) {

      await ref.set({

        email,

        role: "user",

        libraryAccess: false,

        createdAt: now,

        updatedAt: now,

      });

      window.__labUserProfile = {

        email,

        role: "user",

        libraryAccess: false,

      };

      return;

    }



    const data = snap.data() || {};

    const patch = { updatedAt: now };

    if (!data.email && email) patch.email = email;

    if (!data.role) patch.role = "user";

    if (typeof data.libraryAccess !== "boolean") patch.libraryAccess = false;

    if (Object.keys(patch).length > 1) await ref.set(patch, { merge: true });

    await refreshLabUserProfile(user);

  }



  function updateAccessNav(user) {

    const loginBtn = document.getElementById("nav-login-btn");

    const userBtn = document.getElementById("nav-user-btn");

    const adminBtn = document.getElementById("nav-admin-btn");

    if (loginBtn) loginBtn.style.display = user ? "none" : "";

    if (userBtn) {

      userBtn.style.display = user ? "" : "none";

      const name = user?.email ? user.email.split("@")[0] : "Conta";

      userBtn.textContent = window.isLabAdmin(user) ? name + " (admin)" : name;

    }

    if (adminBtn) {

      adminBtn.style.display = user && window.isLabAdmin(user) ? "" : "none";

    }

    const platAdminBtn = document.getElementById("plat-admin-btn");

    if (platAdminBtn) {

      platAdminBtn.style.display = user && window.isLabAdmin(user) ? "" : "none";

    }

  }



  window.initFirebaseAccess = function initFirebaseAccess() {

    if (firebaseReady || typeof firebase === "undefined" || !window.FIREBASE_CONFIG) {

      return !!firebaseReady;

    }

    firebase.initializeApp(window.FIREBASE_CONFIG);

    auth = firebase.auth();

    db = firebase.firestore();

    firebaseReady = true;



    auth.onAuthStateChanged(async (user) => {

      if (user) {

        await ensureUserDoc(user);

        await refreshLabUserProfile(user);

      } else {

        window.__labUserProfile = null;

      }

      updateAccessNav(user);

      if (user) {

        const ok = await window.userHasLabAccess(user);

        if (ok && sessionStorage.getItem("saaslab_pending_enter") === "1") {

          sessionStorage.removeItem("saaslab_pending_enter");

          window.enterPlatformCore();

        }

      }

    });



    handleReturnAfterPayment();

    return true;

  };



  window.openAccessGate = function openAccessGate(tab) {

    const gate = document.getElementById("access-gate");

    if (!gate) return;

    gate.hidden = false;

    gate.setAttribute("aria-hidden", "false");

    requestAnimationFrame(() => gate.classList.add("is-open"));

    switchAccessTab(tab || "login");

    showAuthMsg("");

    initFirebaseAccess();

  };



  window.closeAccessGate = function closeAccessGate() {

    const gate = document.getElementById("access-gate");

    if (!gate) return;

    gate.classList.remove("is-open");

    gate.setAttribute("aria-hidden", "true");

    setTimeout(() => {

      gate.hidden = true;

    }, 260);

  };



  window.switchAccessTab = function switchAccessTab(tab) {

    document.querySelectorAll(".access-tab").forEach((btn) => {

      btn.classList.toggle("active", btn.dataset.tab === tab);

    });

    document.querySelectorAll(".access-panel").forEach((panel) => {

      panel.hidden = panel.dataset.panel !== tab;

    });

  };



  window.userHasLabAccess = async function userHasLabAccess(user) {

    if (!user?.email || !db) return false;



    if (isConfiguredAdmin(user.email)) return true;



    try {

      const profile =

        window.__labUserProfile ||

        (await db.collection("users").doc(user.uid).get()).data();

      const role = normalizeRole(profile?.role);

      if (role === "admin") return true;

      if (profile?.libraryAccess === true) return true;



      const key = normalizeEmail(user.email);

      const snap = await db.collection("email_access").doc(key).get();

      return snap.exists && snap.data()?.active === true;

    } catch (e) {

      console.error("userHasLabAccess", e);

      return false;

    }

  };



  window.requestPlatformAccess = async function requestPlatformAccess() {

    initFirebaseAccess();

    if (!auth) {

      alert("Firebase não carregou. Recarregue a página.");

      return;

    }

    if (!auth.currentUser) {

      sessionStorage.setItem("saaslab_pending_enter", "1");

      openAccessGate("login");

      showAuthMsg("Faça login com o e-mail usado na compra.", "info");

      return;

    }

    const ok = await userHasLabAccess(auth.currentUser);

    if (!ok) {

      sessionStorage.setItem("saaslab_pending_enter", "1");

      openAccessGate("activate");

      showAuthMsg(

        "Compra não liberada para este e-mail. Use o mesmo e-mail do pagamento ou aguarde a confirmação.",

        "warn"

      );

      return;

    }

    window.enterPlatformCore();

  };



  async function afterAuthSuccess(user) {

    await ensureUserDoc(user);

    await refreshLabUserProfile(user);

    updateAccessNav(user);

    const ok = await userHasLabAccess(user);

    if (ok) {

      closeAccessGate();

      if (sessionStorage.getItem("saaslab_pending_enter") === "1") {

        sessionStorage.removeItem("saaslab_pending_enter");

        window.enterPlatformCore();

      }

      return true;

    }

    switchAccessTab("activate");

    showAuthMsg(

      "Conta ok, mas o laboratório ainda não está liberado para este e-mail. Aguarde a confirmação da compra.",

      "warn"

    );

    return false;

  }



  window.accessLogin = async function accessLogin() {

    initFirebaseAccess();

    const email = document.getElementById("access-email")?.value?.trim();

    const pass = document.getElementById("access-password")?.value;

    if (!email || !pass) {

      showAuthMsg("Preencha e-mail e senha.", "warn");

      return;

    }

    try {

      showAuthMsg("Entrando…", "info");

      await auth.signInWithEmailAndPassword(email, pass);

      if (window.isLabAdmin(auth.currentUser)) {

        showAuthMsg("Bem-vindo, admin!", "success");

      } else {

        showAuthMsg("Login ok! Verificando acesso…", "success");

      }

      await afterAuthSuccess(auth.currentUser);

    } catch (e) {

      showAuthMsg(friendlyAuthError(e), "error");

    }

  };



  window.accessRegister = async function accessRegister() {

    initFirebaseAccess();

    const email = document.getElementById("access-reg-email")?.value?.trim();

    const pass = document.getElementById("access-reg-password")?.value;

    if (!email || !pass) {

      showAuthMsg("Preencha e-mail e senha.", "warn");

      return;

    }

    if (pass.length < 6) {

      showAuthMsg("Senha com no mínimo 6 caracteres.", "warn");

      return;

    }

    try {

      showAuthMsg("Criando conta…", "info");

      await auth.createUserWithEmailAndPassword(email, pass);

      showAuthMsg("Conta criada! Verificando acesso…", "success");

      await afterAuthSuccess(auth.currentUser);

    } catch (e) {

      showAuthMsg(friendlyAuthError(e), "error");

    }

  };



  window.accessLogout = async function accessLogout() {

    if (typeof closeAdminDashboard === "function") closeAdminDashboard();

    if (auth) await auth.signOut();

    window.__labUserProfile = null;

    if (typeof window.exitPlatform === "function") window.exitPlatform();

    showAuthMsg("Você saiu da conta.", "info");

  };



  function friendlyAuthError(e) {

    const code = e?.code || "";

    const map = {

      "auth/invalid-credential": "E-mail ou senha incorretos.",

      "auth/user-not-found": "Usuário não encontrado. Crie uma conta.",

      "auth/wrong-password": "Senha incorreta.",

      "auth/email-already-in-use": "Este e-mail já tem conta. Use Entrar.",

      "auth/weak-password": "Senha muito fraca (mín. 6 caracteres).",

      "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco.",

    };

    return map[code] || e?.message || "Erro de autenticação.";

  }



  function handleReturnAfterPayment() {

    const params = new URLSearchParams(window.location.search);

    if (params.get("acesso") === "1" || params.get("checkout") === "success") {

      sessionStorage.setItem("saaslab_pending_enter", "1");

      setTimeout(() => openAccessGate("register"), 400);

      showAuthMsg(

        "Pagamento recebido! Crie sua senha com o MESMO e-mail usado no pagamento.",

        "success"

      );

      window.history.replaceState({}, "", window.location.pathname + window.location.hash);

    }

  }



  window.getFirebaseDb = function getFirebaseDb() {

    initFirebaseAccess();

    return db;

  };



  window.getFirebaseAuth = function getFirebaseAuth() {

    initFirebaseAccess();

    return auth;

  };

})();


