// LAYER: Service
// RULE: Only contains business logic. No HTTP handling. No direct DB access.

import { companyRepository } from '@/repositories/companyRepository'
import { departmentRepository } from '@/repositories/departmentRepository'
import { userRepository } from '@/repositories/userRepository'
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
    const company = await companyRepository.createCompany(data)
    await userRepository.updateCompanyId(data.owner_id, company.id)
    return company
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

  async getManagersByDepartment(company_id: string, department_id: string): Promise<{ id: string; full_name: string }[]> {
    return await userRepository.findManagersByDepartment(company_id, department_id)
  },

  async getCompaniesByOwner(owner_id: string): Promise<Company[]> {
    return await companyRepository.findAllByOwnerId(owner_id)
  },

  async updateCompany(id: string, data: { name: string; description: string | null }): Promise<Company> {
    return await companyRepository.updateCompany(id, data)
  },

  async createAdditionalCompany(data: {
    owner_id: string
    name: string
    description: string | null
    plan: Company['plan']
    departments: string[]
  }): Promise<Company> {
    const company = await companyRepository.createCompanyForOwner({
      name: data.name,
      description: data.description,
      owner_id: data.owner_id,
      plan: data.plan,
    })
    for (const deptName of data.departments.filter((d) => d.trim())) {
      await departmentRepository.createDepartment({ name: deptName.trim(), company_id: company.id })
    }
    return company
  },

}
