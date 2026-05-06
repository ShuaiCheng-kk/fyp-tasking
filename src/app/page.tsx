import { createClient } from '@supabase/supabase-js'

console.log("My URL is:", process.env.NEXT_PUBLIC_SUPABASE_URL)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function HomePage() {

  const { data: workers } = await supabase.from('casual_worker').select('*')

  return (
    <div style={{ padding: '20px' }}>
      <h1>Casual Workers List (FYP Tasking)</h1>
      <ul>
        {workers?.map((worker) => (
          <li key={worker.id}>
            {worker.name} - {worker.department}
          </li>
        ))}
      </ul>
    </div>
  )
}