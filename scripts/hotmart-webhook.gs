    /**
    * Cole em script.google.com → Salvar → Implantar → Nova implantação → App da Web → Qualquer pessoa
    * Propriedades do script: FIREBASE_PROJECT_ID, HOTTOK, SERVICE_ACCOUNT_JSON
    */
    const PROP = PropertiesService.getScriptProperties();

    function doGet() {
      return ContentService.createTextOutput('OK Hotmart webhook');
    }

    function doPost(e) {
      try {
        if (!e || !e.postData) {
          return jsonOut({ ok: false, error: 'no body' });
        }

    const hottokExpected = String(PROP.getProperty('HOTTOK') || '').trim();
    const hottokGot = String((e.parameter && e.parameter.hottok) || '').trim();
    if (hottokExpected && hottokGot !== hottokExpected) {
      return jsonOut({
        ok: false,
        error: 'invalid hottok',
        hint: 'Propriedade HOTTOK no Apps Script deve ser igual ao token da Hotmart (aba Autenticacao) e ao ?hottok= na URL'
      });
    }

        const raw = e.postData.contents || '';
        let body = {};
        try {
          body = JSON.parse(raw);
        } catch (err) {
          body = parseLegacyHotmart(e.parameter || {});
        }

        const event = String(body.event || body.status || '').toUpperCase();
        const email = extractBuyerEmail(body);
        if (!email) {
          return jsonOut({ ok: false, error: 'email not found', event: event });
        }

        const productId = PROP.getProperty('HOTMART_PRODUCT_ID');
        const pid = String(body.data && body.data.product && body.data.product.id || body.prod || '');
        if (productId && pid && pid !== productId) {
          return jsonOut({ ok: false, error: 'product mismatch', pid: pid });
        }

        const key = normalizeEmail(email);

        if (isApproveEvent(event, body)) {
          grantAccess(key);
          return jsonOut({ ok: true, action: 'granted', email: key });
        }

        if (isRevokeEvent(event, body)) {
          revokeAccess(key);
          return jsonOut({ ok: true, action: 'revoked', email: key });
        }

        return jsonOut({ ok: true, action: 'ignored', event: event });
      } catch (err) {
        return jsonOut({ ok: false, error: String(err) });
      }
    }

    function normalizeEmail(email) {
      return String(email || '').trim().toLowerCase();
    }

    function extractBuyerEmail(body) {
      return (
        (body.data && body.data.buyer && body.data.buyer.email) ||
        (body.buyer && body.buyer.email) ||
        body.email ||
        body['buyer.email'] ||
        ''
      );
    }

    function isApproveEvent(event, body) {
      const approved = ['PURCHASE_APPROVED', 'PURCHASE_COMPLETE', 'APPROVED', 'COMPLETED'];
      if (approved.indexOf(event) >= 0) return true;
      const st = String(
        (body.data && body.data.purchase && body.data.purchase.status) || body.status || ''
      ).toUpperCase();
      return st === 'APPROVED' || st === 'COMPLETE';
    }

    function isRevokeEvent(event) {
      const revoked = ['PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK', 'REFUNDED', 'CHARGEBACK'];
      return revoked.indexOf(event) >= 0;
    }

    function parseLegacyHotmart(p) {
      return { event: p.status, email: p.email, prod: p.prod, status: p.status };
    }

    function grantAccess(emailKey) {
      writeEmailAccess(emailKey, true);
    }

    function revokeAccess(emailKey) {
      writeEmailAccess(emailKey, false);
    }

    function writeEmailAccess(emailKey, active) {
      const projectId = PROP.getProperty('FIREBASE_PROJECT_ID') || 'devserver-4d2c8';
      const token = getServiceAccountToken();
      const docId = encodeURIComponent(emailKey);
      const url =
        'https://firestore.googleapis.com/v1/projects/' +
        projectId +
        '/databases/(default)/documents/email_access/' +
        docId;

      const now = new Date().toISOString();
      const payload = {
        fields: {
          active: { booleanValue: !!active },
          email: { stringValue: emailKey },
          updatedAt: { timestampValue: now }
        }
      };

      const res = UrlFetchApp.fetch(url, {
        method: 'patch',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + token },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      const code = res.getResponseCode();
      if (code !== 200) {
        throw new Error('Firestore ' + code + ': ' + res.getContentText());
      }
    }

    function getServiceAccountToken() {
      const json = PROP.getProperty('SERVICE_ACCOUNT_JSON');
      if (!json) throw new Error('SERVICE_ACCOUNT_JSON missing');
      const sa = JSON.parse(json);

      const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
      const now = Math.floor(Date.now() / 1000);
      const claim = base64Url(
        JSON.stringify({
          iss: sa.client_email,
          scope: 'https://www.googleapis.com/auth/datastore',
          aud: 'https://oauth2.googleapis.com/token',
          iat: now,
          exp: now + 3600
        })
      );

      const toSign = header + '.' + claim;
      const sig = Utilities.computeRsaSha256Signature(toSign, sa.private_key);
      const jwt = toSign + '.' + base64Url(sig);

      const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
        method: 'post',
        contentType: 'application/x-www-form-urlencoded',
        payload: {
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt
        },
        muteHttpExceptions: true
      });

      const data = JSON.parse(res.getContentText());
      if (!data.access_token) {
        throw new Error('Token error: ' + res.getContentText());
      }
      return data.access_token;
    }

    function base64Url(bytesOrString) {
      const bytes =
        typeof bytesOrString === 'string'
          ? Utilities.newBlob(bytesOrString).getBytes()
          : bytesOrString;
      return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
    }

    function jsonOut(obj) {
      return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
        ContentService.MimeType.JSON
      );
    }

    /** Executar uma vez no editor para testar Firestore sem Hotmart */
    function grantAccessTest() {
      grantAccess('aluno.teste.saasacademy@gmail.com');
    }
