/**
 * Login Firebase + acesso ao laboratório somente se email_access/{email}.active === true
 * Sem API na Vercel — liberação via Firebase Console ou extensão Stripe no Firebase.
 */
(function () {
  let firebaseReady = false;
  let auth = null;
  let db = null;
  let currentUser = null;

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

  window.initFirebaseAccess = function initFirebaseAccess() {
    if (firebaseReady || typeof firebase === "undefined" || !window.FIREBASE_CONFIG) {
      return !!firebaseReady;
    }
    firebase.initializeApp(window.FIREBASE_CONFIG);
    auth = firebase.auth();
    db = firebase.firestore();
    firebaseReady = true;

    auth.onAuthStateChanged(async (user) => {
      currentUser = user;
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

  function updateAccessNav(user) {
    const loginBtn = document.getElementById("nav-login-btn");
    const userBtn = document.getElementById("nav-user-btn");
    if (loginBtn) loginBtn.style.display = user ? "none" : "";
    if (userBtn) {
      userBtn.style.display = user ? "" : "none";
      userBtn.textContent = user?.email ? user.email.split("@")[0] : "Conta";
    }
  }

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
    try {
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
      showAuthMsg("Login ok! Verificando acesso…", "success");
      const ok = await userHasLabAccess(auth.currentUser);
      if (ok) {
        closeAccessGate();
        if (sessionStorage.getItem("saaslab_pending_enter") === "1") {
          sessionStorage.removeItem("saaslab_pending_enter");
          window.enterPlatformCore();
        }
      } else {
        switchAccessTab("activate");
        showAuthMsg(
          "Login feito, mas este e-mail ainda não tem acesso. Veja a aba Ativar compra.",
          "warn"
        );
      }
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
      showAuthMsg("Conta criada! Verificando acesso da compra…", "success");
      const ok = await userHasLabAccess(auth.currentUser);
      if (ok) {
        closeAccessGate();
        sessionStorage.removeItem("saaslab_pending_enter");
        window.enterPlatformCore();
      } else {
        switchAccessTab("activate");
        showAuthMsg(
          "Conta criada. Se você já pagou, aguarde a liberação automática ou fale no WhatsApp.",
          "warn"
        );
      }
    } catch (e) {
      showAuthMsg(friendlyAuthError(e), "error");
    }
  };

  window.accessLogout = async function accessLogout() {
    if (auth) await auth.signOut();
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
})();
