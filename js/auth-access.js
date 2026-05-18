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
      if (e?.code === "permission-denied") {
        window.__lastFirestorePermError = true;
      }
      return false;
    }
  }

  function firestorePermHint() {
    return " Erro de permissão no Firestore: publique as regras em Firebase Console → Firestore → Regras (arquivo firestore.rules do projeto).";
  }

  async function ensureUserDoc(user) {
    if (!user || !db || !user.email) return;
    const ref = db.collection("users").doc(user.uid);
    const snap = await ref.get();
    const email = normalizeEmail(user.email);
    const now = firebase.firestore.FieldValue.serverTimestamp();
    const providerId = user.providerData?.[0]?.providerId || "password";

    if (!snap.exists) {
      try {
        await ref.set({
          email,
          role: "user",
          libraryAccess: false,
          authProvider: providerId,
          createdAt: now,
          updatedAt: now,
        });
        window.__labUserProfile = { email, role: "user", libraryAccess: false };
      } catch (e) {
        console.error("ensureUserDoc create", e);
        if (e?.code === "permission-denied") {
          showAuthMsg(
            "Não foi possível criar seu perfil no Firestore." + firestorePermHint(),
            "error"
          );
        }
        return;
      }
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
    const isOwner = user && window.isPrimaryOwner?.(user);

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

  function setAccessAuthMode(mode) {
    window.__accessAuthMode = mode;
    const passLabel = document.getElementById("access-password-label");
    const passConfirm = document.getElementById("access-password-confirm-wrap");
    const btn = document.getElementById("access-login-btn");
    const passInput = document.getElementById("access-password");
    const forgot = document.querySelector(".access-forgot");
    if (mode === "first") {
      if (passLabel) passLabel.textContent = "Crie sua senha (mín. 6 caracteres)";
      if (passConfirm) passConfirm.hidden = false;
      if (btn) btn.textContent = "Criar senha e entrar";
      if (passInput) passInput.autocomplete = "new-password";
      if (forgot) forgot.hidden = true;
    } else if (mode === "returning") {
      if (passLabel) passLabel.textContent = "Sua senha";
      if (passConfirm) passConfirm.hidden = true;
      if (btn) btn.textContent = "Entrar no laboratório";
      if (passInput) passInput.autocomplete = "current-password";
      if (forgot) forgot.hidden = false;
    } else if (mode === "google-only") {
      if (passLabel) passLabel.textContent = "Senha";
      if (passConfirm) passConfirm.hidden = true;
      if (btn) btn.textContent = "Entrar no laboratório";
      if (forgot) forgot.hidden = true;
    } else {
      if (passLabel) passLabel.textContent = "Senha";
      if (passConfirm) passConfirm.hidden = true;
      if (btn) btn.textContent = "Entrar no laboratório";
      if (passInput) passInput.autocomplete = "current-password";
      if (forgot) forgot.hidden = false;
    }
  }

  async function fetchAuthMethodsForEmail(email) {
    const key = normalizeEmail(email);
    return auth.fetchSignInMethodsForEmail(key);
  }

  window.accessResetEmailCheck = function accessResetEmailCheck() {
    window.__accessAuthMode = "unknown";
    const passConfirm = document.getElementById("access-password-confirm-wrap");
    if (passConfirm) passConfirm.hidden = true;
    const passLabel = document.getElementById("access-password-label");
    if (passLabel) passLabel.textContent = "Senha";
    const btn = document.getElementById("access-login-btn");
    if (btn) btn.textContent = "Entrar no laboratório";
  };

  window.accessSetFirstAccessMode = function accessSetFirstAccessMode() {
    setAccessAuthMode("first");
    showAuthMsg("Crie e confirme sua senha abaixo, depois clique em Criar senha e entrar.", "info");
    document.getElementById("access-password")?.focus();
  };

  async function finishLoginAfterAuth(email) {
    saveRememberedEmail(email);
    const ok = await afterAuthSuccess(auth.currentUser, { signOutIfDenied: true });
    if (ok) clearAuthFailures();
    return ok;
  }

  window.accessCheckEmail = async function accessCheckEmail() {
    initFirebaseAccess();
    if (!auth) {
      showAuthMsg("Firebase não carregou. Recarregue a página.", "error");
      return;
    }
    const email = document.getElementById("access-email")?.value?.trim();
    if (!email) {
      showAuthMsg("Digite o e-mail usado na compra.", "warn");
      return;
    }
    if (!checkAuthRateLimit()) return;

    try {
      showAuthMsg("Verificando compra liberada…", "info");
      const hasAccess = await emailHasPurchaseAccess(email);
      if (!hasAccess) {
        setAccessAuthMode("unknown");
        showAuthMsg(
          "Este e-mail não está liberado. Use o mesmo e-mail da Hotmart ou aguarde a confirmação.",
          "warn"
        );
        return;
      }

      const methods = await fetchAuthMethodsForEmail(email);
      if (!methods || methods.length === 0) {
        setAccessAuthMode("returning");
        showAuthMsg(
          "E-mail liberado. Digite sua senha e clique Entrar. Primeira vez? Clique em «Primeira vez — criar senha».",
          "info"
        );
        document.getElementById("access-password")?.focus();
        return;
      }
      if (methods.includes("password")) {
        setAccessAuthMode("returning");
        showAuthMsg("E-mail liberado. Digite sua senha ou use Esqueci a senha.", "info");
        document.getElementById("access-password")?.focus();
        return;
      }
      if (methods.includes("google.com")) {
        setAccessAuthMode("google-only");
        showAuthMsg("Esta conta foi criada com Google. Clique em Entrar com Google.", "info");
        return;
      }
      setAccessAuthMode("returning");
      showAuthMsg("E-mail liberado. Continue o login.", "info");
    } catch (e) {
      recordAuthFailure();
      showAuthMsg(friendlyAuthError(e), "error");
    }
  };

  window.openAccessGate = function openAccessGate() {
    const gate = document.getElementById("access-gate");
    if (!gate) return;
    gate.hidden = false;
    gate.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => gate.classList.add("is-open"));
    showAuthMsg("");
    setAccessAuthMode("unknown");
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
    if (!auth) {
      showAuthMsg("Firebase não carregou. Recarregue a página.", "error");
      return;
    }

    const email = document.getElementById("access-email")?.value?.trim();
    const pass = document.getElementById("access-password")?.value;
    const passConfirm = document.getElementById("access-password-confirm")?.value;
    const emailKey = normalizeEmail(email);

    if (!email) {
      showAuthMsg("Digite o e-mail da compra.", "warn");
      return;
    }
    if (!pass) {
      showAuthMsg("Digite sua senha.", "warn");
      return;
    }
    if (pass.length < 6) {
      showAuthMsg("Senha com no mínimo 6 caracteres.", "warn");
      return;
    }
    if (!checkAuthRateLimit()) return;

    try {
      window.__lastFirestorePermError = false;
      showAuthMsg("Verificando compra…", "info");
      const hasAccess = await emailHasPurchaseAccess(email);
      if (window.__lastFirestorePermError) {
        showAuthMsg("Permissão negada no Firestore." + firestorePermHint(), "error");
        return;
      }
      if (!hasAccess) {
        showAuthMsg(
          "Este e-mail não está liberado. Clique em Verificar ou use o mesmo e-mail da Hotmart.",
          "warn"
        );
        return;
      }

      if (window.__accessAuthMode === "google-only") {
        showAuthMsg("Use Entrar com Google para este e-mail.", "warn");
        return;
      }

      const isCreateFlow = window.__accessAuthMode === "first";

      if (isCreateFlow) {
        if (pass !== passConfirm) {
          setAccessAuthMode("first");
          showAuthMsg("Confirme a senha nos dois campos.", "warn");
          return;
        }
        try {
          showAuthMsg("Criando sua conta…", "info");
          await auth.createUserWithEmailAndPassword(emailKey, pass);
          await finishLoginAfterAuth(email);
          return;
        } catch (createErr) {
          if (createErr?.code === "auth/email-already-in-use") {
            try {
              showAuthMsg("Conta já existe. Entrando…", "info");
              await auth.signInWithEmailAndPassword(emailKey, pass);
              await finishLoginAfterAuth(email);
              return;
            } catch (signInErr) {
              setAccessAuthMode("returning");
              showAuthMsg(
                "Conta já cadastrada. Senha incorreta? Use Esqueci a senha ou a senha que criou antes.",
                "warn"
              );
              return;
            }
          }
          recordAuthFailure();
          showAuthMsg(friendlyAuthError(createErr), "error");
          return;
        }
      }

      showAuthMsg("Entrando…", "info");
      try {
        await auth.signInWithEmailAndPassword(emailKey, pass);
        await finishLoginAfterAuth(email);
        return;
      } catch (signInErr) {
        const code = signInErr?.code || "";
        if (code === "auth/user-not-found") {
          showAuthMsg(
            "Nenhuma conta com este e-mail. Clique em «Primeira vez — criar senha», confirme a senha e tente de novo.",
            "warn"
          );
          return;
        }
        if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
          showAuthMsg(
            "Senha incorreta. Use Esqueci a senha. Se nunca entrou, clique em «Primeira vez — criar senha».",
            "warn"
          );
          return;
        }
        if (code !== "auth/too-many-requests") recordAuthFailure();
        showAuthMsg(friendlyAuthError(signInErr), "error");
      }
    } catch (e) {
      if (e?.code !== "auth/too-many-requests") recordAuthFailure();
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
