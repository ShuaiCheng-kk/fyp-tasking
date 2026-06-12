import { employeeAttendanceRepository } from '@/repositories/employee/employeeAttendanceRepository'

export const employeeAttendanceService = {
  async getAttendanceRecords(auth_user_id: string) {
    return employeeAttendanceRepository.getAttendanceRecords(auth_user_id)
  },
}
