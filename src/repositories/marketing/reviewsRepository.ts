import { supabase } from '@/lib/supabase'
import { CreateReviewInput, Review, ReviewSummary } from '@/types/Review'

const REVIEW_COLUMNS = 'id, name, email, rating, review, approved, featured, created_at'

export const reviewsRepository = {
  async createReview(input: CreateReviewInput): Promise<Review> {
    const { data, error } = await supabase
      .from('reviews')
      .insert({
        name: input.name ?? null,
        email: input.email ?? null,
        rating: input.rating,
        review: input.review,
      })
      .select(REVIEW_COLUMNS)
      .single()

    if (error) throw new Error(error.message)
    return data as Review
  },

  async listApprovedReviews(limit = 12): Promise<ReviewSummary[]> {
    // Featured reviews (set by the future AI "best reviews" picker) surface first,
    // then highest rated, then most recent.
    const { data, error } = await supabase
      .from('reviews')
      .select('id, name, rating, review, created_at')
      .eq('approved', true)
      .order('featured', { ascending: false })
      .order('rating', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)
    return (data ?? []) as ReviewSummary[]
  },

  async listAllReviews(): Promise<Review[]> {
    const { data, error } = await supabase
      .from('reviews')
      .select(REVIEW_COLUMNS)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return (data ?? []) as Review[]
  },

  async setReviewApproval(review_id: string, approved: boolean): Promise<Review> {
    const { data, error } = await supabase
      .from('reviews')
      .update({ approved })
      .eq('id', review_id)
      .select(REVIEW_COLUMNS)
      .single()

    if (error) throw new Error(error.message)
    return data as Review
  },

  async setReviewFeatured(review_id: string, featured: boolean): Promise<Review> {
    const { data, error } = await supabase
      .from('reviews')
      .update({ featured })
      .eq('id', review_id)
      .select(REVIEW_COLUMNS)
      .single()

    if (error) throw new Error(error.message)
    return data as Review
  },
}