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
    const configuredAdmin = isConfiguredAdmin(user.email);

    if (!snap.exists) {

      const providerId = user.providerData?.[0]?.providerId || "password";

      await ref.set({

        email,

        role: configuredAdmin ? "admin" : "user",

        libraryAccess: !!configuredAdmin,

        authProvider: providerId,

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
      if (isAdmin) {
        adminFab.hidden = false;
        adminFab.classList.add("is-visible");
      } else {
        adminFab.hidden = true;
        adminFab.classList.remove("is-visible");
      }
    }

    if (adminLink) {
      adminLink.style.display = isAdmin ? "block" : "none";
    }

    if (userBtn) {
      const name = user?.email ? user.email.split("@")[0] : "Conta";
      userBtn.textContent = isAdmin ? name + " (admin)" : name;
      userBtn.title = isAdmin ? "Logado como admin — use Painel admin ou o botão Admin no canto" : "Sair da conta";
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

    switchAccessTab(tab === "activate" ? "login" : tab || "login");

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

      openAccessGate("login");

      showAuthMsg(

        "Compra não liberada para este e-mail. Use o mesmo e-mail do pagamento ou aguarde a confirmação.",

        "warn"

      );

      return;

    }

    window.enterPlatformCore();

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
        window.enterPlatformCore();
      }
      return true;
    }

    if (signOutIfDenied && auth) {
      await auth.signOut();
      window.__labUserProfile = null;
      updateAccessNav(null);
    }

    switchAccessTab("login");

    const email = normalizeEmail(user?.email);
    showAuthMsg(
      signOutIfDenied
        ? `O Gmail ${email} não tem compra liberada. Use o mesmo e-mail do pagamento ou aguarde a confirmação.`
        : "Conta criada, mas o laboratório ainda não está liberado. Aguarde a confirmação da compra ou fale no WhatsApp.",
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

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      showAuthMsg("Conectando com Google…", "info");
      const result = await auth.signInWithPopup(provider);
      const user = result.user;

      if (!user?.email) {
        await auth.signOut();
        updateAccessNav(null);
        showAuthMsg(
          "Não foi possível ler o e-mail do Google. Use login com e-mail e senha.",
          "error"
        );
        return;
      }

      saveRememberedEmail(user.email);

      if (window.isLabAdmin(user)) {
        showAuthMsg("Bem-vindo, admin!", "success");
      } else {
        showAuthMsg("Verificando se este Gmail tem compra liberada…", "info");
      }

      await afterAuthSuccess(user, { signOutIfDenied: true });
    } catch (e) {
      const code = e?.code || "";
      if (code === "auth/popup-closed-by-user") {
        showAuthMsg("", "");
        return;
      }
      if (code === "auth/account-exists-with-different-credential") {
        showAuthMsg(
          "Este e-mail já foi cadastrado com senha. Entre com e-mail e senha na aba Entrar.",
          "warn"
        );
        return;
      }
      if (code === "auth/operation-not-allowed") {
        showAuthMsg(
          "Login com Google não está ativo no Firebase. Ative em Authentication → Google.",
          "error"
        );
        return;
      }
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

    try {

      showAuthMsg("Entrando…", "info");

      await auth.signInWithEmailAndPassword(email, pass);
      saveRememberedEmail(email);
      await refreshLabUserProfile(auth.currentUser);
      updateAccessNav(auth.currentUser);

      if (window.isLabAdmin(auth.currentUser)) {
        showAuthMsg(
          "Bem-vindo, admin! Clique em Painel admin ou no botão Admin (canto inferior direito).",
          "success"
        );
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
      saveRememberedEmail(email);

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
      "auth/popup-blocked": "O navegador bloqueou a janela do Google. Permita pop-ups e tente de novo.",
      "auth/cancelled-popup-request": "Aguarde a janela do Google e tente novamente.",

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

  const REMEMBER_EMAIL_KEY = "saaslab_remember_email";

  function saveRememberedEmail(email) {
    const remember =
      document.getElementById("access-remember")?.checked ||
      document.getElementById("access-remember-reg")?.checked;
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
    const regEmail = document.getElementById("access-reg-email");
    const remember = document.getElementById("access-remember");
    const rememberReg = document.getElementById("access-remember-reg");
    if (loginEmail) loginEmail.value = saved;
    if (regEmail) regEmail.value = saved;
    if (remember) remember.checked = true;
    if (rememberReg) rememberReg.checked = true;
  };

  window.toggleAccessPassword = function toggleAccessPassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input || !btn) return;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.textContent = show ? "Ocultar" : "Ver";
    btn.setAttribute("aria-label", show ? "Ocultar senha" : "Mostrar senha");
  };

  window.accessForgotPassword = async function accessForgotPassword() {
    initFirebaseAccess();
    const email =
      document.getElementById("access-email")?.value?.trim() ||
      document.getElementById("access-reg-email")?.value?.trim();
    if (!email) {
      showAuthMsg("Digite seu e-mail acima para receber o link de redefinição.", "warn");
      switchAccessTab("login");
      return;
    }
    if (!auth) {
      showAuthMsg("Firebase não carregou. Recarregue a página.", "error");
      return;
    }
    try {
      showAuthMsg("Enviando link para seu e-mail…", "info");
      await auth.sendPasswordResetEmail(email);
      showAuthMsg("Link enviado! Verifique sua caixa de entrada e o spam.", "success");
    } catch (e) {
      const code = e?.code || "";
      if (code === "auth/user-not-found") {
        showAuthMsg("Nenhuma conta com este e-mail. Crie uma conta na aba Criar conta.", "warn");
      } else {
        showAuthMsg(e?.message || "Não foi possível enviar o e-mail.", "error");
      }
    }
  };

})();


