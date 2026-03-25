/**
 * POST /api/v1/auth/seed-admin
 * One-time admin user creation. Only works if no users exist.
 * Should be called once during initial setup, then removed or disabled.
 */

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Missing Supabase env vars' },
      { status: 500 }
    )
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // Check if users already exist
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1 })
  if (existingUsers && existingUsers.users.length > 0) {
    return NextResponse.json(
      { error: 'Admin user already exists. This endpoint is disabled.' },
      { status: 403 }
    )
  }

  // Create admin user
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: 'emendoza@ainnovateagency.com',
    password: 'Casax346116',
    email_confirm: true,
    user_metadata: {
      full_name: 'Emanuel Mendoza',
    },
  })

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    )
  }

  // Create default workspace for admin
  const { data: workspace, error: wsError } = await supabaseAdmin
    .from('workspaces')
    .insert({
      owner_id: data.user.id,
      name: 'AInnovate Agency',
      slug: 'ainnovate',
      plan: 'pro',
      reels_limit: 1000,
    })
    .select('id')
    .single()

  // Add admin as owner in workspace_members
  if (workspace) {
    await supabaseAdmin.from('workspace_members').insert({
      workspace_id: workspace.id,
      user_id: data.user.id,
      role: 'owner',
    })
  }

  return NextResponse.json({
    data: {
      user_id: data.user.id,
      email: data.user.email,
      workspace_id: workspace?.id || null,
      workspace_error: wsError?.message || null,
      message: 'Admin user created successfully. The profile and role will be auto-assigned by the database trigger.',
    }
  })
}
