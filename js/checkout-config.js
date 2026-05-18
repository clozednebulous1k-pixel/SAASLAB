// Hotmart, links de checkout (Produtos → Links de divulgação)
// Página de obrigado na Hotmart: https://SEU-DOMINIO.vercel.app/?acesso=1
window.CHECKOUT_LINKS = {
  starter: "https://pay.hotmart.com/R105874305C",
  pro: "https://pay.hotmart.com/R105874305C",
};

window.goToCheckout = function goToCheckout(plan) {
  const url = window.CHECKOUT_LINKS[plan] || window.CHECKOUT_LINKS.pro;
  if (!url || url.startsWith("COLOQUE_")) {
    alert(
      "Configure o link de pagamento em js/checkout-config.js."
    );
    return;
  }
  window.location.href = url;
};
