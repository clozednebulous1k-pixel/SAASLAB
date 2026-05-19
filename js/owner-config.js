/**
 * DONO do sistema — só este UID pode alterar compras, acessos e libraryAccess.
 * 1. Firebase Console → Authentication → Users → copie o "User UID"
 * 2. Cole abaixo (mesmo valor em firestore.rules → function ownerUid())
 * 3. Publique as regras no Firestore e faça deploy do site
 */
window.PRIMARY_ADMIN_UID = "MIeIJUA1ASPyBugizErLH98OIvR2";

window.isPrimaryOwner = function isPrimaryOwner(user) {
  const expected = String(window.PRIMARY_ADMIN_UID || "").trim();
  if (!expected || !user?.uid) return false;
  return user.uid === expected;
};
