// supabase/functions/create-user/index.ts
// Deploy: supabase functions deploy create-user
//
// Cria um novo usuário (ADMIN ou COLLECTOR) usando a service_role key.
// Só pode ser chamada por usuários com role = ADMIN.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Cliente com anon key — para verificar quem está chamando
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Verifica se o chamador é ADMIN
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await anonClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'ADMIN') {
      return new Response(JSON.stringify({ error: 'Acesso negado. Apenas ADMINs.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cliente admin com service_role — para criar usuários
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { name, email, password, role } = await req.json();

    if (!name || !email || !password) {
      return new Response(JSON.stringify({ error: 'name, email e password são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const allowedRoles = ['ADMIN', 'COLLECTOR'];
    if (!allowedRoles.includes(role)) {
      return new Response(JSON.stringify({ error: 'Role inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cria o usuário no Supabase Auth
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // confirma email automaticamente
      user_metadata: { name, role },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cria o profile manualmente (o trigger handle_new_user também vai criar,
    // mas fazemos aqui para garantir consistência imediata)
    await adminClient.from('profiles').upsert({
      id:    newUser.user.id,
      name,
      login: email.toLowerCase(),
      role,
    });

    return new Response(
      JSON.stringify({ id: newUser.user.id, login: email, name, role }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
