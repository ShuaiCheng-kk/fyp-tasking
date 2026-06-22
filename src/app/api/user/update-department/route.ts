// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { user_id, department_id, company_id } = body

    if (!user_id) {
      return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
    }
    if (!department_id) {
      return NextResponse.json({ success: false, message: 'department_id is required' }, { status: 400 })
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, company_id, role')
      .eq('id', user_id)
      .single()
    if (userError || !user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    const resolvedCompanyId = company_id || user.company_id
    if (!resolvedCompanyId) {
      return NextResponse.json({ success: false, message: 'Cannot resolve company_id for user' }, { status: 400 })
    }

    if (user.company_id !== resolvedCompanyId) {
      return NextResponse.json({ success: false, message: 'User is not a member of this company' }, { status: 400 })
    }

    const { data: department, error: departmentError } = await supabase
      .from('departments')
      .select('id')
      .eq('id', department_id)
      .eq('company_id', resolvedCompanyId)
      .single()
    if (departmentError || !department) {
      return NextResponse.json({ success: false, message: 'Department not found in this company' }, { status: 404 })
    }

    if (user.role === 'Manager') {
      const { error: deleteError } = await supabase
        .from('manager_departments')
        .delete()
        .eq('manager_id', user_id)
        .eq('company_id', resolvedCompanyId)
      if (deleteError) throw new Error(deleteError.message)

      const { error } = await supabase
        .from('manager_departments')
        .insert({ manager_id: user_id, department_id, company_id: resolvedCompanyId })
      if (error) throw new Error(error.message)
    } else if (user.role === 'Employee') {
      const { error: deleteError } = await supabase
        .from('employee_departments')
        .delete()
        .eq('employee_id', user_id)
      if (deleteError) throw new Error(deleteError.message)

      const { error } = await supabase
        .from('employee_departments')
        .insert({ employee_id: user_id, department_id })
      if (error) throw new Error(error.message)
    } else {
      return NextResponse.json({ success: false, message: 'Only Managers and Employees can be assigned to departments' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Something went wrong'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
