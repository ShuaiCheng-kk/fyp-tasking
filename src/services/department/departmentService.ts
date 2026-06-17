import { departmentRepository } from '@/repositories/department/departmentRepository'
import { Department } from '@/types/department.types'

export const departmentService = {

  async createDepartment(data: { name: string; company_id: string; color?: string | null }): Promise<Department> {
    return await departmentRepository.createDepartment(data)
  },

  async getDepartments(company_id: string): Promise<Department[]> {
    return await departmentRepository.findByCompanyId(company_id)
  },

  async updateDepartment(department_id: string, name: string, color?: string | null): Promise<void> {
    await departmentRepository.updateById(department_id, name, color)
  },

  async deleteDepartment(department_id: string): Promise<void> {
    await departmentRepository.deleteById(department_id)
  },

}
