import { reviewsRepository } from '@/repositories/marketing/reviewsRepository'
import { CreateReviewInput, Review, ReviewSummary } from '@/types/Review'

const MAX_REVIEW_LENGTH = 2000
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const reviewsService = {
  async submitReview(input: CreateReviewInput): Promise<Review> {
    if (!input.rating || input.rating < 1 || input.rating > 5) {
      throw new Error('Rating must be between 1 and 5')
    }

    const review = input.review?.trim() ?? ''
    if (review.length === 0) {
      throw new Error('Review text is required')
    }
    if (review.length > MAX_REVIEW_LENGTH) {
      throw new Error(`Review must be ${MAX_REVIEW_LENGTH} characters or fewer`)
    }

    const email = input.email?.trim()
    if (email && !EMAIL_PATTERN.test(email)) {
      throw new Error('Email address is invalid')
    }

    return reviewsRepository.createReview({
      name: input.name?.trim() || undefined,
      email: email || undefined,
      rating: input.rating,
      review,
    })
  },

  async getFeaturedReviews(limit = 12): Promise<ReviewSummary[]> {
    return reviewsRepository.listApprovedReviews(limit)
  },

  // Admin moderation below. Wire these behind an admin-role check before
  // exposing them from an API route — see marketingService.verifyMarketingAdmin
  // for the pattern (e.g. reviewsRepository could gain a findAdminByAuthId-style
  // lookup, or reuse marketingRepository.findAdminByAuthId if the same admin
  // role should manage reviews).
  async listAllReviewsForAdmin(): Promise<Review[]> {
    return reviewsRepository.listAllReviews()
  },

  async approveReview(review_id: string): Promise<Review> {
    return reviewsRepository.setReviewApproval(review_id, true)
  },

  async rejectReview(review_id: string): Promise<Review> {
    return reviewsRepository.setReviewApproval(review_id, false)
  },

  // Reserved for the future AI feature to flag its picks for the carousel.
  async setFeatured(review_id: string, featured: boolean): Promise<Review> {
    return reviewsRepository.setReviewFeatured(review_id, featured)
  },
}