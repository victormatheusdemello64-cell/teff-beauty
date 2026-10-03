# Supabase - Teff Exclusivo

Esta pasta prepara o banco online do app Teff Exclusivo.

## O que ja esta modelado

A migration `migrations/20261003203000_init_teff_exclusivo.sql` cria:

- perfis de usuario com papel `admin` ou `cliente`;
- configuracoes da loja, incluindo chave Pix;
- produtos com estoque, custo, preco, ativo/oculto;
- carrinho online;
- pedidos, itens de pedido e status `CONFIRMADO`, `ENTREGUE`, `CANCELADO`, `PAGO`, `FECHADO`;
- pagamentos Pix e vinculo com pedidos;
- fechamentos/ciclos;
- movimentos de estoque;
- regras RLS para separar cliente e administrador;
- funcoes para cliente confirmar entrega, cancelar pedido e gerar pagamento Pix do saldo pendente.

## Aplicar no Supabase

Se a integracao GitHub do Supabase aplicar migrations automaticamente, basta confirmar que essa migration entrou no painel do Supabase.

Se nao aplicar automaticamente:

1. Abra o painel do Supabase.
2. Entre em SQL Editor.
3. Copie o conteudo de `supabase/migrations/20261003203000_init_teff_exclusivo.sql`.
4. Execute uma unica vez.

## Tornar o primeiro usuario administrador

Depois que o primeiro usuario for criado pelo app/Auth, rode no SQL Editor, trocando o e-mail:

```sql
update public.profiles
set role = 'admin',
    full_name = 'Administrador',
    username = 'admin'
where id = (
  select id
  from auth.users
  where email = 'SEU_EMAIL_AQUI'
);
```

## Variaveis do app

Use estas variaveis no front-end/site quando formos ligar as telas ao Supabase:

```env
VITE_SUPABASE_URL=https://xzkjgvdyfoertreyjdag.supabase.co
VITE_SUPABASE_ANON_KEY=cole_a_anon_public_key_aqui
```

Nao coloque `service_role`, senha do banco ou tokens secretos no app, no GitHub ou no APK.
