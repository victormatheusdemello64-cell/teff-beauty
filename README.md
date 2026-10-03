# Teff Exclusivo

Projeto da loja Teff Exclusivo com PWA web conectada ao Supabase e APK Android wrapper.

- Nome do app: Teff Exclusivo
- Versao Android: 15
- Package: `com.teffbeauty.exclusivo.v13`
- APK gerado pelo workflow: `Teff-Exclusivo-v15.apk`
- PWA web: https://victormatheusdemello64-cell.github.io/teff-beauty/
- Supabase: https://xzkjgvdyfoertreyjdag.supabase.co

## Estrutura

- `web/`: app responsivo/PWA conectado ao Supabase.
- `app/`: wrapper Android WebView que abre a PWA.
- `supabase/`: migrations do banco online.

## Supabase

A pasta `supabase/` contem as migrations do banco online para uso compartilhado entre aparelhos.

Ela prepara:

- perfis de cliente/admin;
- produtos, estoque e vitrine;
- carrinho/pedido online;
- pedidos e itens;
- confirmacao de entrega e cancelamento com devolucao de estoque;
- pagamentos Pix;
- fechamentos/ciclos;
- configuracoes da loja, incluindo chave Pix.

Nao coloque `service_role`, senha do banco ou tokens secretos no app, no GitHub ou no APK.
