export interface DepartmentImportRow {
  name: string
}

export interface DepartmentImportResult {
  created: string[]
  skipped: string[]
}

export interface MemberImportRow {
  email: string
  role: 'Partner' | 'Manager' | 'Employee'
  department_name?: string | null
  department_id?: string | null
}

export interface MemberImportResult {
  invited: string[]
  failed: Array<{ email: string; message: string }>
}
