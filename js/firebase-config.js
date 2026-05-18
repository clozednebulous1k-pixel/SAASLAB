// Chaves públicas do Firebase (podem ficar no front)
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCR-ealkay9uW-uFoM1ATw0cKqxeCGkroc",
  authDomain: "devserver-4d2c8.firebaseapp.com",
  projectId: "devserver-4d2c8",
  storageBucket: "devserver-4d2c8.firebasestorage.app",
  messagingSenderId: "627408482482",
  appId: "1:627408482482:web:4bba0444b9c71c174919ab",
};

// Admin: Firestore Console → users/{uid} → role: "admin" (só para você)
// Dono: js/owner-config.js PRIMARY_ADMIN_UID + firestore.rules ownerUid(), MESMO UID
// Valores (acesso, compra, libraryAccess): só o dono altera; F12 não consegue gravar no Firestore.
// Recomendado: Authentication → App Check
