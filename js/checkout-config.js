// Cole aqui os links do seu gateway externo (Stripe Payment Link, Hotmart, Kirvano, etc.)
// URL de sucesso do gateway: https://SEU-DOMINIO.vercel.app/?acesso=1
window.CHECKOUT_LINKS = {
  starter: "COLOQUE_SEU_LINK_STARTER_AQUI",
  pro: "COLOQUE_SEU_LINK_PRO_AQUI",
};

window.goToCheckout = function goToCheckout(plan) {
  const url = window.CHECKOUT_LINKS[plan] || window.CHECKOUT_LINKS.pro;
  if (!url || url.startsWith("COLOQUE_")) {
    alert(
      "Configure o link de pagamento em js/checkout-config.js (planos Starter e Pro)."
    );
    return;
  }
  window.location.href = url;
};
