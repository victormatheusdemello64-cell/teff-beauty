# Teff Exclusivo

Projeto Android wrapper da loja Teff Beauty, apontando para a versao 12 publicada no Sites com acesso publico para clientes.

- Nome do app: Teff Exclusivo
- Versao: 14
- Package: `com.teffbeauty.exclusivo.v13`
- APK gerado pelo workflow: `Teff-Exclusivo-v14.apk`
- URL base: https://teff-beauty.victormatheusdemello.chatgpt.site/?v=14-publico

Esta base evita o problema dos APKs anteriores que tentavam abrir dominio `.local`, arquivos internos indisponiveis ou tela de login do ChatGPT.

## Supabase

A pasta `supabase/` contem a primeira migration do banco online para transformar o app em uso compartilhado entre aparelhos.

Ela prepara:

- perfis de cliente/admin;
- produtos, estoque e vitrine;
- carrinho online;
- pedidos e itens;
- confirmacao de entrega e cancelamento com devolucao de estoque;
- pagamentos Pix;
- fechamentos/ciclos;
- configuracoes da loja, incluindo chave Pix.

Proximo passo: ligar o codigo do site/app ao Supabase usando a URL do projeto e a anon public key, sem colocar chaves secretas no APK.
