export interface Review {
  id: string
  name: string | null
  email: string | null
  rating: number
  review: string
  approved: boolean
  featured: boolean
  created_at: string
}

export type ReviewSummary = Pick<Review, 'id' | 'name' | 'rating' | 'review' | 'created_at'>

export interface CreateReviewInput {
  name?: string
  email?: string
  rating: number
  review: string
}