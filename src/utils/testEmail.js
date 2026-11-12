require('dotenv').config();
const emailService = require('../services/emailService');

async function testEmail() {
  const targetEmail = process.argv[2] || process.env.SMTP_USER || 'teste@keepstock.com';

  console.log('====================================================');
  console.log('   🧪 TESTE DE ENVIO DE E-MAIL - KEEPSTOCK          ');
  console.log('====================================================');
  console.log(`Configuração detectada:`);
  console.log(` - SMTP_HOST: ${process.env.SMTP_HOST || '(não definido)'}`);
  console.log(` - SMTP_PORT: ${process.env.SMTP_PORT || '587'}`);
  console.log(` - SMTP_USER: ${process.env.SMTP_USER || '(não definido)'}`);
  console.log(` - SMTP_PASS: ${process.env.SMTP_PASS ? '********' : '(não definido)'}`);
  console.log(` - Destinatário do teste: ${targetEmail}`);
  console.log('----------------------------------------------------');

  console.log('🔍 Testando conexão com o servidor de e-mail (com fallback de portas)...');
  const conn = await emailService.verifyConnection();
  if (conn.ok) {
    console.log(`✅ Conexão bem-sucedida! Provedor: ${conn.provider}`);
  } else {
    console.warn(`⚠️ Aviso na conexão: ${conn.error}`);
  }

  console.log('\n🚀 Disparando e-mail de teste de recuperação de senha...');
  const result = await emailService.sendPasswordResetEmail({
    email: targetEmail,
    nome: 'Usuário de Teste',
    token: '789123',
  });

  if (result.success) {
    console.log('🎉 SUCESSO: E-mail entregue com êxito!');
    if (result.previewUrl) {
      console.log(`🔗 Acesse este link para ver o e-mail no navegador: ${result.previewUrl}`);
    } else {
      console.log(`📬 Verifique a caixa de entrada (e pasta de spam) de: ${targetEmail}`);
    }
  } else {
    console.error(`❌ FALHA: Não foi possível enviar.`);
    console.error(`   Detalhes: ${result.error}`);
    console.log('\n💡 Se a sua operadora de internet (ou firewall/antivírus) estiver bloqueando portas SMTP (25, 465, 587):');
    console.log('   Você pode usar a RESEND API gratuitamente via HTTP porta 443 (nunca bloqueia).');
    console.log('   Basta criar uma chave grátis em https://resend.com e adicionar no .env:');
    console.log('   RESEND_API_KEY=re_sua_chave_aqui');
  }
  console.log('====================================================');
}

testEmail();
