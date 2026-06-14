// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { supabase } from '@/lib/supabase'

export const stripeRepository = {
  async updateCompanyPlan(companyId: string, plan: string): Promise<void> {
    const { error } = await supabase
      .from('companies')
      .update({ plan })
      .eq('id', companyId)

    if (error) throw new Error(error.message)
  },
}
