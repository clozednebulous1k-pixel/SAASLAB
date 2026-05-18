/**
 * Autenticação + acesso ao laboratório.
 * Segurança: Firestore Rules são a fonte da verdade (não confiar no front).
 * Admin: apenas users/{uid}.role === "admin" no Firestore (definido no Console).
 * Cliente: email_access/{email}.active === true OU users/{uid}.libraryAccess === true
 */
(function () {
  let firebaseReady = false;
  let auth = null;
  let db = null;
  let labAccessWatchId = null;
  let enterLabCallback = null;

  window.registerLabEnterCallback = function registerLabEnterCallback(fn) {
    if (typeof fn === "function") enterLabCallback = fn;
  };

  function enterLabIfAllowed() {
    if (typeof enterLabCallback === "function") enterLabCallback();
  }

  function stopLabAccessWatch() {
    if (labAccessWatchId) {
      clearInterval(labAccessWatchId);
      labAccessWatchId = null;
    }
  }

  function startLabAccessWatch() {
    stopLabAccessWatch();
    labAccessWatchId = setInterval(async () => {
      const user = auth?.currentUser;
      if (!user) return;
      const ok = await userHasLabAccess(user);
      if (!ok) {
        stopLabAccessWatch();
        if (typeof window.exitPlatform === "function") window.exitPlatform();
        await auth.signOut();
        window.__labUserProfile = null;
        updateAccessNav(null);
        openAccessGate();
        showAuthMsg("Seu acesso foi encerrado ou ainda não está liberado.", "warn");
      }
    }, 60000);
  }

  window.onLabEntered = function onLabEntered() {
    startLabAccessWatch();
  };

  window.onLabExited = function onLabExited() {
    stopLabAccessWatch();
  };

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

  /** UI rápida, decisões críticas usam assertLabAdminFromServer (Firestore). */
  window.isLabAdmin = function isLabAdmin(user) {
    if (!user?.uid) return false;
    return normalizeRole(window.__labUserProfile?.role) === "admin";
  };

  async function assertLabAdminFromServer(user) {
    if (!user?.uid || !db) return false;
    try {
      const snap = await db.collection("users").doc(user.uid).get();
      const data = snap.exists ? snap.data() : null;
      window.__labUserProfile = data;
      return normalizeRole(data?.role) === "admin";
    } catch (e) {
      console.error("assertLabAdminFromServer", e);
      return false;
    }
  }
  window.assertLabAdminFromServer = assertLabAdminFromServer;

  function checkAuthRateLimit() {
    const rl = window.saasLabRateLimit;
    if (!rl) return true;
    const r = rl.check("auth");
    if (!r.allowed) {
      showAuthMsg(rl.message(r.retryAfterSec), "warn");
      return false;
    }
    return true;
  }

  function recordAuthFailure() {
    window.saasLabRateLimit?.record("auth");
  }

  function clearAuthFailures() {
    window.saasLabRateLimit?.clear("auth");
  }

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

  async function emailHasPurchaseAccess(email) {
    if (!db || !email) return false;
    try {
      const key = normalizeEmail(email);
      const snap = await db.collection("email_access").doc(key).get();
      return snap.exists && snap.data()?.active === true;
    } catch (e) {
      console.error("emailHasPurchaseAccess", e);
      return false;
    }
  }

  async function ensureUserDoc(user) {
    if (!user || !db || !user.email) return;
    const ref = db.collection("users").doc(user.uid);
    const snap = await ref.get();
    const email = normalizeEmail(user.email);
    const now = firebase.firestore.FieldValue.serverTimestamp();
    const providerId = user.providerData?.[0]?.providerId || "password";

    if (!snap.exists) {
      await ref.set({
        email,
        role: "user",
        libraryAccess: false,
        authProvider: providerId,
        createdAt: now,
        updatedAt: now,
      });
      window.__labUserProfile = { email, role: "user", libraryAccess: false };
      return;
    }

    const data = snap.data() || {};
    const patch = { updatedAt: now };
    if (!data.email && email) patch.email = email;
    // Nunca enviar role nem libraryAccess no merge, regras do Firestore bloqueiam; F12 não adianta.
    if (Object.keys(patch).length > 1) await ref.set(patch, { merge: true });
    await refreshLabUserProfile(user);
  }

  function setNavVisible(el, show) {
    if (!el) return;
    if (show) {
      el.hidden = false;
      el.removeAttribute("hidden");
    } else {
      el.hidden = true;
    }
  }

  function updateAccessNav(user) {
    const loginBtn = document.getElementById("nav-login-btn");
    const userBtn = document.getElementById("nav-user-btn");
    const adminBtn = document.getElementById("nav-admin-btn");
    const adminLink = document.getElementById("nav-admin-link");
    const adminFab = document.getElementById("admin-fab");
    const platAdminBtn = document.getElementById("plat-admin-btn");
    const isAdmin = user && window.isLabAdmin(user);

    setNavVisible(loginBtn, !user);
    setNavVisible(userBtn, !!user);
    setNavVisible(adminBtn, isAdmin);
    setNavVisible(platAdminBtn, isAdmin);

    if (adminFab) {
      if (isOwner) {
        adminFab.hidden = false;
        adminFab.classList.add("is-visible");
      } else {
        adminFab.hidden = true;
        adminFab.classList.remove("is-visible");
      }
    }

    if (adminLink) adminLink.style.display = isOwner ? "block" : "none";

    if (userBtn) {
      const name = user?.email ? user.email.split("@")[0] : "Conta";
      userBtn.textContent = isOwner ? name + " (dono)" : isAdmin ? name + " (admin)" : name;
    }
  }

  window.userHasLabAccess = async function userHasLabAccess(user) {
    if (!user?.email || !db) return false;

    try {
      const snap = await db.collection("users").doc(user.uid).get();
      const profile = snap.exists ? snap.data() : null;
      window.__labUserProfile = profile;

      if (normalizeRole(profile?.role) === "admin") return true;
      if (profile?.libraryAccess === true) return true;

      return await emailHasPurchaseAccess(user.email);
    } catch (e) {
      console.error("userHasLabAccess", e);
      return false;
    }
  };

  window.verifyLabAccessBeforeEnter = async function verifyLabAccessBeforeEnter() {
    initFirebaseAccess();
    const user = auth?.currentUser;
    if (!user) {
      sessionStorage.setItem("saaslab_pending_enter", "1");
      openAccessGate();
      showAuthMsg("Faça login com o e-mail da compra.", "warn");
      return false;
    }
    const ok = await userHasLabAccess(user);
    if (!ok) {
      await auth.signOut();
      window.__labUserProfile = null;
      updateAccessNav(null);
      sessionStorage.setItem("saaslab_pending_enter", "1");
      openAccessGate();
      showAuthMsg(
        "Acesso negado. Este e-mail não tem compra liberada no sistema.",
        "warn"
      );
      return false;
    }
    return true;
  };

  window.initFirebaseAccess = function initFirebaseAccess() {
    if (firebaseReady || typeof firebase === "undefined" || !window.FIREBASE_CONFIG) {
      return !!firebaseReady;
    }
    firebase.initializeApp(window.FIREBASE_CONFIG);
    auth = firebase.auth();
    db = firebase.firestore();
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch (_) {}
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
        const ok = await userHasLabAccess(user);
        if (ok && sessionStorage.getItem("saaslab_pending_enter") === "1") {
          sessionStorage.removeItem("saaslab_pending_enter");
          enterLabIfAllowed();
          window.onLabEntered?.();
        } else if (!ok) {
          await auth.signOut();
          updateAccessNav(null);
        }
      }
    });

    handleReturnAfterPayment();
    return true;
  };

  window.openAccessGate = function openAccessGate() {
    const gate = document.getElementById("access-gate");
    if (!gate) return;
    gate.hidden = false;
    gate.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => gate.classList.add("is-open"));
    showAuthMsg("");
    initFirebaseAccess();
    loadRememberedEmail();
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

  window.switchAccessTab = function switchAccessTab() {
    /* aba única: só entrar */
  };

  window.requestPlatformAccess = async function requestPlatformAccess() {
    initFirebaseAccess();
    if (!auth) {
      alert("Firebase não carregou. Recarregue a página.");
      return;
    }
    if (!auth.currentUser) {
      sessionStorage.setItem("saaslab_pending_enter", "1");
      openAccessGate();
      showAuthMsg("Faça login com o e-mail usado na compra.", "info");
      return;
    }
    const ok = await userHasLabAccess(auth.currentUser);
    if (!ok) {
      await auth.signOut();
      window.__labUserProfile = null;
      updateAccessNav(null);
      sessionStorage.setItem("saaslab_pending_enter", "1");
      openAccessGate();
      showAuthMsg(
        "Compra não liberada para este e-mail. Use o mesmo e-mail do pagamento.",
        "warn"
      );
      return;
    }
    enterLabIfAllowed();
    window.onLabEntered?.();
  };

  async function afterAuthSuccess(user, options) {
    const signOutIfDenied = options?.signOutIfDenied === true;

    await ensureUserDoc(user);
    await refreshLabUserProfile(user);
    updateAccessNav(user);

    const ok = await userHasLabAccess(user);
    if (ok) {
      closeAccessGate();
      if (sessionStorage.getItem("saaslab_pending_enter") === "1") {
        sessionStorage.removeItem("saaslab_pending_enter");
        enterLabIfAllowed();
        window.onLabEntered?.();
      }
      return true;
    }

    if (signOutIfDenied && auth) {
      await auth.signOut();
      window.__labUserProfile = null;
      updateAccessNav(null);
    }

    showAuthMsg(
      signOutIfDenied
        ? `O e-mail ${normalizeEmail(user?.email)} não tem compra liberada. Aguarde a confirmação ou fale no WhatsApp.`
        : "Este e-mail ainda não tem acesso ao laboratório.",
      "warn"
    );
    return false;
  }

  window.accessLoginWithGoogle = async function accessLoginWithGoogle() {
    initFirebaseAccess();
    if (!auth) {
      showAuthMsg("Firebase não carregou. Recarregue a página.", "error");
      return;
    }
    if (!checkAuthRateLimit()) return;

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      showAuthMsg("Conectando com Google…", "info");
      const result = await auth.signInWithPopup(provider);
      const user = result.user;

      if (!user?.email) {
        await auth.signOut();
        updateAccessNav(null);
        showAuthMsg("Não foi possível ler o e-mail do Google.", "error");
        return;
      }

      saveRememberedEmail(user.email);
      showAuthMsg("Verificando compra liberada no servidor…", "info");
      const ok = await afterAuthSuccess(user, { signOutIfDenied: true });
      if (ok) clearAuthFailures();
    } catch (e) {
      const code = e?.code || "";
      if (code === "auth/popup-closed-by-user") {
        showAuthMsg("", "");
        return;
      }
      if (code !== "auth/too-many-requests") recordAuthFailure();
      showAuthMsg(friendlyAuthError(e), "error");
    }
  };

  window.accessLogin = async function accessLogin() {
    initFirebaseAccess();
    const email = document.getElementById("access-email")?.value?.trim();
    const pass = document.getElementById("access-password")?.value;

    if (!email || !pass) {
      showAuthMsg("Preencha e-mail e senha.", "warn");
      return;
    }

    if (pass.length < 6) {
      showAuthMsg("Senha com no mínimo 6 caracteres.", "warn");
      return;
    }

    if (!checkAuthRateLimit()) return;

    try {
      showAuthMsg("Entrando…", "info");
      await auth.signInWithEmailAndPassword(email, pass);
      saveRememberedEmail(email);
      const ok = await afterAuthSuccess(auth.currentUser, { signOutIfDenied: true });
      if (ok) clearAuthFailures();
    } catch (e) {
      const code = e?.code || "";

      if (
        (code === "auth/user-not-found" || code === "auth/invalid-credential") &&
        (await emailHasPurchaseAccess(email))
      ) {
        try {
          showAuthMsg("Primeiro acesso: criando senha com e-mail da compra…", "info");
          await auth.createUserWithEmailAndPassword(email, pass);
          saveRememberedEmail(email);
          const ok = await afterAuthSuccess(auth.currentUser, { signOutIfDenied: true });
          if (ok) clearAuthFailures();
          return;
        } catch (e2) {
          if (e2?.code === "auth/email-already-in-use") {
            showAuthMsg("Senha incorreta para este e-mail. Tente de novo ou use Esqueci a senha.", "warn");
            return;
          }
          recordAuthFailure();
          showAuthMsg(friendlyAuthError(e2), "error");
          return;
        }
      }

      if (code !== "auth/too-many-requests") recordAuthFailure();
      showAuthMsg(friendlyAuthError(e), "error");
    }
  };

  window.accessLogout = async function accessLogout() {
    if (typeof closeAdminDashboard === "function") closeAdminDashboard();
    if (auth) await auth.signOut();
    window.__labUserProfile = null;
    if (typeof window.exitPlatform === "function") window.exitPlatform();
  };

  function friendlyAuthError(e) {
    const code = e?.code || "";
    const map = {
      "auth/invalid-credential": "E-mail ou senha incorretos. Se é sua primeira vez, use o mesmo e-mail da compra.",
      "auth/user-not-found":
        "Sem conta ainda. Use o e-mail da compra (primeira vez define a senha aqui) ou Entrar com Google.",
      "auth/wrong-password": "Senha incorreta.",
      "auth/email-already-in-use": "Este e-mail já tem conta. Use Entrar ou Esqueci a senha.",
      "auth/weak-password": "Senha muito fraca (mín. 6 caracteres).",
      "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco.",
      "auth/popup-blocked": "Permita pop-ups para usar o Google.",
      "auth/cancelled-popup-request": "Aguarde a janela do Google.",
      "auth/unauthorized-domain":
        "Domínio não autorizado no Firebase (Authentication → Domínios autorizados).",
      "auth/operation-not-allowed": "Login com Google desativado no Firebase.",
    };
    return map[code] || e?.message || "Erro de autenticação.";
  }

  function handleReturnAfterPayment() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("acesso") === "1" || params.get("checkout") === "success") {
      sessionStorage.setItem("saaslab_pending_enter", "1");
      setTimeout(() => {
        openAccessGate();
        showAuthMsg(
          "Pagamento recebido! Entre com o MESMO e-mail da compra (Google ou senha).",
          "success"
        );
      }, 400);
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

  const REMEMBER_EMAIL_KEY = "saaslab_remember_email";

  function saveRememberedEmail(email) {
    const remember = document.getElementById("access-remember")?.checked;
    if (remember && email) {
      localStorage.setItem(REMEMBER_EMAIL_KEY, normalizeEmail(email));
    } else {
      localStorage.removeItem(REMEMBER_EMAIL_KEY);
    }
  }

  window.loadRememberedEmail = function loadRememberedEmail() {
    const saved = localStorage.getItem(REMEMBER_EMAIL_KEY);
    if (!saved) return;
    const loginEmail = document.getElementById("access-email");
    const remember = document.getElementById("access-remember");
    if (loginEmail) loginEmail.value = saved;
    if (remember) remember.checked = true;
  };

  window.toggleAccessPassword = function toggleAccessPassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input || !btn) return;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.textContent = show ? "Ocultar" : "Ver";
  };

  window.accessForgotPassword = async function accessForgotPassword() {
    initFirebaseAccess();
    const email = document.getElementById("access-email")?.value?.trim();
    if (!email) {
      showAuthMsg("Digite o e-mail da compra para receber o link.", "warn");
      return;
    }
    if (!auth) {
      showAuthMsg("Firebase não carregou.", "error");
      return;
    }
    const rl = window.saasLabRateLimit;
    if (rl) {
      const r = rl.check("forgot");
      if (!r.allowed) {
        showAuthMsg(rl.message(r.retryAfterSec), "warn");
        return;
      }
    }
    try {
      showAuthMsg("Enviando link…", "info");
      await auth.sendPasswordResetEmail(email);
      showAuthMsg("Link enviado! Verifique e-mail e spam.", "success");
    } catch (e) {
      rl?.record("forgot");
      if (e?.code === "auth/user-not-found") {
        showAuthMsg(
          "Nenhuma conta com este e-mail. Use Entrar com Google ou o e-mail exato da compra.",
          "warn"
        );
      } else {
        showAuthMsg(e?.message || "Erro ao enviar e-mail.", "error");
      }
    }
  };
})();
