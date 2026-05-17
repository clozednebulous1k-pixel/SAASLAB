// Chaves públicas do Firebase (podem ficar no front)
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCR-ealkay9uW-uFoM1ATw0cKqxeCGkroc",
  authDomain: "devserver-4d2c8.firebaseapp.com",
  projectId: "devserver-4d2c8",
  storageBucket: "devserver-4d2c8.firebasestorage.app",
  messagingSenderId: "627408482482",
  appId: "1:627408482482:web:4bba0444b9c71c174919ab",
};

// Admin: defina SOMENTE no Firestore Console → users/{uid} → role: "admin"
// Não use lista de e-mails admin no front — regras do Firestore são a proteção real.
// Recomendado no Console: Authentication → App Check (bloqueia scripts não autorizados).
