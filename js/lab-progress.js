/**
 * Progresso do laboratório por aluno — Firestore users/{uid}
 * Cada login tem seu próprio nome do SaaS, passo atual e módulos concluídos.
 */
(function () {
  const DEBOUNCE_MS = 700;
  let saveTimer = null;
  let loadedUid = null;
  let saving = false;

  function db() {
    return typeof window.getFirebaseDb === "function" ? window.getFirebaseDb() : null;
  }

  function auth() {
    return typeof window.getFirebaseAuth === "function" ? window.getFirebaseAuth() : null;
  }

  function collectLabState() {
    const completed = window.completedSteps;
    return {
      labSaasName: String(window.saasName || "MeuSaaS").slice(0, 120),
      labSaasBrief: String(window.saasBrief || "").slice(0, 2000),
      labOnboarded: localStorage.getItem("saaslab_onboarded") === "1",
      labCurrentStep: Number(window.currentStep) || 0,
      labCompletedSteps: completed instanceof Set ? Array.from(completed) : [],
      labSelectedDb: String(window.selectedDb || "firebase").slice(0, 40),
      labSelectedAuth: String(window.selectedAuth || "firebase").slice(0, 40),
      labSelectedDeploy: String(window.selectedDeployTarget || "vercel").slice(0, 40),
      labSelectedPayment: String(window.selectedPayment || "hotmart").slice(0, 40),
      labCourseDone: localStorage.getItem("saaslab_course_complete") === "1",
    };
  }

  function applyLabState(data) {
    if (!data) return false;

    if (typeof data.labSaasName === "string" && data.labSaasName.trim()) {
      window.saasName = data.labSaasName.trim();
      localStorage.setItem("saaslab_name", window.saasName);
    }
    if (typeof data.labSaasBrief === "string") {
      window.saasBrief = data.labSaasBrief;
      localStorage.setItem("saaslab_brief", window.saasBrief);
    }
    if (data.labOnboarded === true) {
      localStorage.setItem("saaslab_onboarded", "1");
    }
    if (typeof data.labCurrentStep === "number" && !Number.isNaN(data.labCurrentStep)) {
      window.currentStep = Math.max(0, data.labCurrentStep);
    }
    if (Array.isArray(data.labCompletedSteps)) {
      window.completedSteps = new Set(
        data.labCompletedSteps.filter((n) => typeof n === "number" && n >= 0)
      );
    }
    if (typeof data.labSelectedDb === "string") {
      window.selectedDb = data.labSelectedDb;
      localStorage.setItem("saaslab_db", data.labSelectedDb);
    }
    if (typeof data.labSelectedAuth === "string") {
      window.selectedAuth = data.labSelectedAuth;
      localStorage.setItem("saaslab_auth", data.labSelectedAuth);
    }
    if (typeof data.labSelectedDeploy === "string") {
      window.selectedDeployTarget = data.labSelectedDeploy;
    }
    if (typeof data.labSelectedPayment === "string") {
      window.selectedPayment = data.labSelectedPayment;
    }
    if (data.labCourseDone === true) {
      localStorage.setItem("saaslab_course_complete", "1");
    }

    const nameEl = document.getElementById("saas-name");
    if (nameEl) nameEl.value = window.saasName || "MeuSaaS";
    if (typeof window.applySaasToMockup === "function") window.applySaasToMockup();
    if (typeof window.updateProgress === "function") window.updateProgress();
    return true;
  }

  function migrateFromLocalStorage() {
    return {
      labSaasName: localStorage.getItem("saaslab_name") || window.saasName || "MeuSaaS",
      labSaasBrief: localStorage.getItem("saaslab_brief") || "",
      labOnboarded: localStorage.getItem("saaslab_onboarded") === "1",
      labCurrentStep: Number(window.currentStep) || 0,
      labCompletedSteps:
        window.completedSteps instanceof Set ? Array.from(window.completedSteps) : [],
      labSelectedDb: localStorage.getItem("saaslab_db") || window.selectedDb || "firebase",
      labSelectedAuth: localStorage.getItem("saaslab_auth") || window.selectedAuth || "firebase",
      labSelectedDeploy: window.selectedDeployTarget || "vercel",
      labSelectedPayment: window.selectedPayment || "hotmart",
      labCourseDone: localStorage.getItem("saaslab_course_complete") === "1",
    };
  }

  function hasLabData(data) {
    return (
      data &&
      (data.labSaasName ||
        data.labSaasBrief ||
        data.labOnboarded ||
        (Array.isArray(data.labCompletedSteps) && data.labCompletedSteps.length) ||
        typeof data.labCurrentStep === "number")
    );
  }

  window.loadLabProgress = async function loadLabProgress() {
    const firestore = db();
    const user = auth()?.currentUser;
    if (!firestore || !user) {
      if (typeof window.loadSaasProfile === "function") window.loadSaasProfile();
      return false;
    }

    try {
      const snap = await firestore.collection("users").doc(user.uid).get();
      const data = snap.exists ? snap.data() : null;

      if (hasLabData(data)) {
        applyLabState(data);
        loadedUid = user.uid;
        const step = window.currentStep ?? 0;
        if (typeof window.gotoStep === "function") window.gotoStep(step);
        else if (typeof window.renderStep === "function") window.renderStep(step);
        return true;
      }

      const migrated = migrateFromLocalStorage();
      applyLabState(migrated);
      await firestore.collection("users").doc(user.uid).set(
        { ...migrated, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
      loadedUid = user.uid;
      return true;
    } catch (e) {
      console.error("loadLabProgress", e);
      if (typeof window.loadSaasProfile === "function") window.loadSaasProfile();
      return false;
    }
  };

  window.saveLabProgress = function saveLabProgress() {
    const firestore = db();
    const user = auth()?.currentUser;
    if (!firestore || !user) return;

    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      if (saving) return;
      saving = true;
      try {
        const payload = collectLabState();
        await firestore.collection("users").doc(user.uid).set(
          {
            ...payload,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        loadedUid = user.uid;
      } catch (e) {
        console.error("saveLabProgress", e);
      } finally {
        saving = false;
      }
    }, DEBOUNCE_MS);
  };

  window.flushLabProgress = async function flushLabProgress() {
    const firestore = db();
    const user = auth()?.currentUser;
    if (!firestore || !user) return;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    try {
      const payload = collectLabState();
      await firestore.collection("users").doc(user.uid).set(
        {
          ...payload,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      console.error("flushLabProgress", e);
    }
  };

  const prevOnLabEntered = window.onLabEntered;
  window.onLabEntered = function onLabEnteredWithProgress() {
    window.loadLabProgress?.().then(() => {
      prevOnLabEntered?.();
    });
  };
})();
