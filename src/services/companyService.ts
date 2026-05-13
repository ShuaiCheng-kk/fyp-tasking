// LAYER: Service
// RULE: Only contains business logic. No HTTP handling. No direct DB access.

import { companyRepository } from '@/repositories/companyRepository'
import { departmentRepository } from '@/repositories/departmentRepository'
import { Company, Department } from '@/types'

export const companyService = {

  async setupCompany(data: {
    name: string
    description: string | null
    owner_id: string
    plan: Company['plan']
  }): Promise<Company> {
    const existing = await companyRepository.findByOwnerId(data.owner_id)
    if (existing) throw new Error('Company already exists for this owner')
    return await companyRepository.createCompany(data)
  },

  async createDepartment(data: {
    name: string
    company_id: string
  }): Promise<Department> {
    return await departmentRepository.createDepartment(data)
  },

  async getDepartments(company_id: string): Promise<Department[]> {
    return await departmentRepository.findByCompanyId(company_id)
  },

  async updatePlan(company_id: string, plan: Company['plan']): Promise<void> {
    await companyRepository.updatePlan(company_id, plan)
  },

  async updateDepartment(department_id: string, name: string): Promise<void> {
    await departmentRepository.updateById(department_id, name)
  },

  async deleteDepartment(department_id: string): Promise<void> {
    await departmentRepository.deleteById(department_id)
  },

  async getCompanyByOwnerId(owner_id: string): Promise<Company | null> {
    return await companyRepository.findByOwnerId(owner_id)
  },

}
