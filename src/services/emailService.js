const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
  }

  /**
   * Verifica se a string informada é uma credencial real (não é placeholder de exemplo)
   */
  isRealCredential(val) {
    if (!val || typeof val !== 'string') return false;
    const lower = val.toLowerCase().trim();
    return (
      lower.length > 0 &&
      !lower.includes('seu_email') &&
      !lower.includes('sua_senha') &&
      !lower.includes('exemplo') &&
      !lower.includes('16_digitos') &&
      !lower.includes('seu-email')
    );
  }

  /**
   * Verifica se o ambiente possui credenciais SMTP válidas
   */
  hasRealSmtpConfig() {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const host = process.env.SMTP_HOST;
    return this.isRealCredential(user) && this.isRealCredential(pass) && !!host;
  }

  /**
   * Verifica se o ambiente possui chave do MailerSend
   */
  hasRealMailerSend() {
    return (
      process.env.MAILERSEND_API_KEY &&
      process.env.MAILERSEND_API_KEY.startsWith('mlsn.')
    );
  }

  /**
   * Verifica se o ambiente possui chave da Resend API (HTTP REST - nunca bloqueia por porta)
   */
  hasRealResend() {
    return (
      process.env.RESEND_API_KEY &&
      process.env.RESEND_API_KEY.startsWith('re_')
    );
  }

  /**
   * Verifica se o ambiente possui chave da Brevo API (HTTP REST - porta 443, 300 e-mails grátis/dia)
   */
  hasRealBrevo() {
    return (
      process.env.BREVO_API_KEY &&
      (process.env.BREVO_API_KEY.startsWith('xkeysib-') || process.env.BREVO_API_KEY.length > 20)
    );
  }

  /**
   * Cria um transportador SMTP para um host e porta específicos
   */
  createSmtpTransport(port, secure) {
    const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
    const user = (process.env.SMTP_USER || '').trim();
    const rawPass = (process.env.SMTP_PASS || '').trim();
    const pass = rawPass.replace(/\s+/g, '');

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      socketTimeout: 15000,
      tls: {
        rejectUnauthorized: false, // Evita falhas por antivírus / interceptadores de SSL locais
      },
    });
  }

  /**
   * Obtém ou inicializa o transportador SMTP do Nodemailer
   */
  async getTransporter() {
    if (this.transporter) {
      return this.transporter;
    }

    const preferredPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const preferredSecure = process.env.SMTP_SECURE === 'true' || preferredPort === 465;

    // Se as credenciais SMTP foram preenchidas com dados reais no .env
    if (this.hasRealSmtpConfig()) {
      this.transporter = this.createSmtpTransport(preferredPort, preferredSecure);
      return this.transporter;
    }

    // Modo desenvolvimento sem credenciais reais no .env:
    // Cria automaticamente uma conta temporária Ethereal (com link para visualizar o e-mail real no navegador)
    try {
      const testAccount = await nodemailer.createTestAccount();
      console.log('📬 [EmailService] Usando servidor de teste Ethereal (permite ver e-mails reais via link web).');
      this.transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      return this.transporter;
    } catch (err) {
      // Se não houver internet para o Ethereal, usa simulador em memória sem travar
      this.transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
      return this.transporter;
    }
  }

  /**
   * Testa a conectividade com o provedor de e-mail atual (testando porta 587 e 465 se necessário)
   */
  async verifyConnection() {
    if (this.hasRealBrevo()) {
      return { ok: true, provider: 'Brevo API (HTTP REST na porta 443)' };
    }
    if (this.hasRealResend()) {
      return { ok: true, provider: 'Resend API (HTTP REST na porta 443)' };
    }
    if (this.hasRealMailerSend()) {
      return { ok: true, provider: 'MailerSend API' };
    }
    if (this.hasRealSmtpConfig()) {
      const port1 = parseInt(process.env.SMTP_PORT || '587', 10);
      const secure1 = process.env.SMTP_SECURE === 'true' || port1 === 465;
      const t1 = this.createSmtpTransport(port1, secure1);

      try {
        await t1.verify();
        this.transporter = t1;
        return { ok: true, provider: `SMTP (${process.env.SMTP_HOST || 'Gmail'} na porta ${port1})` };
      } catch (err1) {
        // Tenta a porta alternativa (se tentou 587, tenta 465; se tentou 465, tenta 587)
        const altPort = port1 === 587 ? 465 : 587;
        const altSecure = altPort === 465;
        console.warn(`⚠️ Porta ${port1} falhou (${err1.message}). Tentando porta alternativa ${altPort}...`);
        
        try {
          const t2 = this.createSmtpTransport(altPort, altSecure);
          await t2.verify();
          this.transporter = t2;
          return { ok: true, provider: `SMTP (${process.env.SMTP_HOST || 'Gmail'} na porta ${altPort})` };
        } catch (err2) {
          return {
            ok: false,
            provider: 'SMTP',
            error: `Porta ${port1}: ${err1.message} | Porta ${altPort}: ${err2.message}`,
          };
        }
      }
    }
    return { ok: true, provider: 'Ethereal / Simulação Local' };
  }

  /**
   * Dispara e-mail de recuperação de senha com link direto e código OTP
   */
  async sendPasswordResetEmail({ email, nome, token }) {
    const rawFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const frontendUrl = rawFrontendUrl.split(',')[0].trim().replace(/\/+$/, '');
    const resetUrl = `${frontendUrl}/recuperar-senha?token=${token}&codigo=${token}&email=${encodeURIComponent(email)}`;
    
    // Tratamento de remetente (no Gmail, o sender precisa coincidir com o usuário autenticado)
    let fromAddress = process.env.SMTP_FROM || '"KeepStock" <nao-responda@keepstock.com.br>';
    if (this.hasRealSmtpConfig()) {
      const user = (process.env.SMTP_USER || '').trim();
      if (user.toLowerCase().endsWith('@gmail.com') && fromAddress.includes('keepstock.com.br')) {
        fromAddress = `"KeepStock" <${user}>`;
      }
    }

    const subject = 'Recuperação de Senha — KeepStock';

    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; padding: 40px 20px; color: #f8fafc;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #1e293b; border: 1px solid #334155; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          <!-- Cabeçalho -->
          <tr>
            <td style="padding: 32px 32px 20px; text-align: center; border-bottom: 1px solid #334155;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">
                <span style="color: #ffffff;">Keep</span><span style="color: #6366f1;">Stock</span>
              </h1>
              <p style="margin: 6px 0 0; font-size: 13px; color: #94a3b8;">Sistema de Gestão e Controle de Estoque</p>
            </td>
          </tr>

          <!-- Corpo -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 14px; font-size: 18px; color: #f8fafc; font-weight: 600;">
                Olá, ${nome || 'Usuário'}!
              </h2>
              <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #cbd5e1;">
                Recebemos uma solicitação para redefinir a senha da sua conta no <strong>KeepStock</strong>. Digite o código de verificação abaixo na tela de redefinição:
              </p>

              <!-- Bloco do Código OTP em Destaque -->
              <div style="background-color: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 22px 16px; margin: 24px 0; text-align: center;">
                <p style="margin: 0 0 10px; font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                  Código de Verificação de 6 Dígitos
                </p>
                <div style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 10px; background-color: #1e293b; color: #38bdf8; padding: 12px 24px; border-radius: 8px; border: 2px dashed #6366f1; display: inline-block;">
                  ${token}
                </div>
                <p style="margin: 10px 0 0; font-size: 12px; color: #64748b;">
                  Insira este código na tela de redefinição de senha do KeepStock.
                </p>
              </div>

              <!-- Botão Principal com Link Direto -->
              <div style="text-align: center; margin: 28px 0 20px;">
                <a href="${resetUrl}" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 13px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; display: inline-block; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);">
                  Redefinir Minha Senha com 1 Clique
                </a>
              </div>

              <p style="margin: 0 0 12px; font-size: 13px; line-height: 1.5; color: #94a3b8;">
                ⚠️ <strong>Atenção:</strong> Este código é válido por <strong>1 hora</strong>. Se você não solicitou a redefinição de senha, ignore este e-mail com segurança. Sua senha permanecerá inalterada.
              </p>
            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td style="background-color: #0b1120; padding: 20px 32px; text-align: center; border-top: 1px solid #334155; font-size: 12px; color: #64748b;">
              KeepStock &copy; ${new Date().getFullYear()} — Todos os direitos reservados.
            </td>
          </tr>
        </table>
      </div>
    `;

    const textContent = `Olá, ${nome || 'Usuário'}!\n\nPara redefinir sua senha no KeepStock, acesse o link:\n${resetUrl}\n\nOu utilize o token OTP: ${token}\n\nEste código expira em 1 hora.\nSe você não solicitou, ignore esta mensagem.`;

    // 1. Envio via Brevo API (HTTP REST na porta 443 - 300 e-mails grátis/dia para qualquer destinatário)
    if (this.hasRealBrevo()) {
      try {
        const brevoApiKey = process.env.BREVO_API_KEY.trim();
        const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER || 'keepstockplus@gmail.com';
        const senderName = process.env.BREVO_SENDER_NAME || 'KeepStock';

        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': brevoApiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            sender: { name: senderName, email: senderEmail },
            to: [{ email, name: nome || 'Usuário' }],
            subject,
            htmlContent: html,
            textContent: textContent,
          }),
        });

        const data = await response.json();
        if (response.ok) {
          console.log(`✉️  [Brevo API] E-mail enviado com sucesso para: ${email} (MessageId: ${data.messageId})`);
          this.logDevSummary({ email, nome, token, resetUrl });
          return { success: true, messageId: data.messageId };
        } else {
          let errorMsg = data.message || `Erro HTTP ${response.status} na Brevo API`;
          if (data.code === 'unauthorized' || response.status === 401) {
            errorMsg = '[Brevo] Chave de API (BREVO_API_KEY) inválida ou não autorizada.';
          } else if (data.message && data.message.toLowerCase().includes('sender')) {
            errorMsg = `[Brevo] O e-mail de remetente "${senderEmail}" não está verificado na sua conta Brevo. Use em BREVO_SENDER_EMAIL no .env o mesmo e-mail com que se cadastrou na Brevo.`;
          }
          console.warn(`⚠️ [Brevo API] Falha no envio:`, errorMsg);
          this.logDevSummary({ email, nome, token, resetUrl, error: errorMsg });
          return { success: false, error: errorMsg };
        }
      } catch (err) {
        console.warn(`⚠️ [Brevo API] Erro ao disparar:`, err.message);
        this.logDevSummary({ email, nome, token, resetUrl, error: err.message });
        return { success: false, error: err.message };
      }
    }

    // 2. Envio via Resend API (HTTP REST na porta 443 - imune a bloqueios de portas SMTP de operadoras/nuvem)
    if (this.hasRealResend()) {
      try {
        const resendApiKey = process.env.RESEND_API_KEY.trim();
        const resendFrom = process.env.RESEND_FROM || 'KeepStock <onboarding@resend.dev>';
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: resendFrom,
            to: [email],
            subject,
            html,
            text: textContent,
          }),
        });
        const data = await response.json();
        if (response.ok) {
          console.log(`✉️  [Resend API] E-mail enviado com sucesso para: ${email} (ID: ${data.id})`);
          this.logDevSummary({ email, nome, token, resetUrl });
          return { success: true, messageId: data.id };
        } else {
          let errorMsg = data.message || `Erro HTTP ${response.status} na Resend API`;
          if (response.status === 403 && data.message && data.message.includes('only send testing emails')) {
            errorMsg = `[Resend] No plano gratuito do Resend, você só pode enviar e-mails para o endereço de e-mail que você usou para se cadastrar no Resend. Cadastre um domínio próprio em resend.com/domains ou teste enviando para o seu próprio e-mail do cadastro.`;
          }
          console.warn(`⚠️ [Resend API] Falha no envio:`, errorMsg);
          this.logDevSummary({ email, nome, token, resetUrl, error: errorMsg });
          return { success: false, error: errorMsg };
        }
      } catch (err) {
        console.warn(`⚠️ [Resend API] Erro ao disparar:`, err.message);
        this.logDevSummary({ email, nome, token, resetUrl, error: err.message });
        return { success: false, error: err.message };
      }
    }

    // 2. Envio via MailerSend REST API (se configurado)
    if (this.hasRealMailerSend()) {
      try {
        const fromEmail = process.env.MAILERSEND_FROM_EMAIL || 'info@trial.mailersend.net';
        const fromName = process.env.MAILERSEND_FROM_NAME || 'KeepStock';

        const msResponse = await fetch('https://api.mailersend.com/v1/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'Authorization': `Bearer ${process.env.MAILERSEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: { email: fromEmail, name: fromName },
            to: [{ email, name: nome || 'Usuário' }],
            subject,
            html,
            text: textContent,
          }),
        });

        if (msResponse.status === 202 || msResponse.ok) {
          const messageId = msResponse.headers.get('x-message-id');
          console.log(`✉️  [MailerSend API] E-mail enviado com sucesso para: ${email}`);
          this.logDevSummary({ email, nome, token, resetUrl });
          return { success: true, messageId };
        } else {
          const errData = await msResponse.json().catch(() => ({}));
          console.warn(`⚠️ [MailerSend API] Falha na API:`, errData.message || '');
        }
      } catch (msErr) {
        console.warn(`⚠️ [MailerSend API] Exceção de rede:`, msErr.message);
      }
    }

    // 3. Envio via SMTP (com fallback automático de portas 587 e 465)
    let lastError = null;

    if (this.hasRealSmtpConfig()) {
      const port1 = parseInt(process.env.SMTP_PORT || '587', 10);
      const secure1 = process.env.SMTP_SECURE === 'true' || port1 === 465;
      const portsToTry = [
        { port: port1, secure: secure1 },
        { port: port1 === 587 ? 465 : 587, secure: port1 === 587 },
      ];

      for (const { port, secure } of portsToTry) {
        try {
          const t = this.createSmtpTransport(port, secure);
          const info = await t.sendMail({
            from: fromAddress,
            to: email,
            subject,
            html,
            text: textContent,
          });

          console.log(`✉️  E-mail enviado com sucesso para ${email} (via porta ${port})`);
          this.logDevSummary({ email, nome, token, resetUrl });
          this.transporter = t;
          return { success: true, messageId: info.messageId };
        } catch (err) {
          lastError = err;
          console.warn(`⚠️ Tentativa na porta ${port} falhou (${err.message}).`);
        }
      }
    } else {
      // Ethereal / simulador em desenvolvimento
      try {
        const transporter = await this.getTransporter();
        const info = await transporter.sendMail({
          from: fromAddress,
          to: email,
          subject,
          html,
          text: textContent,
        });

        const previewUrl = nodemailer.getTestMessageUrl(info);
        this.logDevSummary({ email, nome, token, resetUrl, previewUrl });
        return {
          success: true,
          messageId: info.messageId,
          ...(previewUrl ? { previewUrl } : {}),
        };
      } catch (err) {
        lastError = err;
      }
    }

    // Se todas as tentativas falharem:
    console.error(`❌ Erro ao enviar e-mail para ${email}:`, lastError?.message || 'Falha de conexão');
    this.logDevSummary({ email, nome, token, resetUrl, error: lastError?.message });
    return { success: false, error: lastError?.message || 'Falha de conexão SMTP' };
  }

  /**
   * Registra log amigável e legível no console
   */
  logDevSummary({ email, nome, token, resetUrl, previewUrl, error }) {
    console.log('\n================================================================');
    console.log('📧 [KEEPSTOCK] DISPARO DE E-MAIL DE RECUPERAÇÃO');
    console.log(`👤 Destinatário: ${nome || 'Usuário'} <${email}>`);
    console.log(`🔢 Código OTP (6 dígitos): \x1b[32m${token}\x1b[0m`);
    console.log(`🔗 Link de Redefinição: ${resetUrl}`);
    if (previewUrl) {
      console.log(`🌐 Preview do E-mail (Abrir no Navegador): \x1b[36m${previewUrl}\x1b[0m`);
    }
    if (error) {
      console.log(`⚠️ Falha no envio SMTP: \x1b[31m${error}\x1b[0m`);
      console.log('💡 Dica: Se sua rede/operadora bloqueia conexões SMTP, use a Resend API (HTTP) ou utilize o código OTP acima.');
    }
    console.log('================================================================\n');
  }
}

module.exports = new EmailService();
