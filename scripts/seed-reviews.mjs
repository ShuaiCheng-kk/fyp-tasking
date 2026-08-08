/**
 * scripts/seed-reviews.mjs — Marketing site "reviews" mockup data
 *
 * Independent of scripts/seed.js (internal app demo data) and
 * scripts/seed-marketing-pages.mjs (marketing_pages/marketing_content_blocks CMS content).
 * The `reviews` table is its own thing — no company/user foreign keys, just
 * name/email/rating/review/approved/featured (see src/types/Review.ts and
 * src/repositories/marketing/reviewsRepository.ts).
 *
 * Wipes and rebuilds all 10 rows every run — safe to re-run.
 * Inserted pre-approved (approved: true) so they show up immediately on the
 * Home page's "What people are saying" section and /feedback without needing
 * the (currently unbuilt — see BUGLOG BUG-007) moderation queue UI.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const reviews = [
  {
    name: 'Sarah Chen',
    email: 'sarah@brewhouseco.sg',
    rating: 5,
    review: "We run a café with a rotating roster of baristas and casual staff. The AI shift suggestions alone saved me hours every week — it actually respects who's asked for a day off instead of me chasing everyone on WhatsApp.",
    approved: true,
    featured: true,
  },
  {
    name: 'Marcus Tan',
    email: null,
    rating: 5,
    review: 'Posting a job used to mean juggling three different group chats. Now applicants apply on one public board, I rank them by AI recommendation, and the moment someone accepts they\'re already on the shift. Genuinely faster.',
    approved: true,
    featured: true,
  },
  {
    name: null,
    email: 'owner@cleanpro.sg',
    rating: 4,
    review: 'Task assignment down the hierarchy took a bit to get used to, but once my managers understood they can only assign within their own department it actually cleaned up a lot of confusion about who\'s responsible for what.',
    approved: true,
    featured: false,
  },
  {
    name: 'Priya Nair',
    email: null,
    rating: 5,
    review: 'Clock in and out is dead simple for our casual workers, no app to install. The grace period means nobody gets marked late for being two minutes early to the timer.',
    approved: true,
    featured: false,
  },
  {
    name: 'David Lim',
    email: 'david@eventscrew.sg',
    rating: 3,
    review: "Does what it says, though I wish the shift swap approval flow was a bit faster to navigate on mobile. Still switched over from spreadsheets and haven't looked back.",
    approved: true,
    featured: false,
  },
  {
    name: 'Grace Wong',
    email: null,
    rating: 5,
    review: 'The AI anomaly detection in Reports flagged a scheduling gap in one department before it became a problem. That single catch paid for the subscription.',
    approved: true,
    featured: true,
  },
  {
    name: null,
    email: null,
    rating: 5,
    review: "Started on the free plan to test it with one department. Didn't feel like a stripped-down demo, it just worked, and it was almost 3 months before we hit a wall and upgraded.",
    approved: true,
    featured: false,
  },
  {
    name: 'Wei Jie Lim',
    email: 'weijie@hospitalitygroup.sg',
    rating: 4,
    review: "Fixed day off requests and shift swaps finally go to the right person — Manager for staff swaps, Owner for the bigger stuff. No more guessing who's supposed to approve what.",
    approved: true,
    featured: false,
  },
  {
    name: 'Aisha Rahman',
    email: null,
    rating: 5,
    review: "Managing a casual worker pool across two sites used to mean two separate headaches. Now it's one dashboard, and every worker's history follows them, so I know who's actually reliable before I invite them back.",
    approved: true,
    featured: true,
  },
  {
    name: 'Ben Seah',
    email: null,
    rating: 4,
    review: "Communication module keeps announcements and DMs in one place, which sounds small until you realise you're not digging through email threads to find who said what.",
    approved: true,
    featured: false,
  },
];

async function run() {
  const { error: delErr } = await supabase.from('reviews').delete().not('id', 'is', null);
  if (delErr) throw delErr;

  const { error: insErr } = await supabase.from('reviews').insert(reviews);
  if (insErr) throw insErr;

  console.log('Seeded', reviews.length, 'reviews.');
}

run();
